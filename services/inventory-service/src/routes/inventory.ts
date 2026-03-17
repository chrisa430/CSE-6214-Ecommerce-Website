/**
 * @fileoverview InventoryService route handlers + seed API
 * @module routes/inventory.ts
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * Seed endpoint (POST /inventory/internal/seed) populates:
 *   - product_subcategory  (2 per category)
 *   - product              (50 rows — seller_id supplied by caller from account DB)
 *   - product_image        (2-3 per product)
 *
 * Reference tables (product_status_type, product_category, protection_type,
 * condition_type, product_category_type) are seeded in database/inventory/init.sql.
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

// ── GET /inventory/categories ────────────────────────────────────────────────
router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPool().query("SELECT * FROM product_category ORDER BY name");
    res.json(result.rows);
  } catch (err) { logger.error("Get categories error", err); res.status(500).json({ error: "Internal server error" }); }
});

// ── GET /inventory/products ──────────────────────────────────────────────────
router.get("/products", async (req: Request, res: Response): Promise<void> => {
  const { status, category } = req.query as Record<string, string>;
  const pool = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status)   { params.push(status);   conditions.push(`pst.code = $${params.length}`); }
  if (category) { params.push(category); conditions.push(`pc.code  = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const result = await pool.query(
      `SELECT p.*, pc.name AS category_name, pst.name AS status_name
       FROM product p
       JOIN product_category    pc  ON pc.id  = p.category_id
       JOIN product_status_type pst ON pst.id = p.status_id
       ${where}
       ORDER BY p.created_at DESC`, params
    );
    res.json(result.rows);
  } catch (err) { logger.error("Get products error", err); res.status(500).json({ error: "Internal server error" }); }
});

// ── GET /inventory/products/:id ──────────────────────────────────────────────
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
  } catch (err) { logger.error("Get product error", err); res.status(500).json({ error: "Internal server error" }); }
});

// ── POST /inventory/internal/seed ────────────────────────────────────────────
// Body: { sellerIds?: string[] }  — array of seller account UUIDs from the account DB.
//       If omitted, a placeholder UUID is used so seeding still works standalone.
router.post(
  "/internal/seed",
  requireInternalSecret as any,
  async (req: Request, res: Response): Promise<void> => {
    const pool = getPool();
    // Accept seller IDs from caller (fetched from account service by seed script)
    const sellerIds: string[] = (req.body as any).sellerIds ?? [];
    const PLACEHOLDER = "00000000-0000-0000-0000-000000000001";

    const getSeller = (n: number): string =>
      sellerIds.length > 0 ? sellerIds[(n - 1) % sellerIds.length] : PLACEHOLDER;

    try {
      // ── Fetch lookup IDs ────────────────────────────────────────────────────
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

      // ── Step 1: seed product_subcategory (2 per category) ──────────────────
      let subcatsInserted = 0;
      for (const cat of catRows) {
        const subs = [
          { code: `${cat.code}_signed`,    name: `${cat.code}_signed`,    short: "Signed Item",    long: `Signed ${cat.name} memorabilia` },
          { code: `${cat.code}_game_used`, name: `${cat.code}_game_used`, short: "Game-Used Item", long: `Game-used ${cat.name} memorabilia` },
        ];
        for (const sub of subs) {
          await pool.query(
            `INSERT INTO product_subcategory (category_id, code, name, short_desc, long_desc)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (category_id, code) DO NOTHING`,
            [cat.id, sub.code, sub.name, sub.short, sub.long]
          );
          subcatsInserted++;
        }
      }

      // ── Step 2: fetch subcategories for product seed ────────────────────────
      const subcats = await pool.query(
        "SELECT id, category_id, code FROM product_subcategory ORDER BY code"
      );
      const subcatRows = subcats.rows as { id: string; category_id: string; code: string }[];

      // ── Step 3: seed 50 products ────────────────────────────────────────────
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

      const STAT_CYCLE = ["active", "active", "active", "active", "active", "active", "active", "suspended", "active", "open"];
      let productsInserted = 0;
      const productIds: string[] = [];

      for (let n = 1; n <= 50; n++) {
        const item    = ITEMS[(n - 1) % ITEMS.length];
        const cat     = catRows[(n - 1) % catRows.length];
        const cond    = condRows[(n - 1) % condRows.length];
        const prot    = protRows[(n - 1) % protRows.length];
        const statCode = STAT_CYCLE[(n - 1) % STAT_CYCLE.length];
        const statusId = statusMap[statCode] ?? statRows[0].id;
        const sellerId = getSeller(n);

        // Find a subcategory for this category
        const sub = subcatRows.find(s => s.category_id === cat.id) ?? null;

        const r = await pool.query(
          `INSERT INTO product (
             seller_id, name, short_desc, long_desc,
             category_id, subcategory_id,
             team_name, player_name, gender,
             is_signed, is_authenticated, is_framed,
             has_inscription, inscription_text, has_multi_sigs,
             is_protected, protection_type_id,
             condition_id, status_id, quantity
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6,
             $7, $8, $9,
             $10, $11, $12,
             $13, $14, $15,
             $16, $17,
             $18, $19, $20
           ) RETURNING id`,
          [
            sellerId,
            `${item.player} - ${item.type} #${n}`,
            `${item.type} - ${cat.name}`,
            `Authentic sports memorabilia - ${item.type} by ${item.player}. Category: ${cat.name}. Condition: ${cond.code}.`,
            cat.id,
            sub?.id ?? null,
            item.team,
            item.player,
            cat.gender ?? "unspecified",
            item.signed,
            item.signed,
            (n % 4 === 0),
            item.inscribed,
            item.inscribed ? item.inscription : null,
            (n % 5 === 0),
            (n % 3 !== 2),
            prot.id,
            cond.id,
            statusId,
            (n % 5) + 1,
          ]
        );
        productIds.push(r.rows[0].id as string);
        productsInserted++;
      }

      // ── Step 4: seed product_images (2-3 per product) ──────────────────────
      let imagesInserted = 0;
      for (let i = 0; i < productIds.length; i++) {
        const pid  = productIds[i];
        const n    = i + 1;
        const base = `https://cdn.sportvault.com/products/${pid}`;
        const images = [
          { name: "Front View",   slug: "front",  sort: 1, primary: true  },
          { name: "Detail View",  slug: "detail", sort: 2, primary: false },
        ];
        // Add authentication image for signed items
        if ((n - 1) % 10 < 7 && ITEMS[(n - 1) % ITEMS.length].signed) {
          images.push({ name: "Authentication", slug: "auth", sort: 3, primary: false });
        }
        for (const img of images) {
          await pool.query(
            `INSERT INTO product_image (product_id, name, short_desc, long_desc, image_url, sort_order, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              pid,
              `${img.name} - Product ${n}`,
              img.name,
              `${img.name} image for product ${n}`,
              `${base}/${img.slug}.jpg`,
              img.sort,
              img.primary,
            ]
          );
          imagesInserted++;
        }
      }

      // ── Summary ─────────────────────────────────────────────────────────────
      const totals = {
        product_status_types:   parseInt((await pool.query("SELECT COUNT(*) FROM product_status_type")).rows[0].count),
        product_categories:     parseInt((await pool.query("SELECT COUNT(*) FROM product_category")).rows[0].count),
        product_subcategories:  parseInt((await pool.query("SELECT COUNT(*) FROM product_subcategory")).rows[0].count),
        protection_types:       parseInt((await pool.query("SELECT COUNT(*) FROM protection_type")).rows[0].count),
        condition_types:        parseInt((await pool.query("SELECT COUNT(*) FROM condition_type")).rows[0].count),
        product_category_types: parseInt((await pool.query("SELECT COUNT(*) FROM product_category_type")).rows[0].count),
        products:               parseInt((await pool.query("SELECT COUNT(*) FROM product")).rows[0].count),
        product_images:         parseInt((await pool.query("SELECT COUNT(*) FROM product_image")).rows[0].count),
      };

      logger.info(`[Seed] InventoryService complete: ${JSON.stringify(totals)}`);

      // Publish inventory.events so other services know products are available
      await publishEvent(TOPICS.INVENTORY_EVENTS, "seed", {
        eventType:              "PRODUCTS_SEEDED",
        usingPlaceholderSeller: sellerIds.length === 0,
        totals,
        occurredAt:             new Date().toISOString(),
      });

      res.json({
        service:                  "InventoryService",
        using_placeholder_seller: sellerIds.length === 0,
        inserted: {
          subcategories: subcatsInserted,
          products:      productsInserted,
          images:        imagesInserted,
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
