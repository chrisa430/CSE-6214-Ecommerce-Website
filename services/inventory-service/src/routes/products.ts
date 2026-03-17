import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { requireAuth } from "../middleware/authGuard";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/test", (_req: Request, res: Response) => {
  res.json({ message: "Inventory routes working" });
});

router.get("/db-test", async (_req: Request, res: Response) => {
  const pool = getPool();

  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Database query failed" });
  }
});

router.get("/categories", async (_req: Request, res: Response) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT id, name
       FROM category_type
       ORDER BY name ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

router.get("/mine-test", async (_req: Request, res: Response) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT id, name, created_at FROM product LIMIT 5`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Query failed" });
  }
});

// Create product
router.post("/", requireAuth, requireRole("seller"), async (req: Request, res: Response) => {
  const pool = getPool();
  const sellerId = (req as any).user.sub;

  const {
    name,
    shortDesc,
    longDesc,
    category,
    subCategory,
    quantity,
    unitPrice,
  } = req.body;

  if (!name || !category) {
    res.status(400).json({ error: "name and category are required" });
    return;
  }

  try {
    const pendingStatus = await pool.query(
      `SELECT id FROM product_status_type WHERE name = 'pending'`
    );

    const pendingStatusId = pendingStatus.rows[0]?.id;

    const result = await pool.query(
      `INSERT INTO product
        (seller_id, name, short_desc, long_desc, category, sub_category, quantity, unit_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING
         id,
         seller_id,
         name,
         short_desc AS "shortDesc",
         long_desc AS "longDesc",
         quantity,
         unit_price AS "unitPrice",
         status,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        sellerId,
        name,
        shortDesc ?? null,
        longDesc ?? null,
        category,
        subCategory ?? null,
        quantity ?? 0,
        unitPrice ?? 0,
        pendingStatusId,
      ]
    );

    const statusResult = await pool.query(
      `SELECT name FROM product_status_type WHERE id = $1`,
      [result.rows[0].status]
    );

    result.rows[0].status = statusResult.rows[0]?.name ?? "pending";

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/active", async (_req: Request, res: Response) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.short_desc AS "shortDesc",
        p.long_desc AS "longDesc",
        p.quantity,
        p.unit_price AS "unitPrice",
        pst.name AS status,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(
          (SELECT image_url
           FROM product_image
           WHERE product_id = p.id
           LIMIT 1),
          '/images/default-product.png'
        ) AS "imageUrl"
       FROM product p
       JOIN product_status_type pst ON pst.id = p.status
       WHERE pst.name = 'active'
         AND p.quantity > 0
       ORDER BY p.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get my products
router.get("/mine", requireAuth, requireRole("seller"), async (req: Request, res: Response) => {
  const pool = getPool();
  const sellerId = (req as any).user.sub;

  try {
    const result = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.short_desc AS "shortDesc",
        p.long_desc AS "longDesc",
        p.quantity,
        p.unit_price AS "unitPrice",
        pst.name AS status,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(
            (SELECT image_url
            FROM product_image
            WHERE product_id = p.id
            LIMIT 1),
            '/images/default-product.png'
        ) AS "imageUrl"
        FROM product p
        LEFT JOIN product_status_type pst ON pst.id = p.status
        WHERE p.seller_id = $1
        AND pst.name != 'removed'
        ORDER BY p.created_at DESC`,
      [sellerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update product
router.patch("/:id", requireAuth, requireRole("seller"), async (req: Request, res: Response) => {
  const pool = getPool();
  const sellerId = (req as any).user.sub;
  const productId = req.params.id;

  const {
    name,
    shortDesc,
    longDesc,
    quantity,
    unitPrice,
  } = req.body;

  try {
    const existing = await pool.query(
      `SELECT * FROM product WHERE id = $1 AND seller_id = $2`,
      [productId, sellerId]
    );

    if (!existing.rowCount) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const protectedFieldChanged =
      name !== undefined || shortDesc !== undefined || longDesc !== undefined;

    let nextStatusId = existing.rows[0].status;

    if (protectedFieldChanged) {
      const pendingStatus = await pool.query(
        `SELECT id FROM product_status_type WHERE name = 'pending'`
      );
      nextStatusId = pendingStatus.rows[0]?.id;
    }

    const result = await pool.query(
      `UPDATE product
       SET
         name = COALESCE($1, name),
         short_desc = COALESCE($2, short_desc),
         long_desc = COALESCE($3, long_desc),
         quantity = COALESCE($4, quantity),
         unit_price = COALESCE($5, unit_price),
         status = $6
       WHERE id = $7 AND seller_id = $8
       RETURNING
         id,
         seller_id,
         name,
         short_desc AS "shortDesc",
         long_desc AS "longDesc",
         quantity,
         unit_price AS "unitPrice",
         status,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        name ?? null,
        shortDesc ?? null,
        longDesc ?? null,
        quantity ?? null,
        unitPrice ?? null,
        nextStatusId,
        productId,
        sellerId,
      ]
    );

    const statusResult = await pool.query(
      `SELECT name FROM product_status_type WHERE id = $1`,
      [result.rows[0].status]
    );

    result.rows[0].status = statusResult.rows[0]?.name ?? "pending";

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/image", requireAuth, requireRole("seller"), async (req: Request, res: Response) => {
  const pool = getPool();
  const sellerId = (req as any).user.sub;
  const productId = req.params.id;

  const { imageUrl } = req.body;

  if (!imageUrl) {
    res.status(400).json({ error: "imageUrl is required" });
    return;
  }

  try {
    const existing = await pool.query(
      `SELECT id FROM product WHERE id = $1 AND seller_id = $2`,
      [productId, sellerId]
    );

    if (!existing.rowCount) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    await pool.query(
      `DELETE FROM product_image WHERE product_id = $1`,
      [productId]
    );

    await pool.query(
      `INSERT INTO product_image (product_id, image_url)
       VALUES ($1, $2)`,
      [productId, imageUrl]
    );

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update image" });
  }
});

// Remove product listing
router.delete("/:id", requireAuth, requireRole("seller"), async (req: Request, res: Response) => {
  const pool = getPool();
  const sellerId = (req as any).user.sub;
  const productId = req.params.id;

  try {
    const removedStatus = await pool.query(
      `SELECT id FROM product_status_type WHERE name = 'removed'`
    );

    const result = await pool.query(
      `UPDATE product
       SET status = $1
       WHERE id = $2 AND seller_id = $3
       RETURNING id`,
      [removedStatus.rows[0].id, productId, sellerId]
    );

    if (!result.rowCount) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ message: "Product removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;