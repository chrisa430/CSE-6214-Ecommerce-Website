/**
 * @fileoverview Account route handlers
 * @module accounts.ts
 * @author Darrell Hobson
 * @Date 2026.03.05
 *
 * Sprint 4 changes:
 *   - POST /accounts/register sets status = 'open' (pending admin approval)
 *   - Publishes ACCOUNT_CREATION_SUBMITTED Kafka event with enough context for
 *     AdminService to insert notification rows into its own database.
 *     AccountService touches ONLY its own database — microservice boundary respected.
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { getPool }              from "../db/pool";
import { publishEvent, TOPICS } from "../kafka/client";
import { validateRegistration } from "../middleware/validation";
import { logger }               from "../logger";

const router        = Router();
const BCRYPT_ROUNDS = 12;

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
      // ── 1. Duplicate email check ──────────────────────────────────────────
      const existing = await pool.query(
        "SELECT id FROM account WHERE user_id = $1",
        [userId.toLowerCase()]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }

      // ── 2. Resolve type_id ────────────────────────────────────────────────
      const typeRow = await pool.query(
        "SELECT id FROM account_type WHERE name = $1",
        [accountType]
      );
      if (!typeRow.rowCount || typeRow.rowCount === 0) {
        res.status(400).json({ error: "Invalid account type." });
        return;
      }

      // ── 3. Resolve status_id = 'open' ─────────────────────────────────────
      const statusRow = await pool.query(
        "SELECT id FROM account_status WHERE name = 'open'"
      );
      if (!statusRow.rowCount || statusRow.rowCount === 0) {
        res.status(500).json({ error: "Account status 'open' not found. Check DB seed data." });
        return;
      }

      const typeId   = typeRow.rows[0].id   as string;
      const statusId = statusRow.rows[0].id as string;

      // ── 4. Hash password ──────────────────────────────────────────────────
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // ── 5. Insert account ─────────────────────────────────────────────────
      const insertResult = await pool.query(
        `INSERT INTO account (user_id, password_hash, first_name, last_name, type_id, status_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, first_name, last_name, created_at`,
        [
          userId.toLowerCase(),
          passwordHash,
          firstName.trim(),
          lastName.trim(),
          typeId,
          statusId,
        ]
      );

      const newAccount = insertResult.rows[0];

      // ── 6. Audit log (own DB only) ────────────────────────────────────────
      await pool.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [
          newAccount.id,
          newAccount.id,
          "ACCOUNT_CREATION_SUBMITTED",
          `Account creation submitted for ${userId}`,
        ]
      );

      // ── 7. Fetch admin account IDs (own DB — account_type='admin') ────────
      //
      // AccountService queries its own DB for admin IDs and includes them in
      // the Kafka event payload. AdminService consumes the event and writes
      // notification rows into its own database — no cross-DB writes here.
      const adminAccounts = await pool.query(
        `SELECT a.id
         FROM account a
         JOIN account_type at ON at.id = a.type_id
         WHERE at.name = 'admin'`
      );

      const adminAccountIds = adminAccounts.rows.map((r) => r.id as string);

      // ── 8. Publish enriched Kafka event ───────────────────────────────────
      await publishEvent(TOPICS.ACCOUNT_EVENTS, newAccount.id, {
        eventType:       "ACCOUNT_CREATION_SUBMITTED",
        accountId:       newAccount.id as string,
        email:           userId.toLowerCase(),
        firstName:       firstName.trim(),
        lastName:        lastName.trim(),
        accountType,
        adminAccountIds,                           // AdminService uses these to notify each admin
        appBaseUrl:      process.env.APP_BASE_URL || "http://localhost:5173",
        occurredAt:      new Date().toISOString(),
      });

      logger.info(`Account creation submitted: ${userId} (${accountType})`);

      res.status(201).json({
        message:   "Account creation request submitted. Pending admin approval.",
        accountId: newAccount.id,
        user: {
          id:        newAccount.id,
          email:     newAccount.user_id,
          firstName: newAccount.first_name,
          lastName:  newAccount.last_name,
        },
      });
    } catch (err) {
      logger.error("Registration error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/search  (admin — search/filter/sort all accounts) ──────────
/**
 * Query params:
 *   type     — filter by account type name (admin | buyer | seller)
 *   status   — filter by account status name (active | suspended | closed | open)
 *   sortBy   — column to sort by: activated_date | suspended_date | closed_date | created_at (default)
 *   sortOrder — asc | desc (default: desc)
 *
 * Returns all matching accounts with the columns required for the admin UI.
 */
router.get("/search", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();

  const {
    type      = "",
    status    = "",
    sortBy    = "created_at",
    sortOrder = "desc",
  } = req.query as Record<string, string>;

  // Whitelist sortBy and sortOrder to prevent SQL injection
  const allowedSortBy: Record<string, string> = {
    activated_date: "a.activated_date",
    suspended_date: "a.suspended_date",
    closed_date:    "a.closed_date",
    created_at:     "a.created_at",
  };
  const allowedOrder = ["asc", "desc"];

  const orderCol = allowedSortBy[sortBy] ?? "a.created_at";
  const orderDir = allowedOrder.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : "desc";

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const params:     unknown[] = [];

  if (type.trim()) {
    params.push(type.trim());
    conditions.push(`at.name = $${params.length}`);
  }
  if (status.trim()) {
    params.push(status.trim());
    conditions.push(`ast.name = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.user_id          AS "userId",
         a.first_name       AS "firstName",
         a.last_name        AS "lastName",
         at.name            AS type,
         ast.name           AS status,
         a.activated_date   AS "activatedDate",
         a.suspended_date   AS "suspendedDate",
         a.closed_date      AS "closedDate",
         a.created_at       AS "createdAt"
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       ${whereClause}
       ORDER BY ${orderCol} ${orderDir} NULLS LAST`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Account search error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



router.get(
  "/by-email/:email",
  requireInternalSecret as any,
  async (req: Request, res: Response): Promise<void> => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const pool  = getPool();

    try {
      const result = await pool.query(
        `SELECT
           a.id,
           a.password_hash AS "passwordHash",
           a.first_name    AS "firstName",
           a.last_name     AS "lastName",
           at.name         AS type,
           ast.name        AS status
         FROM account a
         JOIN account_type   at  ON at.id  = a.type_id
         JOIN account_status ast ON ast.id = a.status_id
         WHERE a.user_id = $1`,
        [email]
      );

      if (!result.rowCount || result.rowCount === 0) {
        res.status(404).json({ error: "Account not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      logger.error("Internal account lookup error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /accounts/:id ────────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.user_id       AS email,
         a.first_name    AS "firstName",
         a.last_name     AS "lastName",
         at.name         AS type,
         ast.name        AS status,
         a.created_at    AS "createdAt"
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!result.rowCount || result.rowCount === 0) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Account fetch error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
