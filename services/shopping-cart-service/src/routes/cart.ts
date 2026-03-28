/**
 * @fileoverview ShoppingCartService route handlers — placeholder + seed
 * @module routes/cart.ts
 * @author Darrell Hobson
 * @Date 2026.03.07
 */

import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { requireAuth } from "../middleware/authGuard";
import { requireRole } from "../middleware/requireRole";
import { publishEvent, TOPICS } from "../kafka/client";
import { logger }               from "../logger";

const router = Router();

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  if (req.headers["x-internal-secret"] !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  next();
}

router.get("/test", (_req: Request, res: Response) => {
  res.json({ message: "Shopping cart routes working" });
});

async function getOrCreateCartId(buyerId: string): Promise<string> {
  const pool = getPool();

  const existing = await pool.query(
    `SELECT id FROM shopping_cart WHERE buyer_id = $1 LIMIT 1`,
    [buyerId]
  );

  if (existing.rowCount && existing.rows[0]?.id) {
    return existing.rows[0].id as string;
  }

  const created = await pool.query(
    `INSERT INTO shopping_cart (buyer_id)
     VALUES ($1)
     RETURNING id`,
    [buyerId]
  );

  return created.rows[0].id as string;
}

// GET /cart
router.get("/", requireAuth, requireRole("buyer"), async (req: Request, res: Response) => {
  const pool = getPool();
  const buyerId = (req as any).user.sub;

  try {
    const cartId = await getOrCreateCartId(buyerId);

    const result = await pool.query(
      `SELECT
         sci.product_id AS "productId",
         sci.quantity,
         sci.unit_price AS "unitPrice"
       FROM shopping_cart_items sci
       WHERE sci.shopping_cart_id = $1
       ORDER BY sci.added_at DESC`,
      [cartId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /cart/items
router.post("/items", requireAuth, requireRole("buyer"), async (req: Request, res: Response) => {
  const pool = getPool();
  const buyerId = (req as any).user.sub;
  const { productId, quantity, unitPrice } = req.body as {
    productId?: string;
    quantity?: number;
    unitPrice?: number;
  };

  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  const qty = quantity && quantity > 0 ? quantity : 1;

  if (unitPrice === undefined || unitPrice === null) {
    res.status(400).json({ error: "unitPrice is required" });
    return;
  }

  try {
    const cartId = await getOrCreateCartId(buyerId);

    const existing = await pool.query(
      `SELECT id, quantity
       FROM shopping_cart_items
       WHERE shopping_cart_id = $1 AND product_id = $2`,
      [cartId, productId]
    );

    if (existing.rowCount && existing.rows[0]?.id) {
      const updated = await pool.query(
        `UPDATE shopping_cart_items
         SET quantity = quantity + $1
         WHERE id = $2
         RETURNING id, product_id AS "productId", quantity, unit_price AS "unitPrice"`,
        [qty, existing.rows[0].id]
      );

      res.json(updated.rows[0]);
      return;
    }

    const inserted = await pool.query(
      `INSERT INTO shopping_cart_items (shopping_cart_id, product_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)
       RETURNING id, product_id AS "productId", quantity, unit_price AS "unitPrice"`,
      [cartId, productId, qty, unitPrice]
    );

    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /cart/items/:productId
router.delete("/items/:productId", requireAuth, requireRole("buyer"), async (req: Request, res: Response) => {
  const pool = getPool();
  const buyerId = (req as any).user.sub;
  const productId = req.params.productId;

  try {
    const cartId = await getOrCreateCartId(buyerId);

    const deleted = await pool.query(
      `DELETE FROM shopping_cart_items
       WHERE shopping_cart_id = $1 AND product_id = $2
       RETURNING id`,
      [cartId, productId]
    );

    if (!deleted.rowCount) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }

    res.json({ message: "Item removed from cart" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;