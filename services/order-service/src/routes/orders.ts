/**
 * @fileoverview OrderService route handlers — placeholder + seed
 * @module routes/orders.ts
 * @author
 * @Date
 */
import { Router, Request, Response } from "express";
import { getPool }              from "../db/pool";
import { logger }               from "../logger";
import { getCartPool } from "../db/cartPool";
import { requireAuth } from "../middleware/authGuard";
import { requireRole } from "../middleware/requireRole";
import { getInventoryPool } from "../db/inventoryPool";

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

// GET /orders/:id
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

// GET /orders/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await getPool().query(
            `SELECT o.id, o.buyer_id AS "buyerId", o.subtotal, o.tax, o.total,
                    o.created_at AS "createdAt", ct.name AS currency_name
             FROM "order" o
                      JOIN currency_type ct ON ct.id = o.currency
             WHERE o.id = $1`, [req.params.id]
        );
        if (!result.rowCount) { res.status(404).json({ error: "Order not found" }); return; }
        res.json(result.rows[0]);
    } catch (err) { logger.error("Get order error", err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /orders/internal/seed — verify order DB and insert sample orders
// Body: { buyerIds?: string[] } — buyer UUIDs from the account seed step
router.post("/internal/seed", requireInternalSecret as any, async (req: Request, res: Response): Promise<void> => {
    const pool = getPool();
    try {
        const statuses   = (await pool.query("SELECT COUNT(*) FROM order_status")).rows[0].count;
        const currencies = (await pool.query("SELECT COUNT(*) FROM currency_type")).rows[0].count;

        const buyerIds: string[] = (req.body as any).buyerIds ?? [];
        const usdRow = (await pool.query("SELECT id FROM currency_type WHERE name = 'USD'")).rows[0];

        // Use a placeholder UUID for shopping_cart_id — it is a cross-DB reference
        // with no FK constraint, so any valid UUID is acceptable for seed data.
        const PLACEHOLDER_CART_ID = "00000000-0000-0000-0000-000000000001";

        let orders_inserted = 0;
        if (usdRow && buyerIds.length > 0) {
            for (let i = 0; i < Math.min(3, buyerIds.length); i++) {
                const buyerId = buyerIds[i];
                await pool.query(
                    `INSERT INTO "order" (buyer_id, currency, shopping_cart_id, subtotal, tax, total)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [buyerId, usdRow.id, PLACEHOLDER_CART_ID,
                        100.00 + i * 50, (100.00 + i * 50) * 0.07,
                        (100.00 + i * 50) * 1.07]
                );
                orders_inserted++;
            }
        }

        const orders_total = (await pool.query(`SELECT COUNT(*) FROM "order"`)).rows[0].count;
        logger.info(`[Seed] order_status: ${statuses}, currency_type: ${currencies}, orders: ${orders_total}`);
        res.json({
            service: "OrderService",
            order_statuses: parseInt(statuses),
            currency_types: parseInt(currencies),
            orders_inserted,
            orders_total: parseInt(orders_total),
            message: "Order DB verified",
        });
    } catch (err) { logger.error("Seed error", err); res.status(500).json({ error: "Seed failed", detail: String(err) }); }
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

export default router;