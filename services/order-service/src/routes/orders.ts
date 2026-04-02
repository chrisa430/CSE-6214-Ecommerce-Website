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
import { getAdminPool }    from "../db/adminPool";
import { getAccountPool }  from "../db/accountPool";

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
                 os.name      AS status,
                 o.created_at AS "createdAt"
             FROM "order" o
                      JOIN order_status os ON os.id = o.status_id
             WHERE o.buyer_id = $1
             ORDER BY o.created_at DESC`,
            [buyerId]
        );

        const orders = ordersResult.rows;

        for (const order of orders) {
            const itemsResult = await pool.query(
                `SELECT
                     coi.id         AS "id",
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
                    os.name AS status, ct.name AS currency_name,
                    o.created_at AS "createdAt"
             FROM "order" o
                      JOIN order_status  os ON os.id = o.status_id
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
        const usdRow     = (await pool.query("SELECT id FROM currency_type WHERE name = 'USD'")).rows[0];
        const pendingRow = (await pool.query("SELECT id FROM order_status   WHERE name = 'pending'")).rows[0];

        // Use a placeholder UUID for shopping_cart_id — it is a cross-DB reference
        // with no FK constraint, so any valid UUID is acceptable for seed data.
        const PLACEHOLDER_CART_ID = "00000000-0000-0000-0000-000000000001";

        let orders_inserted = 0;
        if (usdRow && pendingRow && buyerIds.length > 0) {
            for (let i = 0; i < Math.min(3, buyerIds.length); i++) {
                const buyerId = buyerIds[i];
                await pool.query(
                    `INSERT INTO "order" (buyer_id, currency, shopping_cart_id, subtotal, tax, total, status_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [buyerId, usdRow.id, PLACEHOLDER_CART_ID,
                        100.00 + i * 50, (100.00 + i * 50) * 0.07,
                        (100.00 + i * 50) * 1.07, pendingRow.id]
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

        const pendingStatusRow = await orderPool.query(
            `SELECT id FROM order_status WHERE name = 'pending' LIMIT 1`
        );

        const orderInsert = await orderPool.query(
            `INSERT INTO "order" (buyer_id, currency, shopping_cart_id, subtotal, tax, total, status_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING
               id,
               buyer_id AS "buyerId",
               subtotal,
               tax,
               total,
               status_id AS "statusId",
               created_at AS "createdAt"`,
            [buyerId, currencyRow.rows[0].id, cartId, subtotal, tax, total, pendingStatusRow.rows[0].id]
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

// ═══════════════════════════════════════════════════════════════════════════════
// RETURN FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helper: send return notifications to buyer, seller, all admins ────────────
async function sendReturnNotifications(opts: {
    buyerId:     string;
    sellerId:    string;
    productName: string;
    orderId:     string;
    returnId:    string;
}): Promise<void> {
    const { buyerId, sellerId, productName, orderId, returnId } = opts;
    const adminPool   = getAdminPool();
    const accountPool = getAccountPool();
    const appBase     = process.env.APP_BASE_URL || "http://localhost:5173";

    try {
        // Lookup notification type IDs
        const [buyerTypeRow, sellerTypeRow, adminTypeRow, inAppRow] =
            await Promise.all([
                adminPool.query("SELECT id FROM notification_type WHERE name = 'return_initiated_buyer'  LIMIT 1"),
                adminPool.query("SELECT id FROM notification_type WHERE name = 'return_initiated_seller' LIMIT 1"),
                adminPool.query("SELECT id FROM notification_type WHERE name = 'return_initiated_admin'  LIMIT 1"),
                adminPool.query("SELECT id FROM service_type WHERE name = 'in_app' LIMIT 1"),
            ]);

        const buyerTypeId  = buyerTypeRow.rows[0]?.id;
        const sellerTypeId = sellerTypeRow.rows[0]?.id;
        const adminTypeId  = adminTypeRow.rows[0]?.id;
        const inAppId      = inAppRow.rows[0]?.id;

        if (!buyerTypeId || !sellerTypeId || !adminTypeId || !inAppId) {
            logger.warn("[Return] Notification type IDs not found — skipping notifications");
            return;
        }

        // 1. Buyer confirmation
        await adminPool.query(
            `INSERT INTO notification
             (recipient_id, service_type, notification_type, subject, message_body, outbox_flag)
             VALUES ($1, $2, $3, $4, $5, TRUE)`,
            [
                buyerId, inAppId, buyerTypeId,
                "Return Request Received",
                `Your return request for "${productName}" (Order #${orderId.slice(0,8).toUpperCase()}) has been received. ` +
                `You can track the status at ${appBase}/buyer/returns.`,
            ]
        );

        // 2. Seller notification
        await adminPool.query(
            `INSERT INTO notification
             (recipient_id, service_type, notification_type, subject, message_body, outbox_flag)
             VALUES ($1, $2, $3, $4, $5, TRUE)`,
            [
                sellerId, inAppId, sellerTypeId,
                "Return Request for Your Item",
                `A buyer has requested a return for "${productName}" from Order #${orderId.slice(0,8).toUpperCase()}. ` +
                `Please review the request at ${appBase}/seller/returns.`,
            ]
        );

        // 3. Admin notifications — one per admin account
        const admins = await accountPool.query(
            `SELECT a.id FROM account a
                                  JOIN account_type at ON at.id = a.type_id
             WHERE at.name = 'admin'`
        );
        for (const admin of admins.rows) {
            await adminPool.query(
                `INSERT INTO notification
                 (recipient_id, service_type, notification_type, subject, message_body, outbox_flag)
                 VALUES ($1, $2, $3, $4, $5, TRUE)`,
                [
                    admin.id, inAppId, adminTypeId,
                    "Return Request Initiated",
                    `A return has been initiated for "${productName}" (Order #${orderId.slice(0,8).toUpperCase()}). ` +
                    `Return ID: ${returnId}. Review at ${appBase}/admin/subpage#returns.`,
                ]
            );
        }

        logger.info(`[Return] Sent notifications for return ${returnId}`);
    } catch (err) {
        logger.error("[Return] Failed to send notifications (non-fatal)", err);
    }
}

// ── GET /orders/returns/mine — buyer's return requests ────────────────────────
router.get(
    "/returns/mine",
    requireAuth,
    requireRole("buyer"),
    async (req: Request, res: Response): Promise<void> => {
        const buyerId = (req as any).user.sub as string;
        const pool = getPool();
        try {
            const result = await pool.query(
                `SELECT
                     rr.id,
                     rr.order_id      AS "orderId",
                     rr.order_item_id AS "orderItemId",
                     rr.product_id    AS "productId",
                     rr.product_name  AS "productName",
                     rr.reason,
                     rs.name          AS status,
                     rr.created_at    AS "createdAt"
                 FROM return_request rr
                          JOIN return_status rs ON rs.id = rr.status_id
                 WHERE rr.buyer_id = $1
                 ORDER BY rr.created_at DESC`,
                [buyerId]
            );
            res.json(result.rows);
        } catch (err) {
            logger.error("Get buyer returns error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── GET /orders/returns/seller — seller's return requests ─────────────────────
router.get(
    "/returns/seller",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        const pool = getPool();
        try {
            // Step 1: resolve seller's product IDs from the inventory DB
            const invPool  = getInventoryPool();
            const products = await invPool.query(
                "SELECT id FROM product WHERE seller_id = $1", [sellerId]
            );
            const productIds = products.rows.map((r: any) => r.id as string);

            if (productIds.length === 0) {
                res.json([]);
                return;
            }

            // Step 2: query the order DB using those product IDs
            const result = await pool.query(
                `SELECT
           o.id                AS "orderId",
           o.total,
           o.created_at        AS "orderCreatedAt",
           os.name             AS "orderStatus",
           coi.id              AS "itemId",
           coi.product_id      AS "productId",
           coi.name            AS "productName",
           coi.quantity,
           coi.unit_price      AS "unitPrice",
           coi.image_url       AS "imageUrl",
           rr.id               AS "returnId",
           rs.name             AS "returnStatus",
           rr.reason           AS "returnReason",
           rr.seller_notes     AS "sellerNotes",
           rr.created_at       AS "returnCreatedAt",
           rr.buyer_id         AS "buyerId"
         FROM completed_order_items coi
         JOIN "order" o        ON o.id  = coi.order_id
         JOIN order_status os  ON os.id = o.status_id
         LEFT JOIN return_request rr ON rr.order_item_id = coi.id
         LEFT JOIN return_status rs  ON rs.id = rr.status_id
         WHERE coi.product_id = ANY($1::uuid[])
         ORDER BY o.created_at DESC`,
                [productIds]
            );
            res.json(result.rows);
        } catch (err) {
            logger.error("Get seller returns error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── POST /orders/:orderId/return — buyer initiates return for one item ────────
// Body: { orderItemId: string; reason?: string }
router.post(
    "/:orderId/return",
    requireAuth,
    requireRole("buyer"),
    async (req: Request, res: Response): Promise<void> => {
        const buyerId  = (req as any).user.sub as string;
        const orderId  = req.params.orderId;
        const { orderItemId, reason } = req.body as {
            orderItemId?: string;
            reason?: string;
        };

        if (!orderItemId) {
            res.status(400).json({ error: "orderItemId is required" });
            return;
        }

        const pool = getPool();

        try {
            // Verify order belongs to buyer
            const orderRow = await pool.query(
                `SELECT o.id, o.created_at AS "createdAt"
                 FROM "order" o WHERE o.id = $1 AND o.buyer_id = $2 LIMIT 1`,
                [orderId, buyerId]
            );
            if (!orderRow.rowCount) {
                res.status(404).json({ error: "Order not found" });
                return;
            }

            // Check return window (ORDER_AGE env var, default 60 days)
            const orderAge = parseInt(process.env.ORDER_AGE || "60", 10);
            const orderDate = new Date(orderRow.rows[0].createdAt);
            const daysSince = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > orderAge) {
                res.status(400).json({
                    error: `Return window has expired. Returns must be initiated within ${orderAge} days of purchase.`,
                });
                return;
            }

            // Verify item belongs to this order
            const itemRow = await pool.query(
                `SELECT coi.id, coi.product_id AS "productId", coi.name AS "productName"
                 FROM completed_order_items coi
                 WHERE coi.id = $1 AND coi.order_id = $2 LIMIT 1`,
                [orderItemId, orderId]
            );
            if (!itemRow.rowCount) {
                res.status(404).json({ error: "Order item not found" });
                return;
            }

            const { productId, productName } = itemRow.rows[0] as {
                productId: string; productName: string;
            };

            // Check for existing return request for this item
            const existing = await pool.query(
                "SELECT id FROM return_request WHERE order_item_id = $1 LIMIT 1",
                [orderItemId]
            );
            if (existing.rowCount) {
                res.status(409).json({ error: "A return request already exists for this item" });
                return;
            }

            // Resolve seller_id from inventory DB
            const invPool = getInventoryPool();
            const productRow = await invPool.query(
                "SELECT seller_id AS \"sellerId\" FROM product WHERE id = $1 LIMIT 1",
                [productId]
            );
            const sellerId: string = productRow.rows[0]?.sellerId ?? "00000000-0000-0000-0000-000000000000";

            // Resolve 'pending' return status id
            const pendingRow = await pool.query(
                "SELECT id FROM return_status WHERE name = 'pending' LIMIT 1"
            );
            if (!pendingRow.rowCount) {
                res.status(500).json({ error: "Return status 'pending' not found" });
                return;
            }

            // Insert return request
            const insertResult = await pool.query(
                `INSERT INTO return_request
                 (order_id, order_item_id, buyer_id, seller_id, product_id, product_name, status_id, reason)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING id, created_at AS "createdAt"`,
                [orderId, orderItemId, buyerId, sellerId, productId,
                    productName, pendingRow.rows[0].id, reason ?? null]
            );

            const returnId = insertResult.rows[0].id as string;

            // Send notifications (non-blocking — errors logged but don't fail the request)
            sendReturnNotifications({ buyerId, sellerId, productName, orderId, returnId })
                .catch((err) => logger.error("[Return] Notification dispatch error", err));

            logger.info(`[Return] Return ${returnId} initiated by buyer ${buyerId} for item ${orderItemId}`);

            res.status(201).json({
                message: "Return request initiated",
                returnId,
                orderId,
                orderItemId,
                productName,
                status: "pending",
                createdAt: insertResult.rows[0].createdAt,
            });
        } catch (err) {
            logger.error("Initiate return error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── PUT /orders/returns/action — seller bulk approve/decline/dispute ──────────
// Body: { returnIds: string[], action: 'approved'|'declined'|'disputed', notes?: string }
router.put(
    "/returns/action",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        const { returnIds, action, notes } = req.body as {
            returnIds?: string[];
            action?:    string;
            notes?:     string;
        };

        const VALID_ACTIONS = ["approved", "declined", "disputed"];
        if (!returnIds?.length) {
            res.status(400).json({ error: "returnIds array is required" });
            return;
        }
        if (!action || !VALID_ACTIONS.includes(action)) {
            res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(", ")}` });
            return;
        }

        const pool      = getPool();
        const adminPool = getAdminPool();
        const accountPool = getAccountPool();
        const appBase   = process.env.APP_BASE_URL || "http://localhost:5173";

        try {
            // Resolve target status id
            const statusRow = await pool.query(
                "SELECT id FROM return_status WHERE name = $1 LIMIT 1", [action]
            );
            if (!statusRow.rowCount) {
                res.status(500).json({ error: `Return status '${action}' not found` });
                return;
            }
            const statusId = statusRow.rows[0].id as string;

            // Fetch the return records — verify they belong to this seller
            const returnsResult = await pool.query(
                `SELECT rr.id, rr.buyer_id AS "buyerId", rr.seller_id AS "sellerId",
                        rr.product_name AS "productName", rr.order_id AS "orderId"
                 FROM return_request rr
                 WHERE rr.id = ANY($1::uuid[]) AND rr.seller_id = $2`,
                [returnIds, sellerId]
            );

            if (!returnsResult.rowCount) {
                res.status(404).json({ error: "No matching return requests found for this seller" });
                return;
            }

            const returns = returnsResult.rows as {
                id: string; buyerId: string; sellerId: string;
                productName: string; orderId: string;
            }[];

            // Update all matched records
            await pool.query(
                `UPDATE return_request
                 SET status_id = $1, seller_notes = $2, updated_at = NOW()
                 WHERE id = ANY($3::uuid[]) AND seller_id = $4`,
                [statusId, notes ?? null, returnIds, sellerId]
            );

            // Resolve notification type IDs
            const sellerTypeKey = `return_${action}_seller`;
            const buyerTypeKey  = `return_${action}_buyer`;
            const [sellerTypeRow, buyerTypeRow, adminTypeRow, inAppRow] = await Promise.all([
                adminPool.query("SELECT id FROM notification_type WHERE name = $1 LIMIT 1", [sellerTypeKey]),
                adminPool.query("SELECT id FROM notification_type WHERE name = $1 LIMIT 1", [buyerTypeKey]),
                adminPool.query("SELECT id FROM notification_type WHERE name = 'return_action_admin' LIMIT 1"),
                adminPool.query("SELECT id FROM service_type WHERE name = 'in_app' LIMIT 1"),
            ]);

            const sellerTypeId = sellerTypeRow.rows[0]?.id;
            const buyerTypeId  = buyerTypeRow.rows[0]?.id;
            const adminTypeId  = adminTypeRow.rows[0]?.id;
            const inAppId      = inAppRow.rows[0]?.id;

            const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
            const notesClause = notes ? ` Seller note: "${notes}"` : "";

            // Send notifications per return record
            for (const ret of returns) {
                const orderRef = ret.orderId.slice(0, 8).toUpperCase();

                // Seller confirmation
                if (sellerTypeId && inAppId) {
                    await adminPool.query(
                        `INSERT INTO notification
                         (recipient_id, service_type, notification_type, subject, message_body, outbox_flag)
                         VALUES ($1,$2,$3,$4,$5,TRUE)`,
                        [
                            ret.sellerId, inAppId, sellerTypeId,
                            `Return ${actionLabel}: "${ret.productName}"`,
                            `You have ${action} the return request for "${ret.productName}" ` +
                            `(Order #${orderRef}).${notesClause}`,
                        ]
                    );
                }

                // Buyer notification
                if (buyerTypeId && inAppId) {
                    let buyerMessage = "";
                    if (action === "approved") {
                        buyerMessage =
                            `Your return request for "${ret.productName}" (Order #${orderRef}) has been approved. ` +
                            `Please allow 5–7 business days for your refund to process.${notesClause}`;
                    } else if (action === "declined") {
                        buyerMessage =
                            `Your return request for "${ret.productName}" (Order #${orderRef}) has been declined by the seller.${notesClause} ` +
                            `If you believe this is in error, please contact support.`;
                    } else {
                        buyerMessage =
                            `Your return request for "${ret.productName}" (Order #${orderRef}) has been disputed by the seller.${notesClause} ` +
                            `This has been escalated to our admin team for review at ${appBase}/admin/subpage#returns.`;
                    }
                    await adminPool.query(
                        `INSERT INTO notification
                         (recipient_id, service_type, notification_type, subject, message_body, outbox_flag)
                         VALUES ($1,$2,$3,$4,$5,TRUE)`,
                        [ret.buyerId, inAppId, buyerTypeId,
                            `Return ${actionLabel}: "${ret.productName}"`, buyerMessage]
                    );
                }

                // Admin notification (only for declined and disputed)
                if ((action === "declined" || action === "disputed") && adminTypeId && inAppId) {
                    const admins = await accountPool.query(
                        `SELECT a.id FROM account a
                                              JOIN account_type at ON at.id = a.type_id WHERE at.name = 'admin'`
                    );
                    for (const admin of admins.rows) {
                        await adminPool.query(
                            `INSERT INTO notification
                             (recipient_id, service_type, notification_type, subject, message_body, outbox_flag)
                             VALUES ($1,$2,$3,$4,$5,TRUE)`,
                            [
                                admin.id, inAppId, adminTypeId,
                                `Return ${actionLabel} by Seller`,
                                `A seller has ${action} a return request for "${ret.productName}" ` +
                                `(Order #${orderRef}).${notesClause} ` +
                                `Review at ${appBase}/admin/subpage#returns.`,
                            ]
                        );
                    }
                }
            }

            logger.info(`[Return] Seller ${sellerId} ${action}d ${returns.length} return(s)`);

            res.json({
                message: `${returns.length} return request(s) ${action}d successfully`,
                action,
                updated: returns.length,
            });
        } catch (err) {
            logger.error("Return action error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

export default router;