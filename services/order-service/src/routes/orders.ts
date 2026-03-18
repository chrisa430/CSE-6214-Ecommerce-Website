import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { getCartPool } from "../db/cartPool";
import { requireAuth } from "../middleware/authGuard";
import { requireRole } from "../middleware/requireRole";
import { getInventoryPool } from "../db/inventoryPool";

const router = Router();

router.get("/test", (_req: Request, res: Response) => {
  res.json({ message: "Order routes working" });
});

router.post("/checkout", requireAuth, requireRole("buyer"), async (req: Request, res: Response) => {
  const orderPool = getPool();
  const cartPool = getCartPool();
  const inventoryPool = getInventoryPool();
  const buyerId = (req as any).user.sub;

  try {
    const cartResult = await cartPool.query(
      `SELECT id FROM shopping_cart WHERE buyer_id = $1 LIMIT 1`,
      [buyerId]
    );

    if (!cartResult.rowCount) {
      res.status(400).json({ error: "Shopping cart not found" });
      return;
    }

    const cartId = cartResult.rows[0].id as string;

    const itemResult = await cartPool.query(
      `SELECT
         product_id AS "productId",
         quantity,
         unit_price AS "unitPrice"
       FROM shopping_cart_items
       WHERE shopping_cart_id = $1`,
      [cartId]
    );

    const items = itemResult.rows;

    if (items.length === 0) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
      0
    );
    const tax = subtotal * 0.07;
    const total = subtotal + tax;

    const currencyRow = await orderPool.query(
      `SELECT id FROM currency_type WHERE name = 'USD' LIMIT 1`
    );

    const orderInsert = await orderPool.query(
      `INSERT INTO "order" (buyer_id, currency, shopping_cart_id, subtotal, tax, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         buyer_id AS "buyerId",
         subtotal,
         tax,
         total,
         created_at AS "createdAt"`,
      [buyerId, currencyRow.rows[0].id, cartId, subtotal, tax, total]
    );

    const orderId = orderInsert.rows[0].id as string;

    for (const item of items) {
      const productResult = await inventoryPool.query(
        `SELECT quantity, name
         FROM product
         WHERE id = $1`,
        [item.productId]
      );

      if (
        productResult.rowCount === 0 ||
        Number(productResult.rows[0].quantity) < Number(item.quantity)
      ) {
        res.status(400).json({ error: "Insufficient inventory for product" });
        return;
      }

      const imageResult = await inventoryPool.query(
        `SELECT
           COALESCE(
             (SELECT image_url
              FROM product_image
              WHERE product_id = $1
              LIMIT 1),
             '/images/default-product.png'
           ) AS "imageUrl"`,
        [item.productId]
      );

      const productName = productResult.rows[0].name as string;
      const imageUrl =
        (imageResult.rows[0]?.imageUrl as string | undefined) ||
        "/images/default-product.png";

      await orderPool.query(
        `INSERT INTO completed_order_items
           (order_id, product_id, quantity, unit_price, name, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.productId,
          item.quantity,
          item.unitPrice,
          productName,
          imageUrl,
        ]
      );

      const updateResult = await inventoryPool.query(
        `UPDATE product
         SET quantity = quantity - $1
         WHERE id = $2
           AND quantity >= $1
         RETURNING id`,
        [item.quantity, item.productId]
      );

      if (updateResult.rowCount === 0) {
        res.status(400).json({ error: "Inventory changed before checkout could complete" });
        return;
      }
    }

    await cartPool.query(
      `DELETE FROM shopping_cart_items WHERE shopping_cart_id = $1`,
      [cartId]
    );

    res.status(201).json({
      message: "Checkout completed",
      order: orderInsert.rows[0],
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/mine", requireAuth, requireRole("buyer"), async (req: Request, res: Response) => {
  const pool = getPool();
  const buyerId = (req as any).user.sub;

  try {
    const ordersResult = await pool.query(
      `SELECT
         o.id,
         o.subtotal,
         o.tax,
         o.total,
         o.created_at AS "createdAt"
       FROM "order" o
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC`,
      [buyerId]
    );

    const orders = ordersResult.rows;

    for (const order of orders) {
      const itemsResult = await pool.query(
        `SELECT
           coi.product_id AS "productId",
           coi.quantity,
           coi.unit_price AS "unitPrice",
           coi.name,
           coi.image_url AS "imageUrl"
         FROM completed_order_items coi
         WHERE coi.order_id = $1`,
        [order.id]
      );

      order.items = itemsResult.rows;
    }

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

export default router;