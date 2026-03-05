/**
 * @fileoverview Kafka consumer for AdminService
 * @module kafka/consumer.ts
 * @author Darrell Hobson
 * @Date 2026.03.05
 *
 * Subscribes to the account.events topic.
 * On ACCOUNT_CREATION_SUBMITTED: inserts outbox notification rows into the
 * admin database — AdminService owns this data, no cross-service DB access.
 */
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { getPool }  from "../db/pool";
import { logger }   from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "admin-service",
  brokers:  (process.env.KAFKA_BROKERS  || "localhost:9092").split(","),
  retry:    { retries: 5 },
});

const TOPICS = {
  ACCOUNT_EVENTS: "account.events",
} as const;

let consumer: Consumer | null = null;

// ── Notification insert helper ────────────────────────────────────────────────

interface NotificationPayload {
  recipientId:     string;
  serviceTypeName: string;
  notifTypeName:   string;
  subject:         string;
  messageBody:     string;
}

async function insertNotification(n: NotificationPayload): Promise<void> {
  const pool = getPool();

  const [stRow, ntRow] = await Promise.all([
    pool.query("SELECT id FROM service_type      WHERE name = $1", [n.serviceTypeName]),
    pool.query("SELECT id FROM notification_type WHERE name = $1", [n.notifTypeName]),
  ]);

  if (!stRow.rowCount || !ntRow.rowCount) {
    logger.warn(
      `[Consumer] Cannot resolve service_type='${n.serviceTypeName}' ` +
      `or notification_type='${n.notifTypeName}' — skipping`
    );
    return;
  }

  await pool.query(
    `INSERT INTO notification
       (recipient_id, service_type, notification_type, subject, message_body,
        outbox_flag, sent_flag)
     VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
    [
      n.recipientId,
      stRow.rows[0].id,
      ntRow.rows[0].id,
      n.subject,
      n.messageBody,
    ]
  );
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleAccountCreationSubmitted(payload: {
  accountId:       string;
  email:           string;
  firstName:       string;
  lastName:        string;
  accountType:     string;
  adminAccountIds: string[];
  appBaseUrl:      string;
}): Promise<void> {
  const adminSubpageUrl = `${payload.appBaseUrl}/admin/subpage`;
  const notifications: NotificationPayload[] = [];

  // One email notification per admin account
  for (const adminId of payload.adminAccountIds) {
    notifications.push({
      recipientId:     adminId,
      serviceTypeName: "email",
      notifTypeName:   "account creation submitted",
      subject:         "New Account Creation Request – SportVault",
      messageBody:
        `A new account registration is awaiting your approval.\n\n` +
        `User:  ${payload.email}\n` +
        `Name:  ${payload.firstName} ${payload.lastName}\n` +
        `Type:  ${payload.accountType}\n\n` +
        `Review pending accounts: ${adminSubpageUrl}\n`,
    });
  }

  // Confirmation email for the registering user
  notifications.push({
    recipientId:     payload.accountId,
    serviceTypeName: "email",
    notifTypeName:   "account creation submitted",
    subject:         "Your SportVault Account Request Has Been Received",
    messageBody:
      `Hi ${payload.firstName},\n\n` +
      `Thank you for registering with SportVault. Your account creation request ` +
      `has been received and is pending approval by an administrator.\n\n` +
      `You will be notified by email once a decision has been made.\n`,
  });

  for (const n of notifications) {
    await insertNotification(n);
  }

  logger.info(
    `[Consumer] Inserted ${notifications.length} notification(s) ` +
    `for account ${payload.accountId}`
  );
}

// ── Message dispatcher ────────────────────────────────────────────────────────

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(message.value.toString()) as Record<string, unknown>;
  } catch {
    logger.warn("[Consumer] Received non-JSON Kafka message — skipping");
    return;
  }

  const eventType = event.eventType as string | undefined;
  logger.debug(`[Consumer] Received event: ${eventType}`);

  try {
    switch (eventType) {
      case "ACCOUNT_CREATION_SUBMITTED":
        await handleAccountCreationSubmitted(event as any);
        break;
      default:
        // Other account events (ACCOUNT_ACTIVATED, etc.) — no action needed yet
        break;
    }
  } catch (err) {
    logger.error(`[Consumer] Error handling event ${eventType}`, err);
    // Do not rethrow — let Kafka continue to the next message
  }
}

// ── Consumer lifecycle ────────────────────────────────────────────────────────

/**
 * startConsumer()
 *
 * Connects the Kafka consumer, subscribes to account.events, and begins
 * processing messages. Call once at service startup after DB is ready.
 */
export async function startConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "admin-service-group",
  });

  await consumer.connect();
  logger.info("✅  Kafka consumer connected");

  await consumer.subscribe({
    topic:     TOPICS.ACCOUNT_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: handleMessage,
  });

  logger.info(`📨  Listening on topic: ${TOPICS.ACCOUNT_EVENTS}`);
}

export async function disconnectConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}
