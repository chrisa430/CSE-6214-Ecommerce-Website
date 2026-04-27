/**
 * @fileoverview InventoryService route handlers — seller CRUD + admin listing + seed
 * @module routes/inventory.ts
 * @author Darrell Hobson
 * @Date 2026.03.10 (seller routes merged 2026.03.29)
 *
 * Routes served at /inventory/* (prefix stripped by Vite proxy + Express mount):
 *
 *   Seller routes (auth required, seller role):
 *     GET  /inventory/products/active      — active products for buyer browsing
 *     GET  /inventory/products/mine        — seller's own listings
 *     POST /inventory/products             — create product (status → open)
 *     PATCH /inventory/products/:id        — update product fields
 *     PATCH /inventory/products/:id/image  — replace primary image
 *     DELETE /inventory/products/:id       — soft-delete (status → removed)
 *
 *   Reference / admin routes (no auth):
 *     GET  /inventory/categories           — list product categories
 *     GET  /inventory/products             — filtered list (admin/internal)
 *     GET  /inventory/products/:id         — full detail with images
 *
 *   Internal seed:
 *     POST /inventory/internal/seed        — populate test data
 *
 * Schema note: unit_price is stored on the product table. Routes accept and
 * return unitPrice for all seller and buyer-facing endpoints.
 */
import { Router, Request, Response } from "express";
import { getPool }              from "../db/pool";
import { getAccountPool }       from "../db/accountPool";
import { publishEvent, TOPICS } from "../kafka/client";
import { logger }               from "../logger";
import { requireAuth }          from "../middleware/authGuard";
import { requireRole }          from "../middleware/requireRole";

const router = Router();

// ── Guards ───────────────────────────────────────────────────────────────────

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
    if (req.headers["x-internal-secret"] !== (process.env.INTERNAL_SECRET || "internal-secret")) {
        res.status(403).json({ error: "Forbidden" }); return;
    }
    next();
}

// ── Helper: resolve a status_id by code ──────────────────────────────────────

async function getStatusId(code: string): Promise<string | null> {
    const r = await getPool().query(
        "SELECT id FROM product_status_type WHERE code = $1 LIMIT 1", [code]
    );
    return r.rows[0]?.id ?? null;
}

// ── GET /inventory/categories ─────────────────────────────────────────────────

