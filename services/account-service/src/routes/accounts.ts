/**
 * @fileoverview Account route handlers
 * @module accounts.ts
 * @author Darrell Hobson
 * @Date 2026.03.30
 */
import { Router, Request, Response } from "express";
import bcrypt                         from "bcrypt";
import { getPool }                    from "../db/pool";
import { publishEvent, TOPICS }       from "../kafka/client";
import { validateRegistration }       from "../middleware/validation";
import { logger }                     from "../logger";
import { requireAuth }                 from "../middleware/authGuard";

const router        = Router();
const BCRYPT_ROUNDS = 12;

// ── Seed password — must be supplied via environment; never hard-coded ─────────
// SEED_PASSWORD is required for the seed endpoint; defaults to a placeholder for local dev.
const SEED_PASSWORD = process.env.SEED_PASSWORD || "local-dev-seed-password";

// ── Internal-secret guard ─────────────────────────────────────────────────────

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  const secret = req.headers["x-internal-secret"];
  if (secret !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// ── POST /accounts/register ───────────────────────────────────────────────────

router.post(
  "/register",
  validateRegistration,
  async (req: Request, res: Response): Promise<void> => {
    const { userId, password, firstName, lastName, accountType } = req.body;
    const pool = getPool();
    try {
      const existing = await pool.query("SELECT id FROM account WHERE user_id = $1", [userId.toLowerCase()]);
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({ error: "An account with this email already exists." }); return;
      }
      const typeRow = await pool.query("SELECT id FROM account_type WHERE name = $1", [accountType]);
      if (!typeRow.rowCount || typeRow.rowCount === 0) {
        res.status(400).json({ error: "Invalid account type." }); return;
      }
      const statusRow = await pool.query("SELECT id FROM account_status WHERE name = 'open'");
      if (!statusRow.rowCount || statusRow.rowCount === 0) {
        res.status(500).json({ error: "Account status 'open' not found." }); return;
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const insertResult = await pool.query(
        `INSERT INTO account (user_id, password_hash, first_name, last_name, type_id, status_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, first_name, last_name, created_at`,
        [userId.toLowerCase(), passwordHash, firstName.trim(), lastName.trim(),
         typeRow.rows[0].id, statusRow.rows[0].id]
      );
      const newAccount = insertResult.rows[0];
      await pool.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail) VALUES ($1, $2, $3, $4)`,
        [newAccount.id, newAccount.id, "ACCOUNT_CREATION_SUBMITTED", `Submitted: ${userId}`]
      );
      const adminAccounts = await pool.query(
        `SELECT a.id FROM account a JOIN account_type at ON at.id = a.type_id WHERE at.name = 'admin'`
      );
      const adminAccountIds = adminAccounts.rows.map((r: any) => r.id as string);
      await publishEvent(TOPICS.ACCOUNT_EVENTS, newAccount.id, {
        eventType: "ACCOUNT_CREATION_SUBMITTED",
        accountId: newAccount.id as string,
        email: userId.toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim(),
        accountType, adminAccountIds,
        appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",
        occurredAt: new Date().toISOString(),
      });
      logger.info(`Account creation submitted: ${userId} (${accountType})`);
      res.status(201).json({
        message: "Account creation request submitted. Pending admin approval.",
        accountId: newAccount.id,
        user: { id: newAccount.id, email: newAccount.user_id,
                firstName: newAccount.first_name, lastName: newAccount.last_name },
      });
    } catch (err) {
      logger.error("Registration error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/search ──────────────────────────────────────────────────────

router.get("/search", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  const { type = "", status = "", sortBy = "created_at", sortOrder = "desc" } =
    req.query as Record<string, string>;
  const allowedSortBy: Record<string, string> = {
    activated_date: "a.activated_date", suspended_date: "a.suspended_date",
    closed_date: "a.closed_date",       created_at: "a.created_at",
  };
  const orderCol = allowedSortBy[sortBy] ?? "a.created_at";
  const orderDir = ["asc","desc"].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : "desc";
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (type.trim())   { params.push(type.trim());   conditions.push(`at.name  = $${params.length}`); }
  if (status.trim()) { params.push(status.trim()); conditions.push(`ast.name = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const result = await pool.query(
      `SELECT a.id, a.user_id AS "userId", a.first_name AS "firstName", a.last_name AS "lastName",
              at.name AS type, ast.name AS status,
              a.activated_date AS "activatedDate", a.suspended_date AS "suspendedDate",
              a.closed_date AS "closedDate", a.created_at AS "createdAt"
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       ${where}
       ORDER BY ${orderCol} ${orderDir} NULLS LAST`, params
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Account search error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /internal/accounts/by-email/:email ───────────────────────────────────

router.get(
  "/by-email/:email",
  requireInternalSecret as any,
  async (req: Request, res: Response): Promise<void> => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const pool  = getPool();
    try {
      const result = await pool.query(
        `SELECT a.id, a.password_hash AS "passwordHash",
                a.first_name AS "firstName", a.last_name AS "lastName",
                at.name AS type, ast.name AS status
         FROM account a
         JOIN account_type   at  ON at.id  = a.type_id
         JOIN account_status ast ON ast.id = a.status_id
         WHERE a.user_id = $1`, [email]
      );
      if (!result.rowCount || result.rowCount === 0) {
        res.status(404).json({ error: "Account not found" }); return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      logger.error("Internal account lookup error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/:id ─────────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT a.id, a.user_id AS email, a.first_name AS "firstName", a.last_name AS "lastName",
              at.name AS type, ast.name AS status, a.created_at AS "createdAt"
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       WHERE a.id = $1`, [req.params.id]
    );
    if (!result.rowCount || result.rowCount === 0) {
      res.status(404).json({ error: "Account not found" }); return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Account fetch error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /accounts/internal/seed-admin ───────────────────────────────────────
// Seeds the initial admin account. Idempotent — skips if email already exists.
// Reads credentials from env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST, ADMIN_LAST

router.post(
  "/internal/seed-admin",
  requireInternalSecret as any,
  async (_req: Request, res: Response): Promise<void> => {
    const pool         = getPool();

    // All admin seed credentials must come from the environment — no hardcoded fallbacks.
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      res.status(500).json({ error: "ADMIN_EMAIL and ADMIN_PASSWORD env vars are required for seeding." });
      return;
    }
    const adminEmail   = process.env.ADMIN_EMAIL.toLowerCase();
    const adminPass    = process.env.ADMIN_PASSWORD;
    const adminFirst   = process.env.ADMIN_FIRST ?? "Admin";
    const adminLast    = process.env.ADMIN_LAST  ?? "User";
    try {
      const existing = await pool.query("SELECT id FROM account WHERE user_id = $1", [adminEmail]);
      if (existing.rowCount && existing.rowCount > 0) {
        logger.info(`[Seed] Admin already exists: ${adminEmail}`);
        res.json({ service: "AccountService", admin_seeded: false,
                   message: "Admin account already exists", email: adminEmail });
        return;
      }
      const typeRow = await pool.query("SELECT id FROM account_type WHERE name = 'admin'");
      if (!typeRow.rowCount || typeRow.rowCount === 0) {
        res.status(500).json({ error: "account_type 'admin' not found" }); return;
      }
      const statusRow = await pool.query("SELECT id FROM account_status WHERE name = 'active'");
      if (!statusRow.rowCount || statusRow.rowCount === 0) {
        res.status(500).json({ error: "account_status 'active' not found" }); return;
      }
      const passwordHash = await bcrypt.hash(adminPass, BCRYPT_ROUNDS);
      const result = await pool.query(
        `INSERT INTO account
           (user_id, password_hash, first_name, last_name, type_id, status_id, activated_date)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, user_id, first_name, last_name, created_at`,
        [adminEmail, passwordHash, adminFirst, adminLast,
         typeRow.rows[0].id, statusRow.rows[0].id]
      );
      const acct = result.rows[0];
      await pool.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail) VALUES ($1, $2, $3, $4)`,
        [acct.id, acct.id, "ACCOUNT_SEEDED", `Admin seeded: ${adminEmail}`]
      );
      logger.info(`[Seed] Admin account created: ${adminEmail}`);
      res.status(201).json({
        service: "AccountService", admin_seeded: true,
        id: acct.id, email: acct.user_id,
        name: `${acct.first_name} ${acct.last_name}`, created_at: acct.created_at,
      });
    } catch (err) {
      logger.error("Admin seed error", err);
      res.status(500).json({ error: "Admin seed failed", detail: String(err) });
    }
  }
);

// ── POST /accounts/internal/seed ─────────────────────────────────────────────
// Seeds 100 buyers + 25 sellers + 10 admins (135 total). Idempotent.
// Returns buyer_ids, seller_ids, and admin_ids for downstream seed steps.
//
// Buyer/Seller password : SEED_PASSWORD env var
// Admin password        : ADMIN_SEED_PASSWORD env var (default: Admin1234!)

router.post(
  "/internal/seed",
  requireInternalSecret as any,
  async (_req: Request, res: Response): Promise<void> => {
    const pool = getPool();

    // ── Name pools ──────────────────────────────────────────────────────────
    // 10 × 10 = 100 unique buyer full names
    const BUYER_FIRST  = ["Aaron","Brooke","Cameron","Diana","Ethan","Fiona","Gabriel","Hailey","Isaac","Jasmine"];
    const BUYER_LAST   = ["Anderson","Baker","Carter","Davis","Evans","Foster","Garcia","Harris","Irving","Johnson"];
    // 5 × 5 = 25 unique seller full names
    const SELLER_FIRST = ["Kyle","Lauren","Marcus","Natalie","Oscar"];
    const SELLER_LAST  = ["Phillips","Quinn","Roberts","Scott","Turner"];
    // 10 fixed admin identities
    const ADMIN_NAMES  = [
      { first:"Alex",  last:"Morgan"   },{ first:"Beth",  last:"Hamilton" },
      { first:"Carl",  last:"Stevens"  },{ first:"Diana", last:"Walsh"    },
      { first:"Eric",  last:"Chambers" },{ first:"Faye",  last:"Thornton" },
      { first:"Grant", last:"Wheeler"  },{ first:"Helen", last:"Burke"    },
      { first:"Ian",   last:"Caldwell" },{ first:"Julia", last:"Reeves"   },
    ];

    const pad  = (n: number, w: number) => String(n).padStart(w, "0");
    const dAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

    interface Acct {
      email: string; first: string; last: string;
      type: string;  status: string;
      activatedDaysAgo: number | null;
      suspendedDaysAgo?: number;
      closedDaysAgo?: number;
      isAdmin?: boolean;
    }

    // ── 100 buyers: buyers 91-97 suspended, 98-100 closed, rest active ──────
    const BUYERS: Acct[] = Array.from({ length: 100 }, (_, i) => {
      const n = i + 1;
      const fi = Math.floor(i / 10), li = i % 10;
      let status = "active", aDays: number | null = ((n * 7) % 365) + 1;
      let sDays: number | undefined, cDays: number | undefined;
      if (n >= 91 && n <= 97) { status="suspended"; aDays=90+(n%7)*10; sDays=(n%30)+1; }
      else if (n >= 98)        { status="closed";    aDays=180+n;       cDays=(n%20)+5; }
      return { email:`buyer${pad(n,3)}@sportvault.com`,
               first:BUYER_FIRST[fi], last:BUYER_LAST[li],
               type:"buyer", status, activatedDaysAgo:aDays,
               suspendedDaysAgo:sDays, closedDaysAgo:cDays };
    });

    // ── 25 sellers: sellers 21-23 suspended, 24-25 closed, rest active ──────
    const SELLERS: Acct[] = Array.from({ length: 25 }, (_, i) => {
      const n = i + 1;
      const fi = Math.floor(i / 5), li = i % 5;
      let status = "active", aDays: number | null = ((n * 11) % 300) + 14;
      let sDays: number | undefined, cDays: number | undefined;
      if (n >= 21 && n <= 23) { status="suspended"; aDays=120+n*5; sDays=(n%15)+3; }
      else if (n >= 24)        { status="closed";    aDays=200+n*3; cDays=(n%10)+7; }
      return { email:`seller${pad(n,3)}@sportvault.com`,
               first:SELLER_FIRST[fi], last:SELLER_LAST[li],
               type:"seller", status, activatedDaysAgo:aDays,
               suspendedDaysAgo:sDays, closedDaysAgo:cDays };
    });

    // ── 10 admins: all active ────────────────────────────────────────────────
    const ADMINS: Acct[] = ADMIN_NAMES.map((nm, i) => ({
      email:`admin${pad(i+1,3)}@sportvault.com`, first:nm.first, last:nm.last,
      type:"admin", status:"active", activatedDaysAgo:(i+1)*15, isAdmin:true,
    }));

    const ALL: Acct[] = [...BUYERS, ...SELLERS, ...ADMINS];

    try {
      const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD || "Admin1234!";
      const buyerHash = await bcrypt.hash(SEED_PASSWORD,       BCRYPT_ROUNDS);
      const adminHash = await bcrypt.hash(adminSeedPassword,   BCRYPT_ROUNDS);

      let inserted = 0, skipped = 0;

      for (const u of ALL) {
        const exists = await pool.query(
          "SELECT id FROM account WHERE user_id = $1", [u.email]
        );
        if (exists.rowCount && exists.rowCount > 0) { skipped++; continue; }

        const typeRow   = await pool.query(
          "SELECT id FROM account_type   WHERE name = $1", [u.type]
        );
        const statusRow = await pool.query(
          "SELECT id FROM account_status WHERE name = $1", [u.status]
        );
        if (!typeRow.rowCount || !statusRow.rowCount) { skipped++; continue; }

        const hash  = u.isAdmin ? adminHash : buyerHash;
        const aDate = u.activatedDaysAgo  != null ? dAgo(u.activatedDaysAgo)  : null;
        const sDate = u.suspendedDaysAgo  != null ? dAgo(u.suspendedDaysAgo)  : null;
        const cDate = u.closedDaysAgo     != null ? dAgo(u.closedDaysAgo)     : null;

        const r = await pool.query(
          `INSERT INTO account
             (user_id, password_hash, first_name, last_name,
              type_id, status_id, activated_date, suspended_date, closed_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id`,
          [u.email, hash, u.first, u.last,
           typeRow.rows[0].id, statusRow.rows[0].id,
           aDate, sDate, cDate]
        );
        await pool.query(
          `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
           VALUES ($1,$2,$3,$4)`,
          [r.rows[0].id, r.rows[0].id, "ACCOUNT_SEEDED",
           `Seeded ${u.type}: ${u.email}`]
        );
        inserted++;
      }

      // Return all IDs grouped by type for downstream seed steps
      const buyers  = (await pool.query(
        `SELECT a.id FROM account a
         JOIN account_type t ON t.id = a.type_id WHERE t.name = 'buyer'`
      )).rows.map((r: any) => r.id as string);

      const sellers = (await pool.query(
        `SELECT a.id FROM account a
         JOIN account_type t ON t.id = a.type_id WHERE t.name = 'seller'`
      )).rows.map((r: any) => r.id as string);

      const admins  = (await pool.query(
        `SELECT a.id FROM account a
         JOIN account_type t ON t.id = a.type_id WHERE t.name = 'admin'`
      )).rows.map((r: any) => r.id as string);

      logger.info(
        `[Seed] AccountService: inserted=${inserted}, skipped=${skipped}, ` +
        `buyers=${buyers.length}, sellers=${sellers.length}, admins=${admins.length}`
      );
      res.json({
        service: "AccountService",
        inserted, skipped,
        buyer_ids: buyers, seller_ids: sellers, admin_ids: admins,
      });
    } catch (err) {
      logger.error("Seed error", err);
      res.status(500).json({ error: "Seed failed", detail: String(err) });
    }
  }
);

export default router;

// ── Profile / Address / Payment routes (require JWT) ─────────────────────────

// ── PATCH /accounts/my/profile ────────────────────────────────────────────────

router.patch(
  "/my/profile",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const { firstName, lastName } = req.body as { firstName?: string; lastName?: string };
    const pool = getPool();
    try {
      await pool.query(
        `UPDATE account SET
           first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           updated_at = NOW()
         WHERE id = $3`,
        [firstName?.trim() || null, lastName?.trim() || null, accountId]
      );
      res.json({ message: "Profile updated" });
    } catch (err) {
      logger.error("Profile update error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/my/addresses ────────────────────────────────────────────────

router.get(
  "/my/addresses",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT a.id, at.name AS "addressType",
                a.street1, a.street2, a.city, a.zipcode,
                s.abbrev AS state, s.name AS "stateName"
         FROM address a
         JOIN address_type at ON at.id = a.address_type
         LEFT JOIN state s    ON s.id  = a.state_id
         WHERE a.account_id = $1`,
        [accountId]
      );
      res.json(result.rows);
    } catch (err) {
      logger.error("Get addresses error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── PUT /accounts/my/address ──────────────────────────────────────────────────
// Upserts a billing or shipping address (one of each allowed per account).

router.put(
  "/my/address",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const { addressType, street1, street2, city, state, zipcode } = req.body as {
      addressType: "billing" | "shipping";
      street1: string; street2?: string; city: string;
      state: string; zipcode: string;
    };
    if (!["billing","shipping"].includes(addressType)) {
      res.status(400).json({ error: "addressType must be 'billing' or 'shipping'" }); return;
    }
    const pool = getPool();
    try {
      const atRow = await pool.query(
        "SELECT id FROM address_type WHERE name = $1", [addressType]
      );
      if (!atRow.rowCount) { res.status(400).json({ error: "Invalid address type" }); return; }

      // Resolve state id from abbreviation
      let stateId: string | null = null;
      if (state) {
        const stRow = await pool.query(
          "SELECT id FROM state WHERE abbrev = $1 OR name ILIKE $1", [state]
        );
        stateId = stRow.rowCount ? (stRow.rows[0].id as string) : null;
      }

      await pool.query(
        `INSERT INTO address (account_id, address_type, street1, street2, city, state_id, zipcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (account_id, address_type)
         DO UPDATE SET
           street1    = EXCLUDED.street1,
           street2    = EXCLUDED.street2,
           city       = EXCLUDED.city,
           state_id   = EXCLUDED.state_id,
           zipcode    = EXCLUDED.zipcode`,
        [accountId, atRow.rows[0].id, street1, street2 || null, city, stateId, zipcode]
      );
      res.json({ message: `${addressType} address saved` });
    } catch (err) {
      logger.error("Save address error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/my/payment-methods ─────────────────────────────────────────

router.get(
  "/my/payment-methods",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT pm.id, pmt.name AS type, pm.nickname,
                pm.card_number AS "cardNumber",
                pm.exp_month AS "expMonth", pm.exp_year AS "expYear"
         FROM payment_method pm
         JOIN payment_method_type pmt ON pmt.id = pm.type
         WHERE pm.account_id = $1
         ORDER BY pm.id`,
        [accountId]
      );
      res.json(result.rows);
    } catch (err) {
      logger.error("Get payment methods error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /accounts/my/payment-methods ────────────────────────────────────────

router.post(
  "/my/payment-methods",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const { type, nickname, cardNumber, expMonth, expYear } = req.body as {
      type: string; nickname?: string;
      cardNumber: string; expMonth: number; expYear: number;
    };
    const pool = getPool();
    try {
      const typeRow = await pool.query(
        "SELECT id FROM payment_method_type WHERE name = $1", [type]
      );
      if (!typeRow.rowCount) { res.status(400).json({ error: "Invalid payment type" }); return; }

      // Store only last 4 digits
      const last4 = String(cardNumber).replace(/\D/g, "").slice(-4);

      const result = await pool.query(
        `INSERT INTO payment_method (account_id, type, nickname, card_number, exp_month, exp_year)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [accountId, typeRow.rows[0].id, nickname || null, last4, expMonth, expYear]
      );
      res.status(201).json({ id: result.rows[0].id, message: "Payment method added" });
    } catch (err: any) {
      // DB trigger fires if > 2 payment methods
      if (err.message?.includes("at most 2 payment methods")) {
        res.status(400).json({ error: "You can only have up to 2 payment methods." }); return;
      }
      logger.error("Add payment method error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── PUT /accounts/my/payment-methods/:id ─────────────────────────────────────

router.put(
  "/my/payment-methods/:pmId",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const { pmId }   = req.params;
    const { type, nickname, cardNumber, expMonth, expYear } = req.body as {
      type?: string; nickname?: string;
      cardNumber?: string; expMonth?: number; expYear?: number;
    };
    const pool = getPool();
    try {
      const existing = await pool.query(
        "SELECT id FROM payment_method WHERE id = $1 AND account_id = $2",
        [pmId, accountId]
      );
      if (!existing.rowCount) { res.status(404).json({ error: "Payment method not found" }); return; }

      let typeId: string | null = null;
      if (type) {
        const typeRow = await pool.query("SELECT id FROM payment_method_type WHERE name = $1", [type]);
        if (!typeRow.rowCount) { res.status(400).json({ error: "Invalid payment type" }); return; }
        typeId = typeRow.rows[0].id as string;
      }
      const last4 = cardNumber ? String(cardNumber).replace(/\D/g, "").slice(-4) : null;

      await pool.query(
        `UPDATE payment_method SET
           type        = COALESCE($1, type),
           nickname    = COALESCE($2, nickname),
           card_number = COALESCE($3, card_number),
           exp_month   = COALESCE($4, exp_month),
           exp_year    = COALESCE($5, exp_year)
         WHERE id = $6 AND account_id = $7`,
        [typeId, nickname ?? null, last4, expMonth ?? null, expYear ?? null, pmId, accountId]
      );
      res.json({ message: "Payment method updated" });
    } catch (err) {
      logger.error("Update payment method error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── DELETE /accounts/my/payment-methods/:id ───────────────────────────────────

router.delete(
  "/my/payment-methods/:pmId",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const { pmId }  = req.params;
    const pool = getPool();
    try {
      const r = await pool.query(
        "DELETE FROM payment_method WHERE id = $1 AND account_id = $2 RETURNING id",
        [pmId, accountId]
      );
      if (!r.rowCount) { res.status(404).json({ error: "Payment method not found" }); return; }
      res.json({ message: "Payment method removed" });
    } catch (err) {
      logger.error("Delete payment method error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/my/states ───────────────────────────────────────────────────

router.get("/my/states", async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const result = await pool.query(
      "SELECT id, name, abbrev AS abbreviation FROM state ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Get states error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /accounts/forgot-password ──────────────────────────────────────────
// Generates a reset token and logs it (simulated email delivery).
// Always returns the same success message regardless of whether the email exists.

router.post(
  "/forgot-password",
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" }); return;
    }
    const pool = getPool();
    try {
      // Ensure reset token table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_token (
          id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id UUID         NOT NULL REFERENCES account(id) ON DELETE CASCADE,
          token      VARCHAR(128) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
          used       BOOLEAN      NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      const acctRow = await pool.query(
        "SELECT id FROM account WHERE LOWER(user_id) = LOWER($1)", [email.trim()]
      );

      if (acctRow.rowCount) {
        // Delete any existing unused tokens for this account
        await pool.query(
          "DELETE FROM password_reset_token WHERE account_id = $1", [acctRow.rows[0].id]
        );
        // Generate a new token
        const { v4: uuidv4 } = await import("uuid");
        const token = uuidv4().replace(/-/g, "");
        await pool.query(
          "INSERT INTO password_reset_token (account_id, token) VALUES ($1, $2)",
          [acctRow.rows[0].id, token]
        );

        // Simulated email — log to console (real AWS SES would send this)
        const resetUrl = `${process.env.APP_BASE_URL || "http://localhost:5173"}/reset-password?token=${token}`;
        logger.info(`[PasswordReset] Reset link for ${email}: ${resetUrl}`);
      }

      // Always return the same response (don't leak whether email exists)
      res.json({
        message: "If that email is registered, a password reset link has been sent.",
      });
    } catch (err: any) {
      logger.error("Forgot password error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /accounts/reset-password ───────────────────────────────────────────
// Validates token and sets a new password.

router.post(
  "/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body as {
      token?: string; newPassword?: string;
    };
    if (!token?.trim() || !newPassword?.trim()) {
      res.status(400).json({ error: "Token and new password are required" }); return;
    }
    const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{8,}$/;
    if (!PASSWORD_RE.test(newPassword)) {
      res.status(400).json({
        error:
          "Password must be ≥8 characters with at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (* $ ! - @).",
      }); return;
    }
    const pool = getPool();
    try {
      const tokenRow = await pool.query(
        `SELECT id, account_id FROM password_reset_token
         WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
        [token.trim()]
      );
      if (!tokenRow.rowCount) {
        res.status(400).json({ error: "Reset link is invalid or has expired." }); return;
      }
      const { id: tokenId, account_id: accountId } = tokenRow.rows[0] as {
        id: string; account_id: string;
      };

      const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await pool.query(
        "UPDATE account SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [hash, accountId]
      );
      await pool.query(
        "UPDATE password_reset_token SET used = TRUE WHERE id = $1", [tokenId]
      );

      logger.info(`[PasswordReset] Password updated for account ${accountId}`);
      res.json({ message: "Password updated successfully. You can now sign in." });
    } catch (err: any) {
      logger.error("Reset password error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /accounts/my/change-password ────────────────────────────────────────
// Authenticated route — verifies current password then sets new password.

router.post(
  "/my/change-password",
  requireAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const accountId = (req as any).user.sub as string;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string; newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" }); return;
    }
    const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{8,}$/;
    if (!PASSWORD_RE.test(newPassword)) {
      res.status(400).json({
        error:
          "New password must be ≥8 characters with at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (* $ ! - @).",
      }); return;
    }
    const pool = getPool();
    try {
      const acctRow = await pool.query(
        "SELECT password_hash FROM account WHERE id = $1", [accountId]
      );
      if (!acctRow.rowCount) {
        res.status(404).json({ error: "Account not found" }); return;
      }
      const storedHash: string = acctRow.rows[0].password_hash;
      const matches = await bcrypt.compare(currentPassword, storedHash);
      if (!matches) {
        res.status(401).json({ error: "Current password is incorrect." }); return;
      }
      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await pool.query(
        "UPDATE account SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [newHash, accountId]
      );
      logger.info(`[ChangePassword] Password changed for account ${accountId}`);
      res.json({ message: "Password changed successfully." });
    } catch (err: any) {
      logger.error("Change password error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
