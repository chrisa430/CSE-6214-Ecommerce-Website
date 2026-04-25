/**
 * @fileoverview Kafka consumer for AdminService
 * @module kafka/consumer.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Subscribed topics:
 *   account.events — ACCOUNT_CREATION_SUBMITTED
 *   order.events   — ORDER_COMPLETED   → product_sales   RSS feed (per seller)
 *   return.events  — RETURN_INITIATED  → product_returns RSS feed (per seller)
 *
 * Each handler inserts a structured rss_feed_item with a metadata JSONB payload
 * containing exactly the fields required per spec:
 *
 *   product_sales:   { orderId, productId, productName, buyerName, productCost }
 *   product_returns: { orderId, productId, productName, buyerName, productCost, reason }
 */
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { getPool }           from "../db/pool";
import { getAccountPool }    from "../db/accountPool";
import { getInventoryPool }  from "../db/inventoryPool";
import { logger }            from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "admin-service",
  brokers:  (process.env.KAFKA_BROKERS  || "localhost:9092").split(","),
  retry:    { retries: 5 },
});

const TOPICS = {
  ACCOUNT_EVENTS: "account.events",
  ORDER_EVENTS:   "order.events",
  RETURN_EVENTS:  "return.events",
} as const;

let consumer: Consumer | null = null;

// ── Notification insert helper ────────────────────────────────────────────────

