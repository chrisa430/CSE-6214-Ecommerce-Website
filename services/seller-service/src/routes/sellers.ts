/**
 * @fileoverview SellerService route handlers — placeholder + seed
 * @module routes/sellers.ts
 * @author Darrell Hobson
 * @Date 2026.03.07
 */
import { Router, Request, Response } from "express";
import { getPool }              from "../db/pool";
import { getAccountPool }       from "../db/accountPool";
import { logger }               from "../logger";
import { requireAuth }          from "../middleware/authGuard";
import { requireRole }          from "../middleware/requireRole";

const router = Router();

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  if (req.headers["x-internal-secret"] !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  next();
}

// GET /sellers/:id — fetch seller profile (placeholder)
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    let result = await pool.query(
      `SELECT sp.*, ss.name AS status_name
       FROM seller_profile sp
       JOIN seller_status ss ON ss.id = sp.status_id
       WHERE sp.seller_id = $1`, [req.params.id]
    );

    // Auto-create a minimal profile the first time a seller is viewed
    if (!result.rowCount) {
      await pool.query(
        `INSERT INTO seller_profile (seller_id, status_id, store_name, bio)
         SELECT $1, ss.id, NULL, NULL
         FROM seller_status ss WHERE ss.name = 'active'
         ON CONFLICT (seller_id) DO NOTHING`,
        [req.params.id]
      );
      result = await pool.query(
        `SELECT sp.*, ss.name AS status_name
         FROM seller_profile sp
         JOIN seller_status ss ON ss.id = sp.status_id
         WHERE sp.seller_id = $1`, [req.params.id]
      );
    }

    if (!result.rowCount) { res.status(404).json({ error: "Seller not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) { logger.error("Get seller error", err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /sellers/:id/ratings — fetch ratings (placeholder)
router.get("/:id/ratings", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query(
      `SELECT id, buyer_id AS "buyerId", rating, review, created_at AS "createdAt"
       FROM seller_rating WHERE seller_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    const avg = await getPool().query(
      `SELECT ROUND(AVG(rating)::numeric, 1) AS average, COUNT(*) AS total
       FROM seller_rating WHERE seller_id = $1`,
      [req.params.id]
    );
    // Enrich each review with the buyer's name from the account DB
    const reviews = result.rows;
    if (reviews.length > 0) {
      const buyerIds = [...new Set(reviews.map((r: any) => r.buyerId))];
      const accounts = await getAccountPool().query(
        `SELECT id, first_name AS "firstName", last_name AS "lastName"
         FROM account WHERE id = ANY($1::uuid[])`,
        [buyerIds]
      );
      const nameMap: Record<string, { firstName: string; lastName: string }> = {};
      for (const row of accounts.rows) nameMap[row.id] = row;
      for (const r of reviews) {
        r.buyerFirstName = nameMap[r.buyerId]?.firstName ?? null;
        r.buyerLastName  = nameMap[r.buyerId]?.lastName  ?? null;
      }
    }

    res.json({
      reviews,
      averageRating: parseFloat(avg.rows[0].average) || null,
      totalReviews: parseInt(avg.rows[0].total),
    });
  } catch (err) { logger.error("Get seller reviews error", err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /sellers/:id/reviews — submit a seller review (buyer only)
// Body: { rating: 1-5, review?: string }
router.post(
  "/:id/reviews",
  requireAuth,
  requireRole("buyer"),
  async (req: Request, res: Response): Promise<void> => {
    const buyerId  = (req as any).user.sub as string;
    const sellerId = req.params.id;
    const { rating, review } = req.body as { rating?: number; review?: string };

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be an integer between 1 and 5" });
      return;
    }

    try {
      const seller = await getPool().query(
        "SELECT id FROM seller_profile WHERE seller_id = $1", [sellerId]
      );
      if (!seller.rowCount) {
        res.status(404).json({ error: "Seller not found" });
        return;
      }

      const result = await getPool().query(
        `INSERT INTO seller_rating (seller_id, buyer_id, rating, review)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (seller_id, buyer_id)
         DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review
         RETURNING id, buyer_id AS "buyerId", rating, review, created_at AS "createdAt"`,
        [sellerId, buyerId, rating, review ?? null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      logger.error("Submit seller review error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /sellers/internal/seed — seed seller reference data
router.post("/internal/seed", requireInternalSecret as any, async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const statuses = (await pool.query("SELECT COUNT(*) FROM seller_status")).rows[0].count;
    logger.info(`[Seed] seller_status: ${statuses} rows`);
    res.json({ service: "SellerService", seller_statuses: parseInt(statuses), message: "Seed complete" });
  } catch (err) { logger.error("Seed error", err); res.status(500).json({ error: "Seed failed", detail: String(err) }); }
});

export default router;