router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await getPool().query(
            "SELECT id, name, code, gender FROM product_category ORDER BY name"
        );
        res.json(result.rows);
    } catch (err) {
        logger.error("Get categories error", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /inventory/products/active ────────────────────────────────────────────
// NOTE: registered BEFORE /:id to prevent 'active' being matched as a param.

router.get("/products/active", async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await getPool().query(
            `SELECT
                 p.id,
                 p.seller_id   AS "sellerId",
                 p.name,
                 p.short_desc  AS "shortDesc",
                 p.long_desc   AS "longDesc",
                 p.quantity,
                 p.unit_price  AS "unitPrice",
                 pst.name      AS status,
                 p.created_at  AS "createdAt",
                 p.updated_at  AS "updatedAt",
                 COALESCE(
                         (SELECT image_url FROM product_image
                          WHERE product_id = p.id AND is_primary = TRUE LIMIT 1),
           (SELECT image_url FROM product_image WHERE product_id = p.id LIMIT 1),
           '/images/default-product.png'
         ) AS "imageUrl"
             FROM product p
                      JOIN product_status_type pst ON pst.id = p.status_id
             WHERE pst.code = 'active'
               AND p.quantity > 0
             ORDER BY p.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        logger.error("Get active products error", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /inventory/products/mine ──────────────────────────────────────────────

router.get(
    "/products/mine",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        try {
            const result = await getPool().query(
                `SELECT
                     p.id,
                     p.name,
                     p.short_desc  AS "shortDesc",
                     p.long_desc   AS "longDesc",
                     p.quantity,
                     p.unit_price  AS "unitPrice",
                     pst.name      AS status,
                     p.created_at  AS "createdAt",
                     p.updated_at  AS "updatedAt",
                     COALESCE(
                             (SELECT image_url FROM product_image
                              WHERE product_id = p.id AND is_primary = TRUE LIMIT 1),
             (SELECT image_url FROM product_image WHERE product_id = p.id LIMIT 1),
             '/images/default-product.png'
           ) AS "imageUrl"
                 FROM product p
                          JOIN product_status_type pst ON pst.id = p.status_id
                 WHERE p.seller_id = $1
                   AND pst.code != 'removed'
                 ORDER BY p.created_at DESC`,
                [sellerId]
            );
            res.json(result.rows);
        } catch (err) {
            logger.error("Get mine error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── POST /inventory/products ──────────────────────────────────────────────────
// Body: { name, category (UUID from product_category.id), quantity,
//         shortDesc?, longDesc?, subCategory? (UUID) }
// Body: { name, category (UUID from product_category.id), quantity, unitPrice,

router.post(
    "/products",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        const { name, shortDesc, longDesc, category, subCategory, quantity, unitPrice } = req.body as {
            name?: string; shortDesc?: string; longDesc?: string;
            category?: string; subCategory?: string; quantity?: number; unitPrice?: number;
        };

        if (!name || !category) {
            res.status(400).json({ error: "name and category are required" });
            return;
        }

        try {
            const openStatusId = await getStatusId("open");
            if (!openStatusId) {
                res.status(500).json({ error: "Status 'open' not found in product_status_type" });
                return;
            }

            const catCheck = await getPool().query(
                "SELECT id FROM product_category WHERE id = $1 LIMIT 1", [category]
            );
            if (!catCheck.rowCount) {
                res.status(400).json({ error: "Invalid category id" });
                return;
            }

            const result = await getPool().query(
                `INSERT INTO product
                 (seller_id, name, short_desc, long_desc, category_id, subcategory_id, quantity, unit_price, status_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING
           id, seller_id AS "sellerId", name,
           short_desc AS "shortDesc", long_desc AS "longDesc",
           quantity, unit_price AS "unitPrice",
           created_at AS "createdAt", updated_at AS "updatedAt"`,
                [sellerId, name, shortDesc ?? null, longDesc ?? null,
                    category, subCategory ?? null, quantity ?? 0, unitPrice ?? 0, openStatusId]
            );

            res.status(201).json({ ...result.rows[0], status: "open" });
        } catch (err) {
            logger.error("Create product error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── GET /inventory/products ───────────────────────────────────────────────────
// Filtered product list. Query params: status (code), category (code)

router.get("/products", async (req: Request, res: Response): Promise<void> => {
    const { status, category } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status)   { params.push(status);   conditions.push(`pst.code = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`pc.code  = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    try {
        const result = await getPool().query(
            `SELECT p.*, pc.name AS category_name, pst.name AS status_name
             FROM product p
                      JOIN product_category    pc  ON pc.id  = p.category_id
                      JOIN product_status_type pst ON pst.id = p.status_id
                 ${where} ORDER BY p.created_at DESC`, params
        );
        res.json(result.rows);
    } catch (err) {
        logger.error("Get products error", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /inventory/products/:id ───────────────────────────────────────────────

router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const pool = getPool();
        const p = await pool.query(
            `SELECT p.*, pc.name AS category_name, pst.name AS status_name, ct.name AS condition_name
             FROM product p
                      JOIN product_category    pc  ON pc.id  = p.category_id
                      JOIN product_status_type pst ON pst.id = p.status_id
                      LEFT JOIN condition_type ct  ON ct.id  = p.condition_id
             WHERE p.id = $1`, [req.params.id]
        );
        if (!p.rowCount) { res.status(404).json({ error: "Product not found" }); return; }
        const images = await pool.query(
            "SELECT * FROM product_image WHERE product_id = $1 ORDER BY sort_order", [req.params.id]
        );
        res.json({ ...p.rows[0], images: images.rows });
    } catch (err) {
        logger.error("Get product error", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── PATCH /inventory/products/:id ─────────────────────────────────────────────
// Content changes (name/desc) reset status to 'open' for re-approval.

router.patch(
    "/products/:id",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId  = (req as any).user.sub as string;
        const productId = req.params.id;
        const { name, shortDesc, longDesc, quantity, unitPrice } = req.body as {
            name?: string; shortDesc?: string; longDesc?: string; quantity?: number; unitPrice?: number;
        };

        const pool = getPool();
        try {
            const existing = await pool.query(
                "SELECT id, status_id FROM product WHERE id = $1 AND seller_id = $2",
                [productId, sellerId]
            );
            if (!existing.rowCount) { res.status(404).json({ error: "Product not found" }); return; }

            const contentChanged = name !== undefined || shortDesc !== undefined || longDesc !== undefined;
            let nextStatusId = existing.rows[0].status_id as string;
            if (contentChanged) {
                const openId = await getStatusId("open");
                if (openId) nextStatusId = openId;
            }

            const result = await pool.query(
                `UPDATE product
                 SET name       = COALESCE($1, name),
                     short_desc = COALESCE($2, short_desc),
                     long_desc  = COALESCE($3, long_desc),
                     quantity   = COALESCE($4, quantity),
                     unit_price = COALESCE($5, unit_price),
                     status_id  = $6,
                     updated_at = NOW()
                 WHERE id = $7 AND seller_id = $8
                     RETURNING id, name,
           short_desc AS "shortDesc", long_desc AS "longDesc",
           quantity, unit_price AS "unitPrice",
           created_at AS "createdAt", updated_at AS "updatedAt"`,
                [name ?? null, shortDesc ?? null, longDesc ?? null, quantity ?? null,
                    unitPrice ?? null, nextStatusId, productId, sellerId]
            );

            const statusRow = await pool.query(
                "SELECT name FROM product_status_type WHERE id = $1", [nextStatusId]
            );
            res.json({
                ...result.rows[0],
                status: statusRow.rows[0]?.name ?? "open",
            });
        } catch (err) {
            logger.error("Update product error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── PATCH /inventory/products/:id/image ──────────────────────────────────────

router.patch(
    "/products/:id/image",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId  = (req as any).user.sub as string;
        const productId = req.params.id;
        const { imageUrl } = req.body as { imageUrl?: string };

        if (!imageUrl) { res.status(400).json({ error: "imageUrl is required" }); return; }

        const pool = getPool();
        try {
            const existing = await pool.query(
                "SELECT id FROM product WHERE id = $1 AND seller_id = $2", [productId, sellerId]
            );
            if (!existing.rowCount) { res.status(404).json({ error: "Product not found" }); return; }

            await pool.query(
                "DELETE FROM product_image WHERE product_id = $1 AND is_primary = TRUE", [productId]
            );
            await pool.query(
                `INSERT INTO product_image (product_id, name, short_desc, image_url, sort_order, is_primary)
                 VALUES ($1, 'Primary Image', 'Primary product image', $2, 1, TRUE)`,
                [productId, imageUrl]
            );
            res.json({ success: true, imageUrl });
        } catch (err) {
            logger.error("Update image error", err);
            res.status(500).json({ error: "Failed to update image" });
        }
    }
);

// ── DELETE /inventory/products/:id ───────────────────────────────────────────

router.delete(
    "/products/:id",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId  = (req as any).user.sub as string;
        const productId = req.params.id;
        try {
            const removedStatusId = await getStatusId("removed");
            if (!removedStatusId) {
                res.status(500).json({ error: "Status 'removed' not found in product_status_type" }); return;
            }
            const result = await getPool().query(
                `UPDATE product SET status_id = $1, updated_at = NOW()
                 WHERE id = $2 AND seller_id = $3 RETURNING id`,
                [removedStatusId, productId, sellerId]
            );
            if (!result.rowCount) { res.status(404).json({ error: "Product not found" }); return; }
            res.json({ message: "Product removed" });
        } catch (err) {
            logger.error("Delete product error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── GET /inventory/products/:id/reviews ──────────────────────────────────────

router.get("/products/:id/reviews", async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await getPool().query(
            `SELECT id, buyer_id AS "buyerId", rating, review,
                    created_at AS "createdAt"
             FROM product_review
             WHERE product_id = $1
             ORDER BY created_at DESC`,
            [req.params.id]
        );
        const avg = await getPool().query(
            `SELECT ROUND(AVG(rating)::numeric, 1) AS average, COUNT(*) AS total
             FROM product_review WHERE product_id = $1`,
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
    } catch (err) {
        logger.error("Get product reviews error", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /inventory/products/:id/reviews ─────────────────────────────────────
// Body: { rating: 1-5, review?: string }

router.post(
    "/products/:id/reviews",
    requireAuth,
    requireRole("buyer"),
    async (req: Request, res: Response): Promise<void> => {
        const buyerId   = (req as any).user.sub as string;
        const productId = req.params.id;
        const { rating, review } = req.body as { rating?: number; review?: string };

        if (!rating || rating < 1 || rating > 5) {
            res.status(400).json({ error: "rating must be an integer between 1 and 5" });
            return;
        }

        try {
            const product = await getPool().query(
                "SELECT id FROM product WHERE id = $1", [productId]
            );
            if (!product.rowCount) {
                res.status(404).json({ error: "Product not found" });
                return;
            }

            const result = await getPool().query(
                `INSERT INTO product_review (product_id, buyer_id, rating, review)
                 VALUES ($1, $2, $3, $4)
                     ON CONFLICT (product_id, buyer_id)
         DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review
                                     RETURNING id, buyer_id AS "buyerId", rating, review, created_at AS "createdAt"`,
                [productId, buyerId, rating, review ?? null]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            logger.error("Submit product review error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── GET /inventory/trades/browse ─────────────────────────────────────────────
// Returns active products NOT owned by the calling seller, for trade browsing.

router.get(
    "/trades/browse",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        try {
            // Step 1: fetch active products from other sellers (inventory DB)
            const products = await getPool().query(
                `SELECT
                     p.id,
                     p.seller_id      AS "sellerId",
                     p.name,
                     p.short_desc     AS "shortDesc",
                     p.quantity,
                     p.unit_price     AS "unitPrice",
                     pst.name         AS status,
                     COALESCE(
                             (SELECT image_url FROM product_image
                              WHERE product_id = p.id AND is_primary = TRUE LIMIT 1),
             (SELECT image_url FROM product_image WHERE product_id = p.id LIMIT 1),
             '/images/default-product.png'
           ) AS "imageUrl"
                 FROM product p
                          JOIN product_status_type pst ON pst.id = p.status_id
                 WHERE pst.code = 'active'
                   AND p.quantity > 0
                   AND p.seller_id != $1
                 ORDER BY p.created_at DESC`,
                [sellerId]
            );

            if (!products.rowCount) { res.json([]); return; }

            // Step 2: resolve unique seller names from the account DB (cross-DB, non-fatal)
            // If the account pool connection fails or times out, return products with
            // a "Seller" placeholder rather than failing the entire browse request.
            const sellerIds: string[] = [...new Set(
                products.rows.map((r: any) => r.sellerId as string)
            )];

            const sellerMap = new Map<string, { firstName: string; lastName: string; email: string }>();
            try {
                const accountPoolClient = getAccountPool();
                const accounts = await Promise.race([
                    accountPoolClient.query(
                        `SELECT id, first_name AS "firstName", last_name AS "lastName", user_id AS email
             FROM account WHERE id = ANY($1::uuid[])`,
                        [sellerIds]
                    ),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Account pool timeout")), 3000)
                    ),
                ]);
                for (const row of (accounts as any).rows as { id: string; firstName: string; lastName: string; email: string }[]) {
                    sellerMap.set(row.id, { firstName: row.firstName, lastName: row.lastName, email: row.email });
                }
            } catch (accountErr) {
                // Non-fatal: log and continue with placeholder seller names
                logger.warn("Account pool lookup failed for trades/browse (non-fatal)", accountErr);
            }

            // Step 3: merge and return
            const enriched = products.rows.map((p: any) => {
                const seller = sellerMap.get(p.sellerId);
                return {
                    ...p,
                    sellerFirstName: seller?.firstName ?? "Seller",
                    sellerLastName:  seller?.lastName  ?? "",
                    sellerEmail:     seller?.email     ?? "",
                };
            });

            res.json(enriched);
        } catch (err) {
            logger.error("Browse trades error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── POST /inventory/trades ────────────────────────────────────────────────────
// Body: { offeredProductId, requestedProductId, notes? }
// Creates a trade proposal from caller (proposer) to the owner of requestedProduct.

router.post(
    "/trades",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const proposerId = (req as any).user.sub as string;
        const { offeredProductId, requestedProductId, notes } = req.body as {
            offeredProductId?: string; requestedProductId?: string; notes?: string;
        };

        if (!offeredProductId || !requestedProductId) {
            res.status(400).json({ error: "offeredProductId and requestedProductId are required" });
            return;
        }

        const pool = getPool();
        try {
            // Verify offered product belongs to caller and is active
            const offered = await pool.query(
                `SELECT p.id, p.seller_id, pst.code AS status_code
                 FROM product p JOIN product_status_type pst ON pst.id = p.status_id
                 WHERE p.id = $1 AND p.seller_id = $2`,
                [offeredProductId, proposerId]
            );
            if (!offered.rowCount) {
                res.status(400).json({ error: "Offered product not found or does not belong to you" });
                return;
            }
            if (offered.rows[0].status_code !== "active") {
                res.status(400).json({ error: "Offered product must be active" });
                return;
            }

            // Verify requested product belongs to a different seller and is active
            const requested = await pool.query(
                `SELECT p.id, p.seller_id, pst.code AS status_code
                 FROM product p JOIN product_status_type pst ON pst.id = p.status_id
                 WHERE p.id = $1`,
                [requestedProductId]
            );
            if (!requested.rowCount) {
                res.status(400).json({ error: "Requested product not found" });
                return;
            }
            if (requested.rows[0].seller_id === proposerId) {
                res.status(400).json({ error: "Cannot propose a trade for your own product" });
                return;
            }
            if (requested.rows[0].status_code !== "active") {
                res.status(400).json({ error: "Requested product is no longer available for trade" });
                return;
            }

            // Check for duplicate pending trade between same products
            const duplicate = await pool.query(
                `SELECT id FROM trade_request
                 WHERE offered_product_id = $1 AND requested_product_id = $2
                   AND proposer_id = $3 AND status = 'pending'`,
                [offeredProductId, requestedProductId, proposerId]
            );
            if (duplicate.rowCount && duplicate.rowCount > 0) {
                res.status(409).json({ error: "You already have a pending trade proposal for these products" });
                return;
            }

            const receiverId = requested.rows[0].seller_id as string;
            const result = await pool.query(
                `INSERT INTO trade_request
                 (proposer_id, receiver_id, offered_product_id, requested_product_id, notes)
                 VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, proposer_id AS "proposerId", receiver_id AS "receiverId",
           offered_product_id AS "offeredProductId",
           requested_product_id AS "requestedProductId",
           status, notes, created_at AS "createdAt"`,
                [proposerId, receiverId, offeredProductId, requestedProductId, notes ?? null]
            );

            res.status(201).json(result.rows[0]);
        } catch (err) {
            logger.error("Propose trade error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── GET /inventory/trades/mine ────────────────────────────────────────────────
// Returns all trades where caller is proposer OR receiver, enriched with product info.

router.get(
    "/trades/mine",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        try {
            const result = await getPool().query(
                `SELECT
                     tr.id,
                     tr.proposer_id            AS "proposerId",
                     tr.receiver_id            AS "receiverId",
                     tr.status,
                     tr.notes,
                     tr.created_at             AS "createdAt",
                     tr.updated_at             AS "updatedAt",
                     -- Offered product fields
                     op.id                     AS "offeredProductId",
                     op.name                   AS "offeredProductName",
                     op.unit_price             AS "offeredProductPrice",
                     COALESCE(
                             (SELECT image_url FROM product_image WHERE product_id = op.id AND is_primary = TRUE LIMIT 1),
             (SELECT image_url FROM product_image WHERE product_id = op.id LIMIT 1),
             '/images/default-product.png'
           )                         AS "offeredProductImage",
                     -- Requested product fields
                     rp.id                     AS "requestedProductId",
                     rp.name                   AS "requestedProductName",
                     rp.unit_price             AS "requestedProductPrice",
                     COALESCE(
                             (SELECT image_url FROM product_image WHERE product_id = rp.id AND is_primary = TRUE LIMIT 1),
             (SELECT image_url FROM product_image WHERE product_id = rp.id LIMIT 1),
             '/images/default-product.png'
           )                         AS "requestedProductImage"
                 FROM trade_request tr
                          JOIN product op ON op.id = tr.offered_product_id
                          JOIN product rp ON rp.id = tr.requested_product_id
                 WHERE tr.proposer_id = $1 OR tr.receiver_id = $1
                 ORDER BY tr.created_at DESC`,
                [sellerId]
            );
            res.json(result.rows);
        } catch (err) {
            logger.error("Get my trades error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── PUT /inventory/trades/:id/accept ─────────────────────────────────────────
// Caller must be receiver. Marks both products as 'traded' and cancels any other
// pending trades that involve either product.

router.put(
    "/trades/:id/accept",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        const tradeId  = req.params.id;
        const pool     = getPool();

        try {
            const trade = await pool.query(
                "SELECT * FROM trade_request WHERE id = $1", [tradeId]
            );
            if (!trade.rowCount) {
                res.status(404).json({ error: "Trade not found" }); return;
            }
            const t = trade.rows[0] as {
                id: string; receiver_id: string; status: string;
                offered_product_id: string; requested_product_id: string;
            };
            if (t.receiver_id !== sellerId) {
                res.status(403).json({ error: "Only the receiving seller can accept this trade" }); return;
            }
            if (t.status !== "pending") {
                res.status(409).json({ error: `Trade is already ${t.status}` }); return;
            }

            const tradedStatusId = await getStatusId("traded");
            if (!tradedStatusId) {
                res.status(500).json({ error: "Status 'traded' not found — please restart the DB" }); return;
            }

            // Mark both products as 'traded'
            await pool.query(
                "UPDATE product SET status_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])",
                [tradedStatusId, [t.offered_product_id, t.requested_product_id]]
            );

            // Accept this trade
            await pool.query(
                "UPDATE trade_request SET status = 'accepted', updated_at = NOW() WHERE id = $1",
                [tradeId]
            );

            // Cancel all other pending trades that involve either product
            await pool.query(
                `UPDATE trade_request
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE id != $1 AND status = 'pending'
                   AND (
                     offered_product_id    = ANY($2::uuid[]) OR
                     requested_product_id  = ANY($2::uuid[])
                     )`,
                [tradeId, [t.offered_product_id, t.requested_product_id]]
            );

            res.json({ message: "Trade accepted — both products have been marked as traded" });
        } catch (err) {
            logger.error("Accept trade error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── PUT /inventory/trades/:id/decline ────────────────────────────────────────
// Caller must be receiver.

router.put(
    "/trades/:id/decline",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        const tradeId  = req.params.id;
        const pool     = getPool();
        try {
            const trade = await pool.query(
                "SELECT receiver_id, status FROM trade_request WHERE id = $1", [tradeId]
            );
            if (!trade.rowCount) { res.status(404).json({ error: "Trade not found" }); return; }
            const { receiver_id, status } = trade.rows[0] as { receiver_id: string; status: string };
            if (receiver_id !== sellerId) {
                res.status(403).json({ error: "Only the receiving seller can decline this trade" }); return;
            }
            if (status !== "pending") {
                res.status(409).json({ error: `Trade is already ${status}` }); return;
            }
            await pool.query(
                "UPDATE trade_request SET status = 'declined', updated_at = NOW() WHERE id = $1", [tradeId]
            );
            res.json({ message: "Trade declined" });
        } catch (err) {
            logger.error("Decline trade error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── PUT /inventory/trades/:id/cancel ─────────────────────────────────────────
// Caller must be proposer.

router.put(
    "/trades/:id/cancel",
    requireAuth,
    requireRole("seller"),
    async (req: Request, res: Response): Promise<void> => {
        const sellerId = (req as any).user.sub as string;
        const tradeId  = req.params.id;
        const pool     = getPool();
        try {
            const trade = await pool.query(
                "SELECT proposer_id, status FROM trade_request WHERE id = $1", [tradeId]
            );
            if (!trade.rowCount) { res.status(404).json({ error: "Trade not found" }); return; }
            const { proposer_id, status } = trade.rows[0] as { proposer_id: string; status: string };
            if (proposer_id !== sellerId) {
                res.status(403).json({ error: "Only the proposing seller can cancel this trade" }); return;
            }
            if (status !== "pending") {
                res.status(409).json({ error: `Trade is already ${status}` }); return;
            }
            await pool.query(
                "UPDATE trade_request SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [tradeId]
            );
            res.json({ message: "Trade cancelled" });
        } catch (err) {
            logger.error("Cancel trade error", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// ── POST /inventory/internal/seed ────────────────────────────────────────────
// Seeds 1,000 products (40 per seller across 25 sellers) with valid Picsum
// image URLs. Returns product_ids so the order seed can reference real products.
router.post(
    "/internal/seed",
    requireInternalSecret as any,
    async (req: Request, res: Response): Promise<void> => {
        const pool = getPool();
        const sellerIds: string[] = (req.body as any).sellerIds ?? [];
        const PLACEHOLDER = "00000000-0000-0000-0000-000000000001";
        // With 25 sellers × 40 products each = 1,000 products total (exact round-robin)
        const getSeller = (n: number): string =>
            sellerIds.length > 0 ? sellerIds[(n - 1) % sellerIds.length] : PLACEHOLDER;

        try {
            const categories  = await pool.query("SELECT id, code, name, gender FROM product_category ORDER BY name");
            const statuses    = await pool.query("SELECT id, code FROM product_status_type");
            const conditions  = await pool.query("SELECT id, code FROM condition_type ORDER BY sort_order");
            const protections = await pool.query("SELECT id, name FROM protection_type ORDER BY name");

            const catRows  = categories.rows  as { id: string; code: string; name: string; gender: string }[];
            const statRows = statuses.rows    as { id: string; code: string }[];
            const condRows = conditions.rows  as { id: string; code: string }[];
            const protRows = protections.rows as { id: string; name: string }[];

            const statusMap: Record<string, string> = {};
            for (const s of statRows) statusMap[s.code] = s.id;

            // ── Seed subcategories ─────────────────────────────────────────────────
            let subcatsInserted = 0;
            for (const cat of catRows) {
                for (const sub of [
                    { code: `${cat.code}_signed`,    name: `${cat.code}_signed`,
                        short: "Signed Item",    long: `Signed ${cat.name} memorabilia` },
                    { code: `${cat.code}_game_used`, name: `${cat.code}_game_used`,
                        short: "Game-Used Item", long: `Game-used ${cat.name} memorabilia` },
                    { code: `${cat.code}_vintage`,   name: `${cat.code}_vintage`,
                        short: "Vintage Item",   long: `Vintage ${cat.name} memorabilia (pre-1990)` },
                ]) {
                    await pool.query(
                        `INSERT INTO product_subcategory (category_id, code, name, short_desc, long_desc)
                         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (category_id, code) DO NOTHING`,
                        [cat.id, sub.code, sub.name, sub.short, sub.long]
                    );
                    subcatsInserted++;
                }
            }

            const subcatRows = (
                (await pool.query("SELECT id, category_id, code FROM product_subcategory ORDER BY code")).rows
            ) as { id: string; category_id: string; code: string }[];

            // ── 40 product templates — cycle through all for variety ───────────────
            const ITEMS = [
                // MLB
                { type:"Signed Baseball",      team:"New York Yankees",       player:"Aaron Judge",        signed:true,  inscribed:false, inscription:"" },
                { type:"Game-Used Bat",         team:"Los Angeles Dodgers",    player:"Mookie Betts",       signed:false, inscribed:false, inscription:"" },
                { type:"Signed Jersey",         team:"Houston Astros",         player:"Jose Altuve",        signed:true,  inscribed:true,  inscription:"2017 WS Champs" },
                { type:"Signed Baseball Card",  team:"Atlanta Braves",         player:"Ronald Acuna Jr",    signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Lithograph",     team:"San Francisco Giants",   player:"Buster Posey",       signed:true,  inscribed:true,  inscription:"3x WS Champion" },
                { type:"Game-Used Cleats",      team:"Boston Red Sox",         player:"Rafael Devers",      signed:false, inscribed:false, inscription:"" },
                { type:"Signed Baseball",       team:"Chicago Cubs",           player:"Dansby Swanson",     signed:true,  inscribed:false, inscription:"" },
                { type:"Vintage Signed Ball",   team:"New York Yankees",       player:"Derek Jeter",        signed:true,  inscribed:true,  inscription:"Mr. November" },
                // Football
                { type:"Signed Mini Helmet",    team:"Kansas City Chiefs",     player:"Patrick Mahomes",    signed:true,  inscribed:true,  inscription:"Super Bowl MVP" },
                { type:"Signed Jersey",         team:"Dallas Cowboys",         player:"CeeDee Lamb",        signed:true,  inscribed:false, inscription:"" },
                { type:"Game-Used Gloves",      team:"Philadelphia Eagles",    player:"Jalen Hurts",        signed:false, inscribed:false, inscription:"" },
                { type:"Signed Football",       team:"San Francisco 49ers",    player:"Brock Purdy",        signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Helmet",         team:"Buffalo Bills",          player:"Josh Allen",         signed:true,  inscribed:false, inscription:"" },
                { type:"Game-Used Jersey",      team:"Miami Dolphins",         player:"Tyreek Hill",        signed:false, inscribed:false, inscription:"" },
                { type:"Signed Photo",          team:"New England Patriots",   player:"Tom Brady",          signed:true,  inscribed:true,  inscription:"7x Super Bowl Champion" },
                { type:"Signed Jersey",         team:"St. Louis Cardinals",    player:"Albert Pujols",      signed:true,  inscribed:true,  inscription:"3x NL MVP" },
                // Golf
                { type:"Signed Golf Ball",      team:"PGA Tour",               player:"Tiger Woods",        signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Golf Club",      team:"PGA Tour",               player:"Rory McIlroy",       signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Flag Pin",       team:"The Masters",            player:"Jon Rahm",           signed:true,  inscribed:true,  inscription:"2023 Masters Champion" },
                { type:"Signed Glove",          team:"LPGA Tour",              player:"Nelly Korda",        signed:true,  inscribed:false, inscription:"" },
                // Soccer
                { type:"Signed Soccer Ball",    team:"Inter Miami CF",         player:"Lionel Messi",       signed:true,  inscribed:true,  inscription:"GOAT" },
                { type:"Signed Jersey",         team:"LA Galaxy",              player:"Riqui Puig",         signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Jersey",         team:"Portland Thorns",        player:"Crystal Dunn",       signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Jersey",         team:"NJ/NY Gotham FC",        player:"Lynn Williams",      signed:true,  inscribed:false, inscription:"" },
                // Tennis
                { type:"Signed Tennis Racket",  team:"ATP Tour",               player:"Carlos Alcaraz",     signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Tennis Ball",    team:"Wimbledon",              player:"Novak Djokovic",     signed:true,  inscribed:true,  inscription:"24 Grand Slams" },
                { type:"Signed Racket",         team:"WTA Tour",               player:"Iga Swiatek",        signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Tennis Ball",    team:"US Open",                player:"Coco Gauff",         signed:true,  inscribed:true,  inscription:"US Open Champion" },
                { type:"Signed Tennis Racket",  team:"ATP Tour",               player:"Jannik Sinner",      signed:true,  inscribed:true,  inscription:"Australian Open 2024" },
                // Wrestling
                { type:"Championship Belt",     team:"WWE",                    player:"Cody Rhodes",        signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Photo",          team:"WWE",                    player:"Roman Reigns",       signed:true,  inscribed:true,  inscription:"Acknowledge Me" },
                { type:"Signed Photo",          team:"WWE Women's",            player:"Rhea Ripley",        signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Action Figure",  team:"WWE",                    player:"Seth Rollins",       signed:true,  inscribed:false, inscription:"" },
                // Softball / Minor League
                { type:"Signed Softball",       team:"AUSL",                   player:"Cat Osterman",       signed:true,  inscribed:false, inscription:"" },
                { type:"Signed Baseball",       team:"Durham Bulls",           player:"Josh Lowe",          signed:true,  inscribed:false, inscription:"" },
                { type:"Game-Used Jersey",      team:"Hartford Yard Goats",    player:"Adael Amador",       signed:false, inscribed:false, inscription:"" },
                { type:"Signed Baseball",       team:"Lansing Lugnuts",        player:"Dasan Brown",        signed:true,  inscribed:false, inscription:"" },
                { type:"Game-Used Bat",         team:"Palm Beach Cardinals",   player:"Jordan Walker",      signed:false, inscribed:false, inscription:"" },
                { type:"Signed Baseball",       team:"FCL Rays",               player:"Chandler Champlain", signed:true,  inscribed:false, inscription:"" },
                // Additional vintage
                { type:"Signed Card",           team:"Chicago Bulls",          player:"Michael Jordan",     signed:true,  inscribed:false, inscription:"" },
            ];

            // 85% active, 10% suspended, 5% open — matches realistic inventory distribution
            const STAT_CYCLE = [
                "active","active","active","active","active","active","active","active","active","active",
                "active","active","active","active","active","active","active","suspended","active","open",
            ];

            let productsInserted = 0;
            const productIds: string[] = [];

            // ── Insert 1,000 products — 40 per seller (25 sellers × 40 = 1,000) ───
            for (let n = 1; n <= 1000; n++) {
                const item     = ITEMS[(n - 1) % ITEMS.length];
                const cat      = catRows[(n - 1) % catRows.length];
                const cond     = condRows[(n - 1) % condRows.length];
                const prot     = protRows[(n - 1) % protRows.length];
                const statusId = statusMap[STAT_CYCLE[(n - 1) % STAT_CYCLE.length]] ?? statRows[0].id;
                const sub      = subcatRows.find(s => s.category_id === cat.id) ?? null;

                // Price varies from $49.99 to $1,299.99 in a deterministic pattern
                const price = parseFloat((49.99 + ((n * 12.5) % 1250)).toFixed(2));

                const r = await pool.query(
                    `INSERT INTO product (
                        seller_id, name, short_desc, long_desc,
                        category_id, subcategory_id, team_name, player_name, gender,
                        is_signed, is_authenticated, is_framed,
                        has_inscription, inscription_text, has_multi_sigs,
                        is_protected, protection_type_id, condition_id,
                        status_id, quantity, unit_price
                    ) VALUES (
                                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
                             ) RETURNING id`,
                    [
                        getSeller(n),
                        `${item.player} - ${item.type} #${n}`,
                        `${item.type} — ${cat.name}`,
                        `Authentic sports memorabilia: ${item.type} by ${item.player} (${item.team}).`,
                        cat.id, sub?.id ?? null,
                        item.team, item.player, cat.gender ?? "unspecified",
                        item.signed, item.signed,
                        (n % 8 === 0),
                        item.inscribed, item.inscribed ? item.inscription : null,
                        (n % 10 === 0),
                        (n % 4 !== 2),
                        prot.id, cond.id, statusId,
                        (n % 5) + 1,
                        price,
                    ]
                );
                productIds.push(r.rows[0].id);
                productsInserted++;
            }

            // ── Insert product images using Picsum Photos (valid public CDN) ───────
            // Primary  : https://picsum.photos/seed/sv{n}a/800/600
            // Detail   : https://picsum.photos/seed/sv{n}b/800/600
            // Auth cert: https://picsum.photos/seed/sv{n}c/400/300  (signed items only)
            let imagesInserted = 0;
            for (let i = 0; i < productIds.length; i++) {
                const pid  = productIds[i];
                const n    = i + 1;
                const item = ITEMS[(n - 1) % ITEMS.length];

                const imgs: { name: string; url: string; sort: number; primary: boolean }[] = [
                    {
                        name: "Front View",
                        url:  `https://picsum.photos/seed/sv${n}a/800/600`,
                        sort: 1, primary: true,
                    },
                    {
                        name: "Detail View",
                        url:  `https://picsum.photos/seed/sv${n}b/800/600`,
                        sort: 2, primary: false,
                    },
                ];

                // Add authentication certificate image for signed items
                if (item.signed && n % 5 !== 0) {
                    imgs.push({
                        name: "Authentication Certificate",
                        url:  `https://picsum.photos/seed/sv${n}c/400/300`,
                        sort: 3, primary: false,
                    });
                }

                for (const img of imgs) {
                    await pool.query(
                        `INSERT INTO product_image
                         (product_id, name, short_desc, long_desc, image_url, sort_order, is_primary)
                         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                        [
                            pid,
                            `${img.name} — Product #${n}`,
                            img.name,
                            `${img.name} for ${ITEMS[(n-1)%ITEMS.length].player} — ${ITEMS[(n-1)%ITEMS.length].type} #${n}`,
                            img.url,
                            img.sort,
                            img.primary,
                        ]
                    );
                    imagesInserted++;
                }
            }

            // ── Aggregate totals ───────────────────────────────────────────────────
            const q = async (s: string) => parseInt((await pool.query(s)).rows[0].count);
            const totals = {
                product_status_types:  await q("SELECT COUNT(*) FROM product_status_type"),
                product_categories:    await q("SELECT COUNT(*) FROM product_category"),
                product_subcategories: await q("SELECT COUNT(*) FROM product_subcategory"),
                protection_types:      await q("SELECT COUNT(*) FROM protection_type"),
                condition_types:       await q("SELECT COUNT(*) FROM condition_type"),
                product_category_types:await q("SELECT COUNT(*) FROM product_category_type"),
                products:              await q("SELECT COUNT(*) FROM product"),
                product_images:        await q("SELECT COUNT(*) FROM product_image"),
            };

            logger.info(`[Seed] InventoryService: ${JSON.stringify(totals)}`);
            await publishEvent(TOPICS.INVENTORY_EVENTS, "seed", {
                eventType: "PRODUCTS_SEEDED",
                usingPlaceholderSeller: sellerIds.length === 0,
                totals, occurredAt: new Date().toISOString(),
            });

            res.json({
                service: "InventoryService",
                using_placeholder_seller: sellerIds.length === 0,
                product_ids: productIds,          // returned for order seed step
                inserted: {
                    subcategories: subcatsInserted,
                    products: productsInserted,
                    images: imagesInserted,
                },
                totals,
            });
        } catch (err) {
            logger.error("Seed error", err);
            res.status(500).json({ error: "Seed failed", detail: String(err) });
        }
    }
);

export default router;