/**
 * @fileoverview AdminService route handlers
 * @module routes/admin.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Routes:
 *   GET  /admin/accounts              — list pending accounts
 *   POST /admin/accounts/decision     — approve or reject accounts
 *   GET  /admin/products              — list all products
 *   GET  /admin/products/:id          — product detail
 *   POST /admin/products/status       — bulk set product status (active | suspended)
 *   POST /admin/internal/seed         — verify reference data
 */
import { Router, Request, Response } from "express";
import { getPool }           from "../db/pool";
import { getAccountPool }    from "../db/accountPool";
import { getInventoryPool }  from "../db/inventoryPool";
import { publishEvent, TOPICS } from "../kafka/client";
import { logger }            from "../logger";
import rssRoutes             from "./rss";

const router = Router();

// ── RSS feed item helper ──────────────────────────────────────────────────────
// Inserts a structured feed item into rss_feed_item and queues SES email
// notifications for every subscriber with email_alerts = TRUE.

interface RssItemOpts {
  feedTypeName:   string;
  title:          string;
  description:    string;
  referenceId?:   string;
  link?:          string;
  // Structured per-feed metadata stored as JSONB
  metadata?:      Record<string, unknown>;
  // For targeted notifications (sales/returns) — only notify this seller
  targetSellerId?: string;
}

async function insertRssFeedItem(opts: RssItemOpts): Promise<void> {
  const pool       = getPool();
  const acctPool   = getAccountPool();
  const appBase    = process.env.APP_BASE_URL || "http://localhost:5173";

  try {
    // 1. Resolve feed type
    const ftRow = await pool.query(
      "SELECT id FROM rss_feed_type WHERE name = $1", [opts.feedTypeName]
    );
    if (!ftRow.rowCount) {
      logger.warn(`[RSS] Feed type '${opts.feedTypeName}' not found`);
      return;
    }
    const feedTypeId = ftRow.rows[0].id as string;

    // 2. Insert feed item with metadata JSONB
    await pool.query(
      `INSERT INTO rss_feed_item
         (feed_type_id, title, description, link, reference_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        feedTypeId,
        opts.title,
        opts.description,
        opts.link ?? `${appBase}/seller/rss-feeds`,
        opts.referenceId ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
      ]
    );

    // 3. Resolve subscribers
    let subscriberRows: { seller_id: string }[];
    if (opts.targetSellerId) {
      const r = await pool.query(
        `SELECT seller_id FROM rss_subscription
         WHERE feed_type_id = $1 AND seller_id = $2 AND email_alerts = TRUE`,
        [feedTypeId, opts.targetSellerId]
      );
      subscriberRows = r.rows as { seller_id: string }[];
    } else {
      const r = await pool.query(
        `SELECT seller_id FROM rss_subscription
         WHERE feed_type_id = $1 AND email_alerts = TRUE`,
        [feedTypeId]
      );
      subscriberRows = r.rows as { seller_id: string }[];
    }

    if (subscriberRows.length === 0) return;

    // 4. Resolve notification type
    const ntMap: Record<string, string> = {
      product_activations: "rss_product_activation",
      product_blocks:      "rss_product_block",
      product_sales:       "rss_product_sale",
      product_returns:     "rss_product_return",
      account_blocks:      "rss_account_block",
    };
    const ntName = ntMap[opts.feedTypeName] ?? "rss_product_activation";
    const [stRow, ntRow] = await Promise.all([
      pool.query("SELECT id FROM service_type WHERE name = 'email'"),
      pool.query("SELECT id FROM notification_type WHERE name = $1", [ntName]),
    ]);
    if (!stRow.rowCount || !ntRow.rowCount) return;

    // 5. Queue notifications for each subscriber
    for (const sub of subscriberRows) {
      const acct = await acctPool.query(
        "SELECT first_name AS \"firstName\" FROM account WHERE id = $1",
        [sub.seller_id]
      );
      const firstName  = acct.rows[0]?.firstName ?? "Seller";
      const emailBody  = buildEmailBody(firstName, opts);

      await pool.query(
        `INSERT INTO notification
           (recipient_id, service_type, notification_type, subject, message_body, outbox_flag, sent_flag)
         VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
        [sub.seller_id, stRow.rows[0].id, ntRow.rows[0].id, opts.title, emailBody]
      );
    }

    logger.info(
      `[RSS] '${opts.feedTypeName}' item inserted — notified ${subscriberRows.length} subscriber(s)`
    );
  } catch (err) {
    logger.error("[RSS] insertRssFeedItem error", err);
  }
}

