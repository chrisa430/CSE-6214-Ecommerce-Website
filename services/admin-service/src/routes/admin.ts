/**
 * @fileoverview AdminService route handlers
 * @module routes/admin.ts
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * Routes exposed:
 *   GET  /admin/accounts/open        — list all accounts awaiting approval
 *   POST /admin/accounts/decision    — bulk approve or reject open accounts
 *   GET  /admin/products             — list all products (with seller name, category, status)
 *   GET  /admin/products/:id         — full product detail record
 *   POST /admin/products/status      — bulk set product status (active | suspended)
 */
import { Router, Request, Response } from "express";
import { getPool }                   from "../db/pool";
import { getAccountPool }            from "../db/accountPool";
import { getInventoryPool }          from "../db/inventoryPool";
import { getOrderPool }              from "../db/orderPool";
import { publishEvent, TOPICS }      from "../kafka/client";
import { logger }                    from "../logger";

const router = Router();

// ── GET /admin/accounts/open ─────────────────────────────────────────────────
/**
 * Returns all account records with status = 'open' (pending admin approval).
 * Called by the React frontend AdminSubpage.tsx via /api/admin/accounts/open.
 */
router.get("/accounts/open", async (_req: Request, res: Response): Promise<void> => {
  const accountPool = getAccountPool();
  try {
    const result = await accountPool.query(
      `SELECT
         a.id,
         a.user_id    AS email,
         a.first_name AS "firstName",
         a.last_name  AS "lastName",
         at.name      AS type,
         ast.name     AS status,
         a.created_at AS "createdAt"
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       WHERE ast.name = 'open'
       ORDER BY a.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Error fetching open accounts", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/accounts/decision ────────────────────────────────────────────
/**
 * Bulk approve or reject one or more open accounts.
 *
 * Body:
 *   { accountIds: string[], decision: "approve" | "reject" }
 *
 * On approve → status set to "active"
 * On reject  → status set to "closed"
 *
 * After updating accounts this handler also:
 *   1. Inserts a notification row (outbox) for each affected user
 *   2. Publishes an ADMIN_DECISION Kafka event
 */
router.post("/accounts/decision", async (req: Request, res: Response): Promise<void> => {
  const { accountIds, decision } = req.body as {
    accountIds: string[];
    decision:   "approve" | "reject";
  };

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    res.status(400).json({ error: "accountIds must be a non-empty array." });
    return;
  }
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "decision must be 'approve' or 'reject'." });
    return;
  }

  const accountPool = getAccountPool();
  const adminPool   = getPool();
  const newStatus   = decision === "approve" ? "active" : "closed";

  try {
    // ── 1. Resolve the target status id ──────────────────────────────────────
    const statusRow = await accountPool.query(
      "SELECT id FROM account_status WHERE name = $1",
      [newStatus]
    );
    if (!statusRow.rowCount) {
      res.status(500).json({ error: `Status '${newStatus}' not found in account DB.` });
      return;
    }
    const statusId = statusRow.rows[0].id as string;

    // ── 2. Update account status + audit log ─────────────────────────────────
    for (const accountId of accountIds) {
      // Set the appropriate date column alongside status
      const dateClause = decision === "approve"
        ? ", activated_date = NOW()"
        : decision === "reject"
        ? ", closed_date = NOW()"
        : "";

      await accountPool.query(
        `UPDATE account SET status_id = $1, updated_at = NOW()${dateClause} WHERE id = $2`,
        [statusId, accountId]
      );

      await accountPool.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [
          accountId,
          accountId,
          decision === "approve" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_REJECTED",
          `Account ${decision}d by admin`,
        ]
      );
    }

    // ── 3. Insert outbox notification for each affected user ─────────────────
    try {
      const notifTypeName = decision === "approve" ? "account activated" : "account closed";
      const [stRow, ntRow] = await Promise.all([
        adminPool.query("SELECT id FROM service_type      WHERE name = 'email'"),
        adminPool.query("SELECT id FROM notification_type WHERE name = $1", [notifTypeName]),
      ]);

      if (stRow.rowCount && ntRow.rowCount) {
        const serviceTypeId = stRow.rows[0].id as string;
        const notifTypeId   = ntRow.rows[0].id as string;
        const subject = decision === "approve"
          ? "Your SportVault Account Has Been Approved"
          : "Your SportVault Account Request Was Not Approved";
        const body = decision === "approve"
          ? "Congratulations! Your SportVault account has been approved. You may now sign in."
          : "We're sorry, your SportVault account request was not approved at this time. Please contact support if you have questions.";

        for (const accountId of accountIds) {
          await adminPool.query(
            `INSERT INTO notification
               (recipient_id, service_type, notification_type, subject, message_body,
                outbox_flag, sent_flag)
             VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
            [accountId, serviceTypeId, notifTypeId, subject, body]
          );
        }
        logger.info(`[Decision] Queued ${accountIds.length} decision notification(s)`);
      }
    } catch (notifErr) {
      // Non-fatal — log but don't fail the decision response
      logger.error("Failed to queue decision notifications", notifErr);
    }

    // ── 4. Publish Kafka event ────────────────────────────────────────────────
    await publishEvent(TOPICS.ADMIN_EVENTS, "decision", {
      eventType:  "ADMIN_DECISION",
      decision,
      accountIds,
      occurredAt: new Date().toISOString(),
    });

    logger.info(`Admin ${decision}d accounts: [${accountIds.join(", ")}]`);
    res.json({ message: `Accounts ${decision}d successfully.`, count: accountIds.length });
  } catch (err) {
    logger.error("Account decision error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;


// ── GET /admin/products ───────────────────────────────────────────────────────
/**
 * Returns all product records with category name, subcategory name, status name,
 * and seller first/last name resolved from the account database.
 */
router.get("/products", async (_req: Request, res: Response): Promise<void> => {
  const invPool  = getInventoryPool();
  const acctPool = getAccountPool();
  try {
    // Fetch products with joined reference tables
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
        p.created_at       AS "createdAt",
        p.updated_at       AS "updatedAt",
        pc.name            AS category,
        pc.code            AS "categoryCode",
        ps.name            AS subcategory,
        ps.code            AS "subcategoryCode",
        pst.name           AS status,
        pst.code           AS "statusCode",
        ct.name            AS condition,
        pct.name           AS "categoryType",
        pt.name            AS "protectionType"
      FROM product p
      JOIN product_category     pc  ON pc.id  = p.category_id
      JOIN product_status_type  pst ON pst.id = p.status_id
      LEFT JOIN product_subcategory  ps  ON ps.id  = p.subcategory_id
      LEFT JOIN condition_type       ct  ON ct.id  = p.condition_id
      LEFT JOIN product_category_type pct ON FALSE  -- join when category_type_id is added
      LEFT JOIN protection_type      pt  ON pt.id  = p.protection_type_id
      ORDER BY p.created_at DESC
    `);

    const products = productResult.rows;

    // Resolve seller names from account DB in one batch query
    const sellerIds = [...new Set(products.map((p) => p.sellerId as string))];
    let sellerMap: Record<string, { firstName: string; lastName: string }> = {};

    if (sellerIds.length > 0) {
      const sellerResult = await acctPool.query(
        `SELECT id, first_name AS "firstName", last_name AS "lastName"
         FROM account WHERE id = ANY($1::uuid[])`,
        [sellerIds]
      );
      sellerResult.rows.forEach((row) => {
        sellerMap[row.id] = { firstName: row.firstName, lastName: row.lastName };
      });
    }

    const enriched = products.map((p) => ({
      ...p,
      sellerFirstName: sellerMap[p.sellerId]?.firstName ?? "—",
      sellerLastName:  sellerMap[p.sellerId]?.lastName  ?? "—",
    }));

    res.json(enriched);
  } catch (err) {
    logger.error("Error fetching products", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/products/:id ───────────────────────────────────────────────────
/**
 * Returns the full detail record for a single product, including all columns
 * and resolved reference values.
 */
router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const invPool  = getInventoryPool();
  const acctPool = getAccountPool();
  try {
    const result = await invPool.query(`
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
        p.created_at       AS "createdAt",
        p.updated_at       AS "updatedAt",
        pc.name            AS category,
        pc.code            AS "categoryCode",
        ps.name            AS subcategory,
        ps.code            AS "subcategoryCode",
        pst.name           AS status,
        pst.code           AS "statusCode",
        ct.name            AS condition,
        ct.code            AS "conditionCode",
        pt.name            AS "protectionType"
      FROM product p
      JOIN product_category     pc  ON pc.id  = p.category_id
      JOIN product_status_type  pst ON pst.id = p.status_id
      LEFT JOIN product_subcategory  ps  ON ps.id  = p.subcategory_id
      LEFT JOIN condition_type       ct  ON ct.id  = p.condition_id
      LEFT JOIN protection_type      pt  ON pt.id  = p.protection_type_id
      WHERE p.id = $1
    `, [id]);

    if (!result.rowCount) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    const product = result.rows[0];

    // Resolve seller name
    const sellerResult = await acctPool.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName",
              user_id AS email
       FROM account WHERE id = $1`,
      [product.sellerId]
    );
    const seller = sellerResult.rows[0] ?? null;

    // Fetch product images
    const imageResult = await invPool.query(
      `SELECT id, name, short_desc AS "shortDesc", image_url AS "imageUrl",
              sort_order AS "sortOrder", is_primary AS "isPrimary"
       FROM product_image WHERE product_id = $1 ORDER BY sort_order`,
      [id]
    );

    res.json({
      ...product,
      sellerFirstName: seller?.firstName ?? "—",
      sellerLastName:  seller?.lastName  ?? "—",
      sellerEmail:     seller?.email     ?? "—",
      images: imageResult.rows,
    });
  } catch (err) {
    logger.error("Error fetching product detail", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/products/status ───────────────────────────────────────────────
/**
 * Bulk update the status of one or more products.
 *
 * Body:
 *   { productIds: string[], status: "active" | "suspended" }
 */
router.post("/products/status", async (req: Request, res: Response): Promise<void> => {
  const { productIds, status } = req.body as {
    productIds: string[];
    status:     "active" | "suspended";
  };

  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ error: "productIds must be a non-empty array." });
    return;
  }
  if (status !== "active" && status !== "suspended") {
    res.status(400).json({ error: "status must be 'active' or 'suspended'." });
    return;
  }

  const invPool = getInventoryPool();
  try {
    // Resolve target status id
    const statusRow = await invPool.query(
      "SELECT id FROM product_status_type WHERE name = $1",
      [status]
    );
    if (!statusRow.rowCount) {
      res.status(500).json({ error: `Status '${status}' not found in inventory DB.` });
      return;
    }
    const statusId = statusRow.rows[0].id as string;

    // Bulk update
    const updateResult = await invPool.query(
      `UPDATE product SET status_id = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [statusId, productIds]
    );

    logger.info(`Admin set ${updateResult.rowCount} product(s) to '${status}'`);

    // Publish Kafka event so downstream services can react
    await publishEvent(TOPICS.PRODUCT_EVENTS, "product-status", {
      eventType:  "PRODUCT_STATUS_UPDATED",
      status,
      productIds,
      count:      updateResult.rowCount,
      occurredAt: new Date().toISOString(),
    });

    res.json({
      message: `${updateResult.rowCount} product(s) set to '${status}'.`,
      count: updateResult.rowCount,
    });
  } catch (err) {
    logger.error("Product status update error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/internal/seed ─────────────────────────────────────────────────
// Seeds admin service reference data (notification_type, service_type).
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
      logger.info(`[Seed] AdminService: notification_type=${notifTypes}, service_type=${svcTypes}, notification=${notifs}`);
      res.json({
        service: "AdminService",
        notification_types: parseInt(notifTypes),
        service_types:      parseInt(svcTypes),
        notifications:      parseInt(notifs),
        message: "Admin reference data verified (seeded in init.sql)",
      });
    } catch (err) {
      logger.error("Seed error", err);
      res.status(500).json({ error: "Seed failed", detail: String(err) });
    }
  }
);
// ═══════════════════════════════════════════════════════════════════════════════
// ORDER MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /admin/orders/config ──────────────────────────────────────────────────
// Returns all system_config rows. ORDER_AGE env var is the runtime default;
// the DB value takes precedence once an admin saves it.
router.get("/orders/config", async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const result = await pool.query(
      "SELECT key, value, description, updated_at AS \"updatedAt\" FROM system_config ORDER BY key"
    );
    // Merge env-var defaults so the UI always gets a value even on a fresh DB
    const rows = result.rows as { key: string; value: string; description: string; updatedAt: string }[];
    const config: Record<string, string> = {
      order_age: process.env.ORDER_AGE || "60",
    };
    for (const row of rows) {
      config[row.key] = row.value;
    }
    res.json({
      config,
      rows,    // raw rows for detail (description, updated_at)
    });
  } catch (err) {
    logger.error("Get order config error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /admin/orders/config ──────────────────────────────────────────────────
// Updates a single system_config value.
// Body: { key: string; value: string }
router.put("/orders/config", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  const { key, value } = req.body as { key?: string; value?: string };

  if (!key || value === undefined) {
    res.status(400).json({ error: "key and value are required" });
    return;
  }

  // Validate known keys
  const ALLOWED_KEYS = new Set(["order_age"]);
  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: `Unknown config key: ${key}` });
    return;
  }

  // Type-specific validation
  if (key === "order_age") {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 365) {
      res.status(400).json({ error: "order_age must be an integer between 1 and 365" });
      return;
    }
  }

  try {
    await pool.query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
    logger.info(`[Config] ${key} updated to ${value}`);
    res.json({ message: "Configuration updated", key, value });
  } catch (err) {
    logger.error("Update order config error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/orders ─────────────────────────────────────────────────────────
// Returns all orders in the system with buyer name, seller name(s), total, status.
// Performs cross-DB lookups: order DB → inventory DB (seller_id) → account DB (names).
router.get("/orders", async (_req: Request, res: Response): Promise<void> => {
  const orderPool   = getOrderPool();
  const inventoryPool = getInventoryPool();
  const accountPool = getAccountPool();

  try {
    // ── 1. Fetch all orders ──────────────────────────────────────────────────
    const ordersResult = await orderPool.query(
      `SELECT
         o.id,
         o.buyer_id    AS "buyerId",
         o.total,
         os.name       AS status,
         o.created_at  AS "createdAt"
       FROM "order" o
       JOIN order_status os ON os.id = o.status_id
       ORDER BY o.created_at DESC`
    );
    const orders = ordersResult.rows as {
      id: string;
      buyerId: string;
      total: number;
      status: string;
      createdAt: string;
    }[];

    if (orders.length === 0) {
      res.json([]);
      return;
    }

    // ── 2. Collect unique buyer IDs and resolve names ────────────────────────
    const uniqueBuyerIds = [...new Set(orders.map((o) => o.buyerId))];
    const buyerResult = await accountPool.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName"
       FROM account
       WHERE id = ANY($1::uuid[])`,
      [uniqueBuyerIds]
    );
    const buyerMap = new Map<string, { firstName: string; lastName: string }>();
    for (const row of buyerResult.rows) {
      buyerMap.set(row.id, { firstName: row.firstName, lastName: row.lastName });
    }

    // ── 3. Fetch completed_order_items for all orders ────────────────────────
    const orderIds = orders.map((o) => o.id);
    const itemsResult = await orderPool.query(
      `SELECT order_id AS "orderId", product_id AS "productId"
       FROM completed_order_items
       WHERE order_id = ANY($1::uuid[])`,
      [orderIds]
    );
    // Map orderId → [productId]
    const orderProducts = new Map<string, string[]>();
    for (const row of itemsResult.rows) {
      const existing = orderProducts.get(row.orderId) ?? [];
      existing.push(row.productId);
      orderProducts.set(row.orderId, existing);
    }

    // ── 4. Resolve seller IDs from inventory DB ──────────────────────────────
    const allProductIds = [...new Set(itemsResult.rows.map((r) => r.productId))];
    const sellerIdMap = new Map<string, string>(); // productId → sellerId

    if (allProductIds.length > 0) {
      const sellerResult = await inventoryPool.query(
        `SELECT id, seller_id AS "sellerId" FROM product WHERE id = ANY($1::uuid[])`,
        [allProductIds]
      );
      for (const row of sellerResult.rows) {
        sellerIdMap.set(row.id, row.sellerId);
      }
    }

    // ── 5. Resolve seller names from account DB ──────────────────────────────
    const uniqueSellerIds = [...new Set([...sellerIdMap.values()])];
    const sellerMap = new Map<string, { firstName: string; lastName: string }>();

    if (uniqueSellerIds.length > 0) {
      const sellerNameResult = await accountPool.query(
        `SELECT id, first_name AS "firstName", last_name AS "lastName"
         FROM account
         WHERE id = ANY($1::uuid[])`,
        [uniqueSellerIds]
      );
      for (const row of sellerNameResult.rows) {
        sellerMap.set(row.id, { firstName: row.firstName, lastName: row.lastName });
      }
    }

    // ── 6. Assemble response ─────────────────────────────────────────────────
    const response = orders.map((order) => {
      const buyer = buyerMap.get(order.buyerId);
      const productIds = orderProducts.get(order.id) ?? [];

      const sellerIds = [...new Set(
        productIds.map((pid) => sellerIdMap.get(pid)).filter(Boolean) as string[]
      )];

      const sellerNames = sellerIds.map((sid) => {
        const s = sellerMap.get(sid);
        return s ? `${s.firstName} ${s.lastName}` : "Unknown Seller";
      });

      return {
        id:              order.id,
        buyerFirstName:  buyer?.firstName ?? "Unknown",
        buyerLastName:   buyer?.lastName  ?? "Buyer",
        sellerNames:     sellerNames.length > 0 ? sellerNames : ["—"],
        total:           Number(order.total),
        status:          order.status,
        createdAt:       order.createdAt,
      };
    });

    res.json(response);
  } catch (err) {
    logger.error("Get admin orders error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
