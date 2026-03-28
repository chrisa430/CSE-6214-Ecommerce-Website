/**
 * @fileoverview SellerService route handlers — placeholder + seed
 * @module routes/sellers.ts
 * @author Darrell Hobson
 * @Date 2026.03.07
 */
import { Router, Request, Response } from "express";
import { getPool }              from "../db/pool";
import { logger }               from "../logger";

const router = Router();

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  if (req.headers["x-internal-secret"] !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  next();
}

// GET /sellers/:id — fetch seller profile (placeholder)
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query(
      `SELECT sp.*, ss.name AS status_name
       FROM seller_profile sp
       JOIN seller_status ss ON ss.id = sp.status_id
       WHERE sp.seller_id = $1`, [req.params.id]
    );
    if (!result.rowCount) { res.status(404).json({ error: "Seller not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) { logger.error("Get seller error", err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /sellers/:id/ratings — fetch ratings (placeholder)
router.get("/:id/ratings", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query(
      "SELECT * FROM seller_rating WHERE seller_id = $1 ORDER BY created_at DESC", [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { logger.error("Get ratings error", err); res.status(500).json({ error: "Internal server error" }); }
});

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