/** Build a human-readable email body from the feed item + its structured metadata. */
function buildEmailBody(firstName: string, opts: RssItemOpts): string {
  const appBase  = process.env.APP_BASE_URL || "http://localhost:5173";
  const m        = opts.metadata ?? {};
  const lines: string[] = [`Hi ${firstName},`, "", opts.description, ""];

  if (opts.feedTypeName === "product_activations") {
    if (m.productId)   lines.push(`Product ID:   ${m.productId as string}`);
    if (m.productName) lines.push(`Product:      ${m.productName as string}`);
    if (m.description) lines.push(`Description:  ${m.description as string}`);
    if (m.quantity)    lines.push(`Quantity:     ${m.quantity}`);
    if (m.unitPrice)   lines.push(`Unit Price:   $${m.unitPrice}`);
  } else if (opts.feedTypeName === "product_blocks") {
    if (m.productId)   lines.push(`Product ID:   ${m.productId as string}`);
    if (m.productName) lines.push(`Product:      ${m.productName as string}`);
    if (m.reason)      lines.push(`Reason:       ${m.reason as string}`);
  } else if (opts.feedTypeName === "product_sales") {
    if (m.orderId)     lines.push(`Order ID:     ${m.orderId as string}`);
    if (m.productId)   lines.push(`Product ID:   ${m.productId as string}`);
    if (m.productName) lines.push(`Product:      ${m.productName as string}`);
    if (m.buyerName)   lines.push(`Buyer:        ${m.buyerName as string}`);
    if (m.productCost) lines.push(`Sale Amount:  $${m.productCost}`);
  } else if (opts.feedTypeName === "product_returns") {
    if (m.orderId)     lines.push(`Order ID:     ${m.orderId as string}`);
    if (m.productId)   lines.push(`Product ID:   ${m.productId as string}`);
    if (m.productName) lines.push(`Product:      ${m.productName as string}`);
    if (m.buyerName)   lines.push(`Buyer:        ${m.buyerName as string}`);
    if (m.productCost) lines.push(`Product Cost: $${m.productCost}`);
    if (m.reason)      lines.push(`Return Reason:${m.reason as string}`);
  } else if (opts.feedTypeName === "account_blocks") {
    if (m.accountStatus) lines.push(`Account Status: ${m.accountStatus as string}`);
    if (m.reason)        lines.push(`Reason:         ${m.reason as string}`);
  }

  lines.push("", `View your RSS feed dashboard: ${appBase}/seller/rss-feeds`);
  return lines.join("\n");
}

// ── GET /admin/accounts ───────────────────────────────────────────────────────
/**
 * Returns all account records with status = 'open' (pending admin approval).
 */
