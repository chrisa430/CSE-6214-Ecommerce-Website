/**
 * @fileoverview RSS feed routes — subscription management + RSS 2.0 feed generation
 * @module routes/rss.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Seller subscription endpoints (require seller JWT):
 *   GET    /rss/feed-types              — list all four feed channels + subscription status
 *   GET    /rss/subscriptions           — seller's current subscriptions
 *   POST   /rss/subscribe               — subscribe; body: { feedTypes[], emailAlerts? }
 *   DELETE /rss/unsubscribe             — unsubscribe; body: { feedTypes[] }
 *
 * RSS 2.0 XML feeds (public, no auth):
 *   GET    /rss/product_activations.xml
 *   GET    /rss/product_sales.xml
 *   GET    /rss/product_returns.xml
 *   GET    /rss/account_blocks.xml
 *
 * Admin dashboard endpoints (require admin JWT):
 *   GET    /rss/feeds                   — all feed items with optional ?type= filter
 *   GET    /rss/admin/summary           — per-feed counts + recent items
 *   GET    /rss/admin/subscribers       — all subscriptions with seller details
 */
import { Router, Request, Response } from "express";
import { requireAuth }               from "../middleware/authGuard";
import { requireRole }               from "../middleware/requireRole";
import { getPool }                   from "../db/pool";
import { getAccountPool }            from "../db/accountPool";
import { logger }                    from "../logger";

const router = Router();

// ── GET /rss/health — no auth, confirms RSS tables exist ─────────────────────
router.get("/health", async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const r = await pool.query(
      "SELECT COUNT(*)::int AS count FROM rss_feed_type"
    );
    res.json({
      status:     "ok",
      feedTypes:  r.rows[0].count,
      ts:         new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: "error", detail: msg });
  }
});

const VALID_FEED_TYPES = [
  "product_activations",
  "product_blocks",
  "product_sales",
  "product_returns",
  "account_blocks",
] as const;

type FeedTypeName = typeof VALID_FEED_TYPES[number];

// ── GET /rss/feed-types ───────────────────────────────────────────────────────
// Returns all four feed types. When a seller JWT is present, enriches each
// row with the seller's current subscription status and email_alerts setting.

