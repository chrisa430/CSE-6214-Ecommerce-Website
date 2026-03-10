/**
 * @fileoverview ShoppingCartService route handlers — placeholder + seed
 * @module routes/cart.ts
 * @author Darrell Hobson
 * @Date 2026.03.07
 */
import { Router, Request, Response } from "express";
import { getPool }              from "../db/pool";
import { publishEvent, TOPICS } from "../kafka/client";
import { logger }               from "../logger";

const router = Router();

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  if (req.headers["x-internal-secret"] !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  next();
}

// POST /cart — create a cart (placeholder)
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { buyer } = req.body as { buyer?: string };
  if (!buyer) { res.status(400).json({ error: "buyer is required" }); return; }
  try {
    const result = await getPool().query(
      "INSERT INTO shopping_cart (buyer) VALUES ($1) RETURNING id, buyer, date_created",
      [buyer]
    );
    const cart = result.rows[0];

    await publishEvent(TOPICS.SHOPPING_CART_EVENTS, cart.id, {
      eventType:  "CART_CREATED",
      cartId:     cart.id,
      buyer:      cart.buyer,
      occurredAt: new Date().toISOString(),
    });

    res.status(201).json(cart);
  } catch (err) { logger.error("Create cart error", err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /cart/:id — fetch a cart with items (placeholder)
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const cart = await getPool().query("SELECT * FROM shopping_cart WHERE id = $1", [req.params.id]);
    if (!cart.rowCount) { res.status(404).json({ error: "Cart not found" }); return; }
    const items = await getPool().query("SELECT * FROM shopping_cart_item WHERE shopping_cart_id = $1", [req.params.id]);
    res.json({ ...cart.rows[0], items: items.rows });
  } catch (err) { logger.error("Get cart error", err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /cart/internal/seed — seed reference data
router.post("/internal/seed", requireInternalSecret as any, async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO shopping_cart (buyer) VALUES
         ('james.carter@demo.com'), ('priya.sharma@demo.com'), ('marcus.lewis@demo.com')
       ON CONFLICT DO NOTHING`
    );
    const total = (await pool.query("SELECT COUNT(*) FROM shopping_cart")).rows[0].count;
    logger.info(`[Seed] shopping_cart: ${total} rows`);
    res.json({ service: "ShoppingCartService", inserted: rowCount ?? 0, total_carts: parseInt(total) });
  } catch (err) { logger.error("Seed error", err); res.status(500).json({ error: "Seed failed", detail: String(err) }); }
});

export default router;
