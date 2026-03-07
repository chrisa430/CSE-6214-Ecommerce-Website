/**
 * @fileoverview AdminService route handlers
 * @module routes/admin.ts
 * @author Darrell Hobson
 * @Date 2026.03.04
 *
 * Routes exposed:
 *   GET  /admin/accounts/open      — list all accounts awaiting approval
 *   POST /admin/accounts/decision  — bulk approve or reject open accounts
 */
import { Router, Request, Response } from "express";
import { getPool }                   from "../db/pool";
import { getAccountPool }            from "../db/accountPool";
import { publishEvent, TOPICS }      from "../kafka/client";
import { logger }                    from "../logger";

const router = Router();

// ── GET /admin/accounts/open ─────────────────────────────────────────────────
/**
 * Returns all account records with status = 'open' (pending admin approval).
 * Called by the React frontend AdminSubpage.tsx via /api/admin/accounts/open.
 */
router.get("/accounts/open", async (_req: Request, res: Response): Promise<void> => {
  const accountPool = getAccountPool();
  try {
    const result = await accountPool.query(
      `SELECT
         a.id,
         a.user_id    AS email,
         a.first_name AS "firstName",
         a.last_name  AS "lastName",
         at.name      AS type,
         ast.name     AS status,
         a.created_at AS "createdAt"
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       WHERE ast.name = 'open'
       ORDER BY a.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Error fetching open accounts", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/accounts/decision ────────────────────────────────────────────
/**
 * Bulk approve or reject one or more open accounts.
 *
 * Body:
 *   { accountIds: string[], decision: "approve" | "reject" }
 *
 * On approve → status set to "active"
 * On reject  → status set to "closed"
 *
 * After updating accounts this handler also:
 *   1. Inserts a notification row (outbox) for each affected user
 *   2. Publishes an ADMIN_DECISION Kafka event
 */
router.post("/accounts/decision", async (req: Request, res: Response): Promise<void> => {
  const { accountIds, decision } = req.body as {
    accountIds: string[];
    decision:   "approve" | "reject";
  };

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    res.status(400).json({ error: "accountIds must be a non-empty array." });
    return;
  }
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "decision must be 'approve' or 'reject'." });
    return;
  }

  const accountPool = getAccountPool();
  const adminPool   = getPool();
  const newStatus   = decision === "approve" ? "active" : "closed";

  try {
    // ── 1. Resolve the target status id ──────────────────────────────────────
    const statusRow = await accountPool.query(
      "SELECT id FROM account_status WHERE name = $1",
      [newStatus]
    );
    if (!statusRow.rowCount) {
      res.status(500).json({ error: `Status '${newStatus}' not found in account DB.` });
      return;
    }
    const statusId = statusRow.rows[0].id as string;

    // ── 2. Update account status + audit log ─────────────────────────────────
    for (const accountId of accountIds) {
      await accountPool.query(
        "UPDATE account SET status_id = $1, updated_at = NOW() WHERE id = $2",
        [statusId, accountId]
      );

      await accountPool.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [
          accountId,
          accountId,
          decision === "approve" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_REJECTED",
          `Account ${decision}d by admin`,
        ]
      );
    }

    // ── 3. Insert outbox notification for each affected user ─────────────────
    try {
      const notifTypeName = decision === "approve" ? "account activated" : "account closed";
      const [stRow, ntRow] = await Promise.all([
        adminPool.query("SELECT id FROM service_type      WHERE name = 'email'"),
        adminPool.query("SELECT id FROM notification_type WHERE name = $1", [notifTypeName]),
      ]);

      if (stRow.rowCount && ntRow.rowCount) {
        const serviceTypeId = stRow.rows[0].id as string;
        const notifTypeId   = ntRow.rows[0].id as string;
        const subject = decision === "approve"
          ? "Your SportVault Account Has Been Approved"
          : "Your SportVault Account Request Was Not Approved";
        const body = decision === "approve"
          ? "Congratulations! Your SportVault account has been approved. You may now sign in."
          : "We're sorry, your SportVault account request was not approved at this time. Please contact support if you have questions.";

        for (const accountId of accountIds) {
          await adminPool.query(
            `INSERT INTO notification
               (recipient_id, service_type, notification_type, subject, message_body,
                outbox_flag, sent_flag)
             VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
            [accountId, serviceTypeId, notifTypeId, subject, body]
          );
        }
        logger.info(`[Decision] Queued ${accountIds.length} decision notification(s)`);
      }
    } catch (notifErr) {
      // Non-fatal — log but don't fail the decision response
      logger.error("Failed to queue decision notifications", notifErr);
    }

    // ── 4. Publish Kafka event ────────────────────────────────────────────────
    await publishEvent(TOPICS.ADMIN_EVENTS, "decision", {
      eventType:  "ADMIN_DECISION",
      decision,
      accountIds,
      occurredAt: new Date().toISOString(),
    });

    logger.info(`Admin ${decision}d accounts: [${accountIds.join(", ")}]`);
    res.json({ message: `Accounts ${decision}d successfully.`, count: accountIds.length });
  } catch (err) {
    logger.error("Account decision error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