router.get(
  "/feed-types",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const pool   = getPool();
    const user   = (req as any).user;
    const isSeller = user?.type === "seller";

    try {
      const typesResult = await pool.query(
        `SELECT id, name, short_desc AS "shortDesc", long_desc AS "longDesc"
         FROM rss_feed_type ORDER BY name`
      );

      if (!isSeller) {
        res.json(typesResult.rows);
        return;
      }

      // Enrich with this seller's subscription state
      const subsResult = await pool.query(
        `SELECT feed_type_id AS "feedTypeId", email_alerts AS "emailAlerts"
         FROM rss_subscription WHERE seller_id = $1`,
        [user.sub]
      );
      const subMap = new Map(
        subsResult.rows.map((r: any) => [r.feedTypeId as string, r.emailAlerts as boolean])
      );

      const enriched = typesResult.rows.map((ft: any) => ({
        ...ft,
        subscribed:   subMap.has(ft.id),
        emailAlerts:  subMap.get(ft.id) ?? false,
      }));

      res.json(enriched);
    } catch (err) {
      logger.error("Get feed types error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /rss/subscriptions ────────────────────────────────────────────────────

router.get(
  "/subscriptions",
  requireAuth,
  requireRole("seller"),
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = (req as any).user.sub as string;
    const pool     = getPool();
    try {
      const result = await pool.query(
        `SELECT rs.id,
                rft.name        AS "feedType",
                rft.short_desc  AS "feedLabel",
                rs.email_alerts AS "emailAlerts",
                rs.subscribed_at AS "subscribedAt"
         FROM rss_subscription rs
         JOIN rss_feed_type rft ON rft.id = rs.feed_type_id
         WHERE rs.seller_id = $1
         ORDER BY rft.name`,
        [sellerId]
      );
      res.json(result.rows);
    } catch (err) {
      logger.error("Get subscriptions error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /rss/subscribe ───────────────────────────────────────────────────────
// Body: { feedTypes: string[], emailAlerts?: boolean }

router.post(
  "/subscribe",
  requireAuth,
  requireRole("seller"),
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = (req as any).user.sub as string;
    const { feedTypes, emailAlerts = true } = req.body as {
      feedTypes:    string[];
      emailAlerts?: boolean;
    };

    if (!Array.isArray(feedTypes) || feedTypes.length === 0) {
      res.status(400).json({ error: "feedTypes must be a non-empty array" });
      return;
    }

    const invalid = feedTypes.filter(
      (t) => !(VALID_FEED_TYPES as readonly string[]).includes(t)
    );
    if (invalid.length > 0) {
      res.status(400).json({
        error: `Invalid feed type(s): ${invalid.join(", ")}. Valid: ${VALID_FEED_TYPES.join(", ")}`,
      });
      return;
    }

    const pool       = getPool();
    const subscribed: string[] = [];

    try {
      for (const name of feedTypes) {
        const ftRow = await pool.query(
          "SELECT id FROM rss_feed_type WHERE name = $1", [name]
        );
        if (!ftRow.rowCount) continue;

        await pool.query(
          `INSERT INTO rss_subscription (seller_id, feed_type_id, email_alerts)
           VALUES ($1, $2, $3)
           ON CONFLICT (seller_id, feed_type_id)
           DO UPDATE SET email_alerts = EXCLUDED.email_alerts`,
          [sellerId, ftRow.rows[0].id, emailAlerts]
        );
        subscribed.push(name);
      }

      logger.info(
        `[RSS] Seller ${sellerId} subscribed to [${subscribed.join(", ")}] ` +
        `emailAlerts=${emailAlerts}`
      );
      res.json({
        message:     "Subscriptions updated successfully",
        subscribed,
        emailAlerts,
      });
    } catch (err) {
      logger.error("Subscribe error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── DELETE /rss/unsubscribe ───────────────────────────────────────────────────
// Body: { feedTypes: string[] }

router.delete(
  "/unsubscribe",
  requireAuth,
  requireRole("seller"),
  async (req: Request, res: Response): Promise<void> => {
    const sellerId  = (req as any).user.sub as string;
    const { feedTypes } = req.body as { feedTypes?: string[] };

    if (!Array.isArray(feedTypes) || feedTypes.length === 0) {
      res.status(400).json({ error: "feedTypes must be a non-empty array" });
      return;
    }

    const pool    = getPool();
    let   removed = 0;

    try {
      for (const name of feedTypes) {
        const ftRow = await pool.query(
          "SELECT id FROM rss_feed_type WHERE name = $1", [name]
        );
        if (!ftRow.rowCount) continue;
        const r = await pool.query(
          "DELETE FROM rss_subscription WHERE seller_id = $1 AND feed_type_id = $2",
          [sellerId, ftRow.rows[0].id]
        );
        removed += r.rowCount ?? 0;
      }

      logger.info(`[RSS] Seller ${sellerId} unsubscribed from [${feedTypes.join(", ")}]`);
      res.json({ message: "Unsubscribed successfully", removed });
    } catch (err) {
      logger.error("Unsubscribe error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /rss/feeds — all feed items (seller or admin) ────────────────────────

router.get(
  "/feeds",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const pool  = getPool();
    const limit = Math.min(parseInt((req.query["limit"] as string) ?? "100"), 500);
    const type  = (req.query["type"] as string) ?? "";

    try {
      const params: unknown[] = [limit];
      let whereClause = "";
      if (type) {
        params.push(type);
        whereClause = `WHERE rft.name = $${params.length}`;
      }

      const result = await pool.query(
        `SELECT rfi.id,
                rft.name       AS "feedType",
                rft.short_desc AS "feedLabel",
                rfi.title,
                rfi.description,
                rfi.link,
                rfi.author,
                rfi.reference_id AS "referenceId",
                rfi.metadata,
                rfi.occurred_at  AS "occurredAt"
         FROM rss_feed_item rfi
         JOIN rss_feed_type rft ON rft.id = rfi.feed_type_id
         ${whereClause}
         ORDER BY rfi.occurred_at DESC
         LIMIT $1`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      logger.error("Get feeds error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /rss/admin/summary ────────────────────────────────────────────────────

router.get(
  "/admin/summary",
  requireAuth,
  requireRole("admin"),
  async (_req: Request, res: Response): Promise<void> => {
    const pool = getPool();
    try {
      const counts = await pool.query(
        `SELECT rft.name        AS "feedType",
                rft.short_desc  AS label,
                COUNT(DISTINCT rfi.id)::int        AS "itemCount",
                COUNT(DISTINCT rs.seller_id)::int  AS "subscriberCount"
         FROM rss_feed_type rft
         LEFT JOIN rss_feed_item    rfi ON rfi.feed_type_id = rft.id
         LEFT JOIN rss_subscription rs  ON rs.feed_type_id  = rft.id
         GROUP BY rft.id, rft.name, rft.short_desc
         ORDER BY rft.name`
      );
      const recent = await pool.query(
        `SELECT rfi.id,
                rft.name AS "feedType",
                rfi.title,
                rfi.occurred_at AS "occurredAt"
         FROM rss_feed_item rfi
         JOIN rss_feed_type rft ON rft.id = rfi.feed_type_id
         ORDER BY rfi.occurred_at DESC LIMIT 20`
      );
      res.json({ summary: counts.rows, recentItems: recent.rows });
    } catch (err) {
      logger.error("Admin RSS summary error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /rss/admin/subscribers ────────────────────────────────────────────────

router.get(
  "/admin/subscribers",
  requireAuth,
  requireRole("admin"),
  async (_req: Request, res: Response): Promise<void> => {
    const pool        = getPool();
    const accountPool = getAccountPool();
    try {
      const subs = await pool.query(
        `SELECT rs.id,
                rs.seller_id      AS "sellerId",
                rft.name          AS "feedType",
                rft.short_desc    AS "feedLabel",
                rs.email_alerts   AS "emailAlerts",
                rs.subscribed_at  AS "subscribedAt"
         FROM rss_subscription rs
         JOIN rss_feed_type rft ON rft.id = rs.feed_type_id
         ORDER BY rs.subscribed_at DESC`
      );

      const rows       = subs.rows as any[];
      const sellerIds  = [...new Set(rows.map((r) => r.sellerId as string))];
      const emailMap: Record<string, string> = {};

      if (sellerIds.length > 0) {
        const accts = await accountPool.query(
          `SELECT id,
                  user_id     AS email,
                  first_name  AS "firstName",
                  last_name   AS "lastName"
           FROM account WHERE id = ANY($1::uuid[])`,
          [sellerIds]
        );
        accts.rows.forEach((r: any) => {
          emailMap[r.id] = `${r.firstName} ${r.lastName} <${r.email}>`;
        });
      }

      res.json(
        rows.map((r) => ({
          ...r,
          sellerDisplay: emailMap[r.sellerId] ?? r.sellerId,
        }))
      );
    } catch (err) {
      logger.error("Admin subscribers error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /rss/:feedType.xml — RSS 2.0 XML feed (public, no auth) ──────────────

router.get("/:feedType.xml", async (req: Request, res: Response): Promise<void> => {
  const { feedType } = req.params;

  if (!(VALID_FEED_TYPES as readonly string[]).includes(feedType)) {
    res.status(404).send("Feed not found");
    return;
  }

  const pool    = getPool();
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5173";

  try {
    const ftRow = await pool.query(
      "SELECT id, short_desc FROM rss_feed_type WHERE name = $1",
      [feedType]
    );
    if (!ftRow.rowCount) { res.status(404).send("Feed not found"); return; }

    const feedTypeId: string = ftRow.rows[0].id;
    const feedLabel:  string = ftRow.rows[0].short_desc;

    const items = await pool.query(
      `SELECT id, title, description, link, author, metadata, occurred_at AS "occurredAt"
       FROM rss_feed_item
       WHERE feed_type_id = $1
       ORDER BY occurred_at DESC LIMIT 50`,
      [feedTypeId]
    );

    const esc = (s: string) =>
      (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const itemsXml = (items.rows as any[])
      .map((row) => {
        const meta: Record<string, unknown> = row.metadata ?? {};
        const extraFields = buildXmlFields(feedType as FeedTypeName, meta, esc);
        return `    <item>
      <title>${esc(row.title)}</title>
      <description>${esc(row.description ?? "")}</description>
      <link>${row.link ?? `${baseUrl}/seller/rss-feeds`}</link>
      <guid isPermaLink="false">${row.id as string}</guid>
      <pubDate>${new Date(row.occurredAt as string).toUTCString()}</pubDate>${extraFields}
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:sv="http://sportvault.io/rss/ext/1.0">
  <channel>
    <title>SportVault — ${esc(feedLabel)}</title>
    <link>${baseUrl}</link>
    <description>SportVault RSS feed: ${esc(feedLabel)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/api/admin/rss/${feedType}.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

    res.set("Content-Type", "application/rss+xml; charset=utf-8").send(xml);
  } catch (err) {
    logger.error(`RSS feed error for ${feedType}`, err);
    res.status(500).send("Internal server error");
  }
});


// ── XML field builder — injects structured metadata into RSS <item> ───────────


function buildXmlFields(
  feedType: FeedTypeName,
  meta: Record<string, unknown>,
  esc: (s: string) => string
): string {
  const f = (tag: string, val: unknown): string =>
    val != null ? `\n      <${tag}>${esc(String(val))}</${tag}>` : "";

  if (feedType === "product_activations") {
    return (
      f("sv:productId",   meta.productId)   +
      f("sv:productName", meta.productName) +
      f("sv:description", meta.description) +
      f("sv:quantity",    meta.quantity)    +
      f("sv:unitPrice",   meta.unitPrice)
    );
  }
  if (feedType === "product_blocks") {
    return (
      f("sv:productId",   meta.productId)   +
      f("sv:productName", meta.productName) +
      f("sv:reason",      meta.reason)
    );
  }
  if (feedType === "product_sales") {
    return (
      f("sv:orderId",     meta.orderId)     +
      f("sv:productId",   meta.productId)   +
      f("sv:productName", meta.productName) +
      f("sv:buyerName",   meta.buyerName)   +
      f("sv:productCost", meta.productCost)
    );
  }
  if (feedType === "product_returns") {
    return (
      f("sv:orderId",     meta.orderId)     +
      f("sv:productId",   meta.productId)   +
      f("sv:productName", meta.productName) +
      f("sv:buyerName",   meta.buyerName)   +
      f("sv:productCost", meta.productCost) +
      f("sv:reason",      meta.reason)
    );
  }
  if (feedType === "account_blocks") {
    return (
      f("sv:accountStatus", meta.accountStatus) +
      f("sv:reason",        meta.reason)
    );
  }
  return "";
}

export default router;