router.get("/accounts", async (_req: Request, res: Response): Promise<void> => {
  const pool = getAccountPool();
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.user_id        AS "userId",
        a.first_name     AS "firstName",
        a.last_name      AS "lastName",
        a.created_at     AS "createdAt",
        a.updated_at     AS "updatedAt",
        att.name         AS "accountType",
        ast.name         AS status
      FROM account a
      JOIN account_type   att ON att.id = a.type_id
      JOIN account_status ast ON ast.id = a.status_id
      WHERE ast.name = 'open'
      ORDER BY a.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error("Get accounts error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/accounts/decision ────────────────────────────────────────────
/**
 * Bulk approve or reject one or more open accounts.
 * Body: { accountIds: string[], decision: "approve" | "reject", reason?: string }
 */
router.post("/accounts/decision", async (req: Request, res: Response): Promise<void> => {
  const { accountIds, decision, reason } = req.body as {
    accountIds: string[];
    decision:   "approve" | "reject";
    reason?:    string;
  };

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    res.status(400).json({ error: "accountIds must be a non-empty array." }); return;
  }
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "decision must be 'approve' or 'reject'." }); return;
  }

  const accountPool = getAccountPool();
  const adminPool   = getPool();
  const newStatus   = decision === "approve" ? "active" : "closed";

  try {
    // 1. Resolve the target status id
    const statusRow = await accountPool.query(
      "SELECT id FROM account_status WHERE name = $1", [newStatus]
    );
    if (!statusRow.rowCount) {
      res.status(500).json({ error: `Status '${newStatus}' not found in account DB.` }); return;
    }
    const statusId = statusRow.rows[0].id as string;

    // 2. Update account status + date column
    const dateClause = decision === "approve"
      ? ", activated_date = NOW()"
      : ", closed_date = NOW()";

    await accountPool.query(
      `UPDATE account
       SET status_id = $1, updated_at = NOW() ${dateClause}
       WHERE id = ANY($2::uuid[])`,
      [statusId, accountIds]
    );

    // 3. Queue email notifications (non-fatal)
    try {
      const [stRow, ntRow] = await Promise.all([
        adminPool.query("SELECT id FROM service_type WHERE name = 'email'"),
        adminPool.query("SELECT id FROM notification_type WHERE name = $1",
          [decision === "approve" ? "account creation approved" : "account creation rejected"]
        ),
      ]);

      if (stRow.rowCount && ntRow.rowCount) {
        const subject = decision === "approve"
          ? "Your SportVault Account Has Been Approved"
          : "Your SportVault Account Request Was Not Approved";
        const body = decision === "approve"
          ? "Congratulations! Your SportVault account has been approved. You may now sign in."
          : `Your SportVault account request was not approved.${reason ? `\n\nReason: ${reason}` : ""}`;

        for (const accountId of accountIds) {
          await adminPool.query(
            `INSERT INTO notification
               (recipient_id, service_type, notification_type, subject, message_body, outbox_flag, sent_flag)
             VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
            [accountId, stRow.rows[0].id, ntRow.rows[0].id, subject, body]
          );
        }
      }
    } catch (notifErr) {
      logger.error("Failed to queue decision notifications", notifErr);
    }

    // 4. Publish Kafka event
    await publishEvent(TOPICS.ADMIN_EVENTS, "decision", {
      eventType: "ADMIN_DECISION", decision, accountIds,
      occurredAt: new Date().toISOString(),
    });

    // 5. RSS: account_blocks feed with Account Status + Reason
    if (decision === "reject") {
      // Resolve account details for each blocked account
      const acctRows = await accountPool.query(
        `SELECT id, user_id AS email, first_name AS "firstName", last_name AS "lastName",
                ast.name AS status
         FROM account a
         JOIN account_status ast ON ast.id = a.status_id
         WHERE a.id = ANY($1::uuid[])`,
        [accountIds]
      );

      for (const acct of acctRows.rows as any[]) {
        await insertRssFeedItem({
          feedTypeName: "account_blocks",
          title:        `Account blocked: ${acct.firstName as string} ${acct.lastName as string}`,
          description:  `Admin blocked account ${acct.email as string}. Status: ${acct.status as string}.${reason ? ` Reason: ${reason}` : ""}`,
          referenceId:  acct.id as string,
          metadata: {
            accountId:     acct.id,
            accountEmail:  acct.email,
            accountName:   `${acct.firstName} ${acct.lastName}`,
            accountStatus: newStatus,
            reason:        reason ?? "No reason provided",
          },
        });
      }
    }

    const sanitizedAccountIds = accountIds.map((id) => String(id).replace(/[\r\n]/g, ""));
    logger.info(`Admin ${decision}d accounts: [${sanitizedAccountIds.join(", ")}]`);
    res.json({ message: `Accounts ${decision}d successfully.`, count: accountIds.length });
  } catch (err) {
    logger.error("Account decision error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/products ───────────────────────────────────────────────────────
router.get("/products", async (_req: Request, res: Response): Promise<void> => {
  const invPool  = getInventoryPool();
  const acctPool = getAccountPool();
  try {
    const productResult = await invPool.query(`
      SELECT
        p.id,
        p.seller_id        AS "sellerId",
        p.name,
        p.short_desc       AS "shortDesc",
        p.long_desc        AS "longDesc",
        p.team_name        AS "teamName",
        p.player_name      AS "playerName",
        p.gender,
        p.is_signed        AS "isSigned",
        p.is_authenticated AS "isAuthenticated",
        p.is_framed        AS "isFramed",
        p.has_inscription  AS "hasInscription",
        p.inscription_text AS "inscriptionText",
        p.has_multi_sigs   AS "hasMultiSigs",
        p.is_protected     AS "isProtected",
        p.quantity,
        p.unit_price       AS "unitPrice",
        p.created_at       AS "createdAt",
        p.updated_at       AS "updatedAt",
        pc.name            AS category,
        pc.code            AS "categoryCode",
        ps.name            AS subcategory,
        ps.code            AS "subcategoryCode",
        pst.name           AS status,
        pst.code           AS "statusCode"
      FROM product p
      JOIN product_category     pc  ON pc.id  = p.category_id
      LEFT JOIN product_subcategory ps  ON ps.id  = p.subcategory_id
      JOIN product_status_type  pst ON pst.id = p.status_id
      ORDER BY p.created_at DESC
    `);

    const products    = productResult.rows as any[];
    const sellerIds   = [...new Set(products.map((p) => p.sellerId as string))];
    const sellerMap: Record<string, string> = {};

    if (sellerIds.length > 0) {
      const sellerResult = await acctPool.query(
        `SELECT id, first_name AS "firstName", last_name AS "lastName"
         FROM account WHERE id = ANY($1::uuid[])`,
        [sellerIds]
      );
      sellerResult.rows.forEach((r: any) => {
        sellerMap[r.id] = `${r.firstName} ${r.lastName}`;
      });
    }

    res.json(
      products.map((p) => ({ ...p, sellerName: sellerMap[p.sellerId] ?? "Unknown" }))
    );
  } catch (err) {
    logger.error("Get products error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/products/:id ───────────────────────────────────────────────────
router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
  const invPool  = getInventoryPool();
  const acctPool = getAccountPool();
  try {
    const result = await invPool.query(
      `SELECT p.*,
              pc.name  AS category,
              ps.name  AS subcategory,
              pst.name AS status
       FROM product p
       JOIN product_category     pc  ON pc.id  = p.category_id
       LEFT JOIN product_subcategory ps  ON ps.id  = p.subcategory_id
       JOIN product_status_type  pst ON pst.id = p.status_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rowCount) { res.status(404).json({ error: "Product not found" }); return; }

    const product = result.rows[0] as any;
    const acctRow = await acctPool.query(
      "SELECT first_name AS \"firstName\", last_name AS \"lastName\" FROM account WHERE id = $1",
      [product.seller_id]
    );
    product.sellerName = acctRow.rows[0]
      ? `${acctRow.rows[0].firstName} ${acctRow.rows[0].lastName}`
      : "Unknown";

    res.json(product);
  } catch (err) {
    logger.error("Get product detail error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/products/status ───────────────────────────────────────────────
/**
 * Bulk update the status of one or more products.
 * Body: { productIds: string[], status: "active" | "suspended", reason?: string }
 *
 * status = "active"    → product_activations RSS feed
 * status = "suspended" → product_blocks RSS feed
 */
router.post("/products/status", async (req: Request, res: Response): Promise<void> => {
  const { productIds, status, reason } = req.body as {
    productIds: string[];
    status:     "active" | "suspended";
    reason?:    string;
  };

  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ error: "productIds must be a non-empty array." }); return;
  }
  if (status !== "active" && status !== "suspended") {
    res.status(400).json({ error: "status must be 'active' or 'suspended'." }); return;
  }

  const invPool = getInventoryPool();
  try {
    // Resolve target status id
    const statusRow = await invPool.query(
      "SELECT id FROM product_status_type WHERE name = $1", [status]
    );
    if (!statusRow.rowCount) {
      res.status(500).json({ error: `Status '${status}' not found in inventory DB.` }); return;
    }
    const statusId = statusRow.rows[0].id as string;

    // Bulk update
    const updateResult = await invPool.query(
      `UPDATE product SET status_id = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [statusId, productIds]
    );

    logger.info(`Admin set ${updateResult.rowCount} product(s) to '${status}'`);

    // Publish Kafka event
    await publishEvent(TOPICS.PRODUCT_EVENTS, "product-status", {
      eventType: "PRODUCT_STATUS_UPDATED", status, productIds,
      count: updateResult.rowCount, occurredAt: new Date().toISOString(),
    });

    if ((updateResult.rowCount ?? 0) > 0) {
      // Fetch full product details for RSS metadata
      const productRows = await invPool.query(
        `SELECT p.id, p.name, p.short_desc AS "shortDesc", p.long_desc AS "longDesc",
                p.quantity, p.unit_price AS "unitPrice"
         FROM product p WHERE p.id = ANY($1::uuid[])`,
        [productIds]
      );

      for (const product of productRows.rows as any[]) {
        if (status === "active") {
          // ── product_activations: Product ID, Name, Description, Quantity, Unit Price
          await insertRssFeedItem({
            feedTypeName: "product_activations",
            title:        `Product activated: "${product.name as string}"`,
            description:
              `Admin activated product "${product.name as string}". ` +
              `${product.shortDesc ? (product.shortDesc as string) + " " : ""}` +
              `Qty: ${product.quantity}, Price: $${product.unitPrice}`,
            referenceId:  product.id as string,
            metadata: {
              productId:   product.id,
              productName: product.name,
              description: product.shortDesc ?? product.longDesc ?? "",
              quantity:    product.quantity,
              unitPrice:   Number(product.unitPrice).toFixed(2),
            },
          });
        } else {
          // ── product_blocks: Product ID, Name, Reason for Block
          await insertRssFeedItem({
            feedTypeName: "product_blocks",
            title:        `Product blocked: "${product.name as string}"`,
            description:
              `Admin suspended product "${product.name as string}".` +
              (reason ? ` Reason: ${reason}` : ""),
            referenceId:  product.id as string,
            metadata: {
              productId:   product.id,
              productName: product.name,
              reason:      reason ?? "No reason provided",
            },
          });
        }
      }
    }

    res.json({
      message: `${updateResult.rowCount} product(s) set to '${status}'.`,
      count:   updateResult.rowCount,
    });
  } catch (err) {
    logger.error("Product status update error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/internal/seed ─────────────────────────────────────────────────
router.post(
  "/internal/seed",
  async (req: Request, res: Response): Promise<void> => {
    const secret = req.headers["x-internal-secret"];
    if (secret !== (process.env.INTERNAL_SECRET || "internal-secret")) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const pool = getPool();
    try {
      const notifTypes = (await pool.query("SELECT COUNT(*) FROM notification_type")).rows[0].count;
      const svcTypes   = (await pool.query("SELECT COUNT(*) FROM service_type")).rows[0].count;
      const notifs     = (await pool.query("SELECT COUNT(*) FROM notification")).rows[0].count;
      res.json({
        service: "AdminService",
        notification_types: parseInt(notifTypes),
        service_types:      parseInt(svcTypes),
        notifications:      parseInt(notifs),
        message: "Admin reference data verified",
      });
    } catch (err) {
      logger.error("Seed check error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── Mount RSS routes under /rss/* ────────────────────────────────────────────
// Nesting here avoids the Express prefix-stripping issue that occurs when
// /admin and /admin/rss are both registered as separate app.use() mounts.
router.use("/rss", rssRoutes);

export default router;
