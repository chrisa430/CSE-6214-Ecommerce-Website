/**
 * @fileoverview Three route handlers
 * @module accounts.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { getPool } from "../db/pool";
import { publishEvent, TOPICS } from "../kafka/client";
import { validateRegistration } from "../middleware/validation";
import { logger } from "../logger";

const router = Router();
const BCRYPT_ROUNDS = 12;

/**
 * Internal auth guard (service-to-service)
 * @param req
 * @param res
 * @param next
 * @param password
 * @returns void
 * @remarks
 * -
 */
function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  const secret = req.headers["x-internal-secret"];
  if (secret !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/**
 * POST /accounts/register
 *
 * @returns Promise<void>
 * @remarks
 * -
 *
 */
router.post(
  "/register",
  validateRegistration,
  async (req: Request, res: Response): Promise<void> => {
    const { userId, password, firstName, lastName, accountType } = req.body;
    const pool = getPool();

    try {
      // Duplicate email check
      const existing = await pool.query(
        "SELECT id FROM account WHERE user_id = $1",
        [userId.toLowerCase()]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }

      // Resolve type_id and default status_id
      const typeRow = await pool.query(
        "SELECT id FROM account_type WHERE name = $1",
        [accountType]
      );
      if (!typeRow.rowCount || typeRow.rowCount === 0) {
        res.status(400).json({ error: "Invalid account type." });
        return;
      }

      const statusRow = await pool.query(
        "SELECT id FROM account_status WHERE name = 'active'"
      );

      const typeId   = typeRow.rows[0].id as string;
      const statusId = statusRow.rows[0].id as string;

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Insert account
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

      // Audit log
      await pool.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [newAccount.id, newAccount.id, "ACCOUNT_CREATED", `Account created for ${userId}`]
      );

      // Publish Kafka event
      await publishEvent(TOPICS.ACCOUNT_EVENTS, newAccount.id, {
        eventType:   "ACCOUNT_CREATED",
        accountId:   newAccount.id,
        email:       userId.toLowerCase(),
        accountType,
        occurredAt:  new Date().toISOString(),
      });

      logger.info(`Account created: ${userId} (${accountType})`);

      res.status(201).json({
        message:   "Account created successfully.",
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

/**
 * GET /internal/accounts/by-email/:email
 *
 * @returns Promise<void>
 * @remarks
 * - Called internally by AuthnAuthzService for credential verification
 *
 */
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

/**
 * GET /accounts/:id
 *
 * @returns Promise<void>
 * @remarks
 * -
 *
 */
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
