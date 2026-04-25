/**
 * @fileoverview Address routes — mounted at /accounts/:id/addresses
 * @module routes/addresses.ts
 */
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getPool } from "../db/pool";
import { logger }  from "../logger";

const router = Router({ mergeParams: true });
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";

function getUser(req: Request): { sub: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), ACCESS_SECRET) as { sub: string }; } catch { return null; }
}

function ownAccountGuard(req: Request, res: Response): boolean {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return false; }
  if (user.sub !== req.params.id) {
    res.status(403).json({ error: "You can only modify your own account" }); return false;
  }
  return true;
}

// ── GET /accounts/:id/addresses ───────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT a.id,
              at.name         AS "addressType",
              a.street1, a.street2, a.city, a.zipcode,
              s.abbrev  AS state,
              s.name          AS "stateName"
       FROM   address a
       JOIN   address_type at ON at.id = a.address_type
       LEFT JOIN state s       ON s.id  = a.state_id
       WHERE  a.account_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    logger.error("Get addresses error", err);
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// ── PUT /accounts/:id/addresses — save or update a billing/shipping address ───

router.put("/", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;

  const { addressType, street1, street2, city, state, zipcode } = req.body as {
    addressType: string; street1: string; street2?: string;
    city: string; state: string; zipcode: string;
  };

  // Validate required fields
  if (!["billing", "shipping"].includes(addressType)) {
    res.status(400).json({ error: "addressType must be 'billing' or 'shipping'" }); return;
  }
  if (!street1?.trim() || !city?.trim() || !state?.trim() || !zipcode?.trim()) {
    res.status(400).json({ error: "street1, city, state, and zipcode are required" }); return;
  }

  const pool = getPool();
  try {
    // 1. Resolve address_type row
    const atRow = await pool.query(
      "SELECT id FROM address_type WHERE name = $1", [addressType]
    );
    if (!atRow.rowCount) {
      res.status(400).json({ error: `Address type '${addressType}' not found` }); return;
    }
    const addressTypeId: string = atRow.rows[0].id;

    // 2. Resolve state UUID from abbreviation (case-insensitive)
    let stateId: string | null = null;
    const stateRow = await pool.query(
      "SELECT id FROM state WHERE UPPER(abbrev) = UPPER($1)", [state.trim()]
    );
    if (stateRow.rowCount) {
      stateId = stateRow.rows[0].id as string;
    }

    // 3. Check if address already exists for this account + type
    const existingRow = await pool.query(
      `SELECT a.id FROM address a
       WHERE  a.account_id   = $1
         AND  a.address_type = $2`,
      [req.params.id, addressTypeId]
    );

    if (existingRow.rowCount) {
      // UPDATE existing row
      await pool.query(
        `UPDATE address
         SET    street1  = $1,
                street2  = $2,
                city     = $3,
                state_id = $4,
                zipcode  = $5
         WHERE  id = $6`,
        [
          street1.trim(),
          street2?.trim() || null,
          city.trim(),
          stateId,
          zipcode.trim(),
          existingRow.rows[0].id,
        ]
      );
    } else {
      // INSERT new row
      await pool.query(
        `INSERT INTO address
           (account_id, address_type, street1, street2, city, state_id, zipcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.params.id,
          addressTypeId,
          street1.trim(),
          street2?.trim() || null,
          city.trim(),
          stateId,
          zipcode.trim(),
        ]
      );
    }

    res.json({ message: `${addressType} address saved successfully` });
  } catch (err: any) {
    logger.error("Save address error", { message: err?.message, detail: err?.detail });
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

export default router;
