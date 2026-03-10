/**
 * @fileoverview OrderService route handlers — placeholder + seed
 * @module routes/orders.ts
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

// GET /orders/status — list all order statuses
router.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query("SELECT * FROM order_status ORDER BY name");
    res.json(result.rows);
  } catch (err) { logger.error("Get statuses error", err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /orders/currencies — list all currency types
router.get("/currencies", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query("SELECT * FROM currency_type ORDER BY name");
    res.json(result.rows);
  } catch (err) { logger.error("Get currencies error", err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /orders/:id — placeholder
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query(
      `SELECT o.*, cs.name AS status_name, ct.name AS currency_name
       FROM "order" o
       JOIN order_status os   ON os.id = o.status_id
       JOIN currency_type ct  ON ct.id = o.currency_id
       WHERE o.id = $1`, [req.params.id]
    );
    if (!result.rowCount) { res.status(404).json({ error: "Order not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) { logger.error("Get order error", err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /orders/internal/seed — seed reference + sample data
router.post("/internal/seed", requireInternalSecret as any, async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    // order_status and currency_type are seeded in init.sql — just verify counts
    const statuses   = (await pool.query("SELECT COUNT(*) FROM order_status")).rows[0].count;
    const currencies = (await pool.query("SELECT COUNT(*) FROM currency_type")).rows[0].count;

    // Seed 3 sample orders using placeholder buyer references
    const usdId  = (await pool.query("SELECT id FROM currency_type WHERE name = 'USD'")).rows[0]?.id;
    const openId = (await pool.query("SELECT id FROM order_status   WHERE name = 'pending'")).rows[0]?.id;

    let orders_inserted = 0;
    if (usdId && openId) {
      const r = await pool.query(
        `INSERT INTO "order" (buyer, currency_id, status_id, unit_cost, tax_percent, quantity) VALUES
           ('james.carter@demo.com',  $1, $2, 149.99, 0.08, 1),
           ('priya.sharma@demo.com',  $1, $2, 299.00, 0.08, 2),
           ('marcus.lewis@demo.com',  $1, $2,  89.50, 0.06, 1)`,
        [usdId, openId]
      );
      orders_inserted = r.rowCount ?? 0;
    }

    const orders_total = (await pool.query(`SELECT COUNT(*) FROM "order"`)).rows[0].count;
    logger.info(`[Seed] order_status: ${statuses}, currency_type: ${currencies}, orders: ${orders_total}`);
    res.json({
      service: "OrderService",
      order_statuses: parseInt(statuses),
      currency_types: parseInt(currencies),
      orders_inserted,
      orders_total: parseInt(orders_total),
    });
  } catch (err) { logger.error("Seed error", err); res.status(500).json({ error: "Seed failed", detail: String(err) }); }
});

export default router;
