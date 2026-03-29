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
 * Schema note: unit_price was removed in Sprint 5. Routes ignore any unitPrice
 * sent by clients and return unitPrice: 0 for backward compatibility.
 */
import { Router, Request, Response } from "express";
import { getPool }              from "../db/pool";
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
         p.name,
         p.short_desc  AS "shortDesc",
         p.long_desc   AS "longDesc",
         p.quantity,
         0             AS "unitPrice",
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
           0             AS "unitPrice",
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
// unitPrice is accepted but ignored — column removed in Sprint 5 schema.

router.post(
  "/products",
  requireAuth,
  requireRole("seller"),
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = (req as any).user.sub as string;
    const { name, shortDesc, longDesc, category, subCategory, quantity } = req.body as {
      name?: string; shortDesc?: string; longDesc?: string;
      category?: string; subCategory?: string; quantity?: number;
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
           (seller_id, name, short_desc, long_desc, category_id, subcategory_id, quantity, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING
           id, seller_id AS "sellerId", name,
           short_desc AS "shortDesc", long_desc AS "longDesc",
           quantity, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [sellerId, name, shortDesc ?? null, longDesc ?? null,
         category, subCategory ?? null, quantity ?? 0, openStatusId]
      );

      res.status(201).json({ ...result.rows[0], unitPrice: 0, status: "open" });
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
    const { name, shortDesc, longDesc, quantity } = req.body as {
      name?: string; shortDesc?: string; longDesc?: string; quantity?: number;
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
             status_id  = $5,
             updated_at = NOW()
         WHERE id = $6 AND seller_id = $7
         RETURNING id, name,
           short_desc AS "shortDesc", long_desc AS "longDesc",
           quantity, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [name ?? null, shortDesc ?? null, longDesc ?? null, quantity ?? null,
         nextStatusId, productId, sellerId]
      );

      const statusRow = await pool.query(
        "SELECT name FROM product_status_type WHERE id = $1", [nextStatusId]
      );
      res.json({ ...result.rows[0], unitPrice: 0, status: statusRow.rows[0]?.name ?? "open" });
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

// ── POST /inventory/internal/seed ────────────────────────────────────────────
router.post(
  "/internal/seed",
  requireInternalSecret as any,
  async (req: Request, res: Response): Promise<void> => {
    const pool = getPool();
    const sellerIds: string[] = (req.body as any).sellerIds ?? [];
    const PLACEHOLDER = "00000000-0000-0000-0000-000000000001";
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

      let subcatsInserted = 0;
      for (const cat of catRows) {
        for (const sub of [
          { code: `${cat.code}_signed`,    name: `${cat.code}_signed`,    short: "Signed Item",    long: `Signed ${cat.name} memorabilia` },
          { code: `${cat.code}_game_used`, name: `${cat.code}_game_used`, short: "Game-Used Item", long: `Game-used ${cat.name} memorabilia` },
        ]) {
          await pool.query(
            `INSERT INTO product_subcategory (category_id, code, name, short_desc, long_desc)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (category_id, code) DO NOTHING`,
            [cat.id, sub.code, sub.name, sub.short, sub.long]
          );
          subcatsInserted++;
        }
      }

      const subcatRows = ((await pool.query("SELECT id, category_id, code FROM product_subcategory ORDER BY code")).rows) as { id: string; category_id: string; code: string }[];

      const ITEMS = [
        { type: "Signed Baseball",    team: "New York Yankees",    player: "Derek Jeter",     signed: true,  inscribed: false, inscription: "" },
        { type: "Signed Jersey",      team: "Dallas Cowboys",      player: "Emmitt Smith",    signed: true,  inscribed: false, inscription: "" },
        { type: "Game-Used Bat",      team: "Los Angeles Dodgers", player: "Mookie Betts",    signed: false, inscribed: false, inscription: "" },
        { type: "Signed Mini Helmet", team: "Kansas City Chiefs",  player: "Patrick Mahomes", signed: true,  inscribed: true,  inscription: "Super Bowl Champions" },
        { type: "Signed Golf Ball",   team: "PGA Tour",            player: "Tiger Woods",     signed: true,  inscribed: false, inscription: "" },
        { type: "Signed Card",        team: "Chicago Bulls",       player: "Michael Jordan",  signed: true,  inscribed: false, inscription: "" },
        { type: "Signed Racket",      team: "ATP Tour",            player: "Serena Williams", signed: true,  inscribed: true,  inscription: "23 Grand Slams" },
        { type: "Game-Used Jersey",   team: "Boston Red Sox",      player: "David Ortiz",     signed: false, inscribed: false, inscription: "" },
        { type: "Signed Lithograph",  team: "San Francisco 49ers", player: "Joe Montana",     signed: true,  inscribed: true,  inscription: "Super Bowl XIX" },
        { type: "Championship Belt",  team: "WWE",                 player: "The Rock",        signed: true,  inscribed: false, inscription: "" },
      ];
      const STAT_CYCLE = ["active","active","active","active","active","active","active","suspended","active","open"];
      let productsInserted = 0;
      const productIds: string[] = [];

      for (let n = 1; n <= 50; n++) {
        const item = ITEMS[(n-1)%ITEMS.length], cat = catRows[(n-1)%catRows.length];
        const cond = condRows[(n-1)%condRows.length], prot = protRows[(n-1)%protRows.length];
        const statusId = statusMap[STAT_CYCLE[(n-1)%STAT_CYCLE.length]] ?? statRows[0].id;
        const sub = subcatRows.find(s => s.category_id === cat.id) ?? null;
        const r = await pool.query(
          `INSERT INTO product (seller_id,name,short_desc,long_desc,category_id,subcategory_id,
             team_name,player_name,gender,is_signed,is_authenticated,is_framed,
             has_inscription,inscription_text,has_multi_sigs,is_protected,protection_type_id,
             condition_id,status_id,quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           RETURNING id`,
          [getSeller(n), `${item.player} - ${item.type} #${n}`,
           `${item.type} - ${cat.name}`,
           `Authentic sports memorabilia - ${item.type} by ${item.player}.`,
           cat.id, sub?.id??null, item.team, item.player, cat.gender??"unspecified",
           item.signed, item.signed, (n%4===0), item.inscribed,
           item.inscribed?item.inscription:null, (n%5===0), (n%3!==2),
           prot.id, cond.id, statusId, (n%5)+1]
        );
        productIds.push(r.rows[0].id); productsInserted++;
      }

      let imagesInserted = 0;
      for (let i = 0; i < productIds.length; i++) {
        const pid = productIds[i], n = i+1, base = `https://cdn.sportvault.com/products/${pid}`;
        const imgs = [
          { name:"Front View",  slug:"front",  sort:1, primary:true  },
          { name:"Detail View", slug:"detail", sort:2, primary:false },
        ];
        if ((n-1)%10 < 7 && ITEMS[(n-1)%ITEMS.length].signed)
          imgs.push({ name:"Authentication", slug:"auth", sort:3, primary:false });
        for (const img of imgs) {
          await pool.query(
            `INSERT INTO product_image
               (product_id,name,short_desc,long_desc,image_url,sort_order,is_primary)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [pid, `${img.name} - Product ${n}`, img.name,
             `${img.name} image for product ${n}`, `${base}/${img.slug}.jpg`,
             img.sort, img.primary]
          );
          imagesInserted++;
        }
      }

      const q = async (s: string) => parseInt((await pool.query(s)).rows[0].count);
      const totals = {
        product_status_types: await q("SELECT COUNT(*) FROM product_status_type"),
        product_categories:   await q("SELECT COUNT(*) FROM product_category"),
        product_subcategories:await q("SELECT COUNT(*) FROM product_subcategory"),
        protection_types:     await q("SELECT COUNT(*) FROM protection_type"),
        condition_types:      await q("SELECT COUNT(*) FROM condition_type"),
        product_category_types:await q("SELECT COUNT(*) FROM product_category_type"),
        products:             await q("SELECT COUNT(*) FROM product"),
        product_images:       await q("SELECT COUNT(*) FROM product_image"),
      };
      logger.info(`[Seed] InventoryService: ${JSON.stringify(totals)}`);
      await publishEvent(TOPICS.INVENTORY_EVENTS, "seed", {
        eventType: "PRODUCTS_SEEDED", usingPlaceholderSeller: sellerIds.length===0,
        totals, occurredAt: new Date().toISOString(),
      });
      res.json({
        service: "InventoryService",
        using_placeholder_seller: sellerIds.length===0,
        inserted: { subcategories: subcatsInserted, products: productsInserted, images: imagesInserted },
        totals,
      });
    } catch (err) {
      logger.error("Seed error", err);
      res.status(500).json({ error: "Seed failed", detail: String(err) });
    }
  }
);

export default router;