async function insertNotification(n: {
  recipientId:     string;
  serviceTypeName: string;
  notifTypeName:   string;
  subject:         string;
  messageBody:     string;
}): Promise<void> {
  const pool = getPool();
  const [stRow, ntRow] = await Promise.all([
    pool.query("SELECT id FROM service_type      WHERE name = $1", [n.serviceTypeName]),
    pool.query("SELECT id FROM notification_type WHERE name = $1", [n.notifTypeName]),
  ]);
  if (!stRow.rowCount || !ntRow.rowCount) {
    logger.warn(`[Consumer] Cannot resolve service_type='${n.serviceTypeName}' or notification_type='${n.notifTypeName}'`);
    return;
  }
  await pool.query(
    `INSERT INTO notification
       (recipient_id, service_type, notification_type, subject, message_body, outbox_flag, sent_flag)
     VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
    [n.recipientId, stRow.rows[0].id, ntRow.rows[0].id, n.subject, n.messageBody]
  );
}

// ── RSS feed item insert + subscriber email notifications ─────────────────────

interface RssFeedOpts {
  feedTypeName:    string;
  title:           string;
  description:     string;
  referenceId?:    string;
  metadata?:       Record<string, unknown>;
  notifTypeName:   string;
  buildEmailBody:  (firstName: string) => string;
  targetSellerId?: string;   // if set, only notify this seller (if they are subscribed)
}

async function publishRssFeedItem(opts: RssFeedOpts): Promise<void> {
  const pool        = getPool();
  const accountPool = getAccountPool();
  const appBase     = process.env.APP_BASE_URL || "http://localhost:5173";

  try {
    // 1. Resolve feed type id
    const ftRow = await pool.query("SELECT id FROM rss_feed_type WHERE name = $1", [opts.feedTypeName]);
    if (!ftRow.rowCount) {
      logger.warn(`[RSS] Feed type '${opts.feedTypeName}' not found`); return;
    }
    const feedTypeId = ftRow.rows[0].id as string;

    // 2. Insert feed item
    await pool.query(
      `INSERT INTO rss_feed_item
         (feed_type_id, title, description, link, reference_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        feedTypeId, opts.title, opts.description,
        `${appBase}/seller/rss-feeds`,
        opts.referenceId ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
      ]
    );

    // 3. Find subscribed sellers
    let subscribers: { seller_id: string }[];
    if (opts.targetSellerId) {
      const r = await pool.query(
        `SELECT seller_id FROM rss_subscription
         WHERE feed_type_id = $1 AND seller_id = $2 AND email_alerts = TRUE`,
        [feedTypeId, opts.targetSellerId]
      );
      subscribers = r.rows as { seller_id: string }[];
    } else {
      const r = await pool.query(
        `SELECT seller_id FROM rss_subscription
         WHERE feed_type_id = $1 AND email_alerts = TRUE`,
        [feedTypeId]
      );
      subscribers = r.rows as { seller_id: string }[];
    }

    if (subscribers.length === 0) return;

    // 4. Queue email for each subscriber
    const [stRow, ntRow] = await Promise.all([
      pool.query("SELECT id FROM service_type      WHERE name = 'email'"),
      pool.query("SELECT id FROM notification_type WHERE name = $1", [opts.notifTypeName]),
    ]);
    if (!stRow.rowCount || !ntRow.rowCount) return;

    for (const sub of subscribers) {
      const acct = await accountPool.query(
        "SELECT first_name AS \"firstName\" FROM account WHERE id = $1", [sub.seller_id]
      );
      const firstName = acct.rows[0]?.firstName ?? "Seller";
      await pool.query(
        `INSERT INTO notification
           (recipient_id, service_type, notification_type, subject, message_body, outbox_flag, sent_flag)
         VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
        [
          sub.seller_id,
          stRow.rows[0].id,
          ntRow.rows[0].id,
          opts.title,
          opts.buildEmailBody(firstName),
        ]
      );
    }

    logger.info(`[RSS] '${opts.feedTypeName}' item inserted — notified ${subscribers.length} subscriber(s)`);
  } catch (err) {
    logger.error(`[RSS] publishRssFeedItem error for '${opts.feedTypeName}'`, err);
  }
}

// ── ACCOUNT_CREATION_SUBMITTED ────────────────────────────────────────────────

async function handleAccountCreationSubmitted(payload: {
  accountId:      string;
  email:          string;
  firstName:      string;
  lastName:       string;
  accountType:    string;
  adminAccountIds: string[];
  appBaseUrl:     string;
}): Promise<void> {
  const adminSubpageUrl = `${payload.appBaseUrl}/admin/subpage`;

  for (const adminId of payload.adminAccountIds) {
    await insertNotification({
      recipientId: adminId, serviceTypeName: "email",
      notifTypeName: "account creation submitted",
      subject: "New Account Creation Request – SportVault",
      messageBody:
        `A new account registration is awaiting your approval.\n\n` +
        `User:  ${payload.email}\nName:  ${payload.firstName} ${payload.lastName}\n` +
        `Type:  ${payload.accountType}\n\nReview: ${adminSubpageUrl}\n`,
    });
  }
  await insertNotification({
    recipientId: payload.accountId, serviceTypeName: "email",
    notifTypeName: "account creation submitted",
    subject: "Your SportVault Account Request Has Been Received",
    messageBody:
      `Hi ${payload.firstName},\n\nThank you for registering. Your account is pending admin approval.\n` +
      `You will be notified by email once a decision has been made.\n`,
  });
}

// ── ORDER_COMPLETED → product_sales ──────────────────────────────────────────
// Required fields: Order ID, Product ID, Product Name, Buyer Name, Product Cost

async function handleOrderCompleted(payload: {
  orderId:   string;
  buyerId:   string;
  total:     number;
  items: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>;
  occurredAt: string;
}): Promise<void> {
  const accountPool = getAccountPool();
  const invPool     = getInventoryPool();
  const appBase     = process.env.APP_BASE_URL || "http://localhost:5173";

  // Resolve buyer name once
  let buyerName = "Unknown Buyer";
  try {
    const buyerRow = await accountPool.query(
      "SELECT first_name AS \"firstName\", last_name AS \"lastName\" FROM account WHERE id = $1",
      [payload.buyerId]
    );
    if (buyerRow.rowCount) {
      buyerName = `${buyerRow.rows[0].firstName as string} ${buyerRow.rows[0].lastName as string}`;
    }
  } catch { /* non-fatal */ }

  // Group items by seller
  const sellerItems = new Map<string, typeof payload.items>();
  for (const item of payload.items) {
    try {
      const pRow = await invPool.query(
        "SELECT seller_id AS \"sellerId\" FROM product WHERE id = $1", [item.productId]
      );
      if (!pRow.rowCount) continue;
      const sid = pRow.rows[0].sellerId as string;
      const existing = sellerItems.get(sid) ?? [];
      existing.push(item);
      sellerItems.set(sid, existing);
    } catch { /* non-fatal */ }
  }

  // One feed item + notification per seller per item
  for (const [sellerId, items] of sellerItems.entries()) {
    for (const item of items) {
      const productCost = (item.unitPrice * item.quantity).toFixed(2);
      const title       = `Sale: "${item.name}" — $${productCost}`;
      const shortOrderId = payload.orderId.slice(0, 8).toUpperCase();
      const description =
        `Order #${shortOrderId}: Buyer ${buyerName} purchased ` +
        `"${item.name}" (qty: ${item.quantity}) for $${productCost}.`;

      await publishRssFeedItem({
        feedTypeName:  "product_sales",
        title,
        description,
        referenceId:   payload.orderId,
        metadata: {
          orderId:     payload.orderId,
          productId:   item.productId,
          productName: item.name,
          buyerName,
          productCost,
          quantity:    item.quantity,
          unitPrice:   item.unitPrice.toFixed(2),
        },
        notifTypeName:   "rss_product_sale",
        targetSellerId:  sellerId,
        buildEmailBody:  (firstName) =>
          `Hi ${firstName},\n\nGreat news — a buyer just purchased one of your products!\n\n` +
          `Order ID:     ${payload.orderId}\n` +
          `Product ID:   ${item.productId}\n` +
          `Product:      ${item.name}\n` +
          `Buyer:        ${buyerName}\n` +
          `Product Cost: $${productCost}\n\n` +
          `View your RSS feed dashboard: ${appBase}/seller/rss-feeds\n`,
      });
    }
  }
}

// ── RETURN_INITIATED → product_returns ───────────────────────────────────────
// Required fields: Order ID, Product ID, Product Name, Buyer Name, Product Cost, Reason

async function handleReturnInitiated(payload: {
  returnId:    string;
  orderId:     string;
  productId:   string;
  productName: string;
  productCost: number;
  sellerId:    string;
  buyerId:     string;
  reason?:     string;
  occurredAt:  string;
}): Promise<void> {
  const accountPool = getAccountPool();
  const appBase     = process.env.APP_BASE_URL || "http://localhost:5173";

  // Resolve buyer name
  let buyerName = "Unknown Buyer";
  try {
    const buyerRow = await accountPool.query(
      "SELECT first_name AS \"firstName\", last_name AS \"lastName\" FROM account WHERE id = $1",
      [payload.buyerId]
    );
    if (buyerRow.rowCount) {
      buyerName = `${buyerRow.rows[0].firstName as string} ${buyerRow.rows[0].lastName as string}`;
    }
  } catch { /* non-fatal */ }

  const reason        = payload.reason ?? "No reason provided";
  const productCost   = payload.productCost.toFixed(2);
  const shortOrderId  = payload.orderId.slice(0, 8).toUpperCase();
  const title         = `Return Request: "${payload.productName}"`;
  const description   =
    `Order #${shortOrderId}: Buyer ${buyerName} requested a return for ` +
    `"${payload.productName}" ($${productCost}). Reason: ${reason}`;

  await publishRssFeedItem({
    feedTypeName:  "product_returns",
    title,
    description,
    referenceId:   payload.returnId,
    metadata: {
      orderId:     payload.orderId,
      productId:   payload.productId,
      productName: payload.productName,
      buyerName,
      productCost,
      reason,
    },
    notifTypeName:   "rss_product_return",
    targetSellerId:  payload.sellerId,
    buildEmailBody:  (firstName) =>
      `Hi ${firstName},\n\nA buyer has requested a return for one of your products.\n\n` +
      `Order ID:     ${payload.orderId}\n` +
      `Product ID:   ${payload.productId}\n` +
      `Product:      ${payload.productName}\n` +
      `Buyer:        ${buyerName}\n` +
      `Product Cost: $${productCost}\n` +
      `Reason:       ${reason}\n\n` +
      `Review and respond in your Seller Portal: ${appBase}/seller/returns\n`,
  });
}

// ── Message dispatcher ────────────────────────────────────────────────────────

async function handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(message.value.toString()) as Record<string, unknown>;
  } catch {
    logger.warn("[Consumer] Non-JSON Kafka message — skipping"); return;
  }

  const eventType = event.eventType as string | undefined;
  logger.debug(`[Consumer] Topic: ${topic} | Event: ${eventType}`);

  try {
    if (topic === TOPICS.ACCOUNT_EVENTS) {
      if (eventType === "ACCOUNT_CREATION_SUBMITTED")
        await handleAccountCreationSubmitted(event as any);
    } else if (topic === TOPICS.ORDER_EVENTS) {
      if (eventType === "ORDER_COMPLETED")
        await handleOrderCompleted(event as any);
    } else if (topic === TOPICS.RETURN_EVENTS) {
      if (eventType === "RETURN_INITIATED")
        await handleReturnInitiated(event as any);
    }
  } catch (err) {
    logger.error(`[Consumer] Error handling ${eventType} on ${topic}`, err);
  }
}

// ── Consumer lifecycle ────────────────────────────────────────────────────────

export async function startConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || "admin-service-group" });
  await consumer.connect();
  logger.info("✅  Kafka consumer connected");

  await consumer.subscribe({ topic: TOPICS.ACCOUNT_EVENTS, fromBeginning: false });
  await consumer.subscribe({ topic: TOPICS.ORDER_EVENTS,   fromBeginning: false });
  await consumer.subscribe({ topic: TOPICS.RETURN_EVENTS,  fromBeginning: false });
  await consumer.run({ eachMessage: handleMessage });

  logger.info(`📨  Listening on topics: ${Object.values(TOPICS).join(", ")}`);
}

export async function disconnectConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}
