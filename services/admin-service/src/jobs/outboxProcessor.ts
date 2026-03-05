/**
 * @fileoverview Notification outbox processor
 * @module jobs/outboxProcessor.ts
 * @author Darrell Hobson
 * @Date 2026.03.04
 *
 * Requirement 6:
 *   The AdminService will periodically scan the notifications table for records
 *   where outbox_flag = TRUE and sent_flag = FALSE. It will then send the emails
 *   and update outbox_flag → FALSE, sent_flag → TRUE.
 *
 * In development the SMTP transport falls back to Ethereal (a fake SMTP catch-all)
 * so no real email is sent. Set SMTP_HOST/USER/PASS in .env to wire a real provider.
 */
import nodemailer, { Transporter } from "nodemailer";
import { getPool }                 from "../db/pool";
import { getAccountPool }          from "../db/accountPool";
import { logger }                  from "../logger";

// ── Mailer setup ──────────────────────────────────────────────────────────────

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Production / staging path — real SMTP
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info("📧  SMTP transport configured");
  } else {
    // Development fallback — Ethereal fake SMTP (messages are captured, not delivered)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host:   "smtp.ethereal.email",
      port:   587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(
      `📧  Ethereal dev SMTP ready — preview emails at https://ethereal.email ` +
      `(user: ${testAccount.user})`
    );
  }

  return transporter;
}

// ── Resolve recipient email from account DB ───────────────────────────────────

async function resolveRecipientEmail(recipientId: string): Promise<string | null> {
  try {
    const result = await getAccountPool().query(
      "SELECT user_id FROM account WHERE id = $1",
      [recipientId]
    );
    return result.rowCount ? (result.rows[0].user_id as string) : null;
  } catch {
    return null;
  }
}

// ── Main outbox processor ────────────────────────────────────────────────────

/**
 * processOutbox()
 *
 * Called on a fixed interval (default 30 s). Fetches all notification rows with
 * outbox_flag = TRUE AND sent_flag = FALSE, attempts email delivery for each,
 * then marks each row outbox_flag = FALSE, sent_flag = TRUE.
 */
export async function processOutbox(): Promise<void> {
  const adminPool = getPool();

  let pending: { id: string; recipient_id: string; subject: string; message_body: string }[];

  try {
    const result = await adminPool.query<{
      id: string;
      recipient_id: string;
      subject: string;
      message_body: string;
    }>(
      `SELECT id, recipient_id, subject, message_body
       FROM   notification
       WHERE  outbox_flag = TRUE
         AND  sent_flag   = FALSE
       ORDER  BY date_sent ASC`
    );
    pending = result.rows;
  } catch (err) {
    logger.error("[Outbox] Failed to query notification table", err);
    return;
  }

  if (pending.length === 0) return;

  logger.info(`[Outbox] Processing ${pending.length} pending notification(s)…`);
  const mailer = await getTransporter();
  const from   = process.env.SMTP_FROM || "noreply@sportvault.local";

  for (const row of pending) {
    try {
      // Resolve email address from account DB
      const toEmail = await resolveRecipientEmail(row.recipient_id);

      if (toEmail) {
        const info = await mailer.sendMail({
          from,
          to:      toEmail,
          subject: row.subject ?? "(no subject)",
          text:    row.message_body ?? "",
        });
        logger.info(
          `[Outbox] Sent → ${toEmail} | msgId: ${info.messageId}` +
          (nodemailer.getTestMessageUrl(info)
            ? ` | preview: ${nodemailer.getTestMessageUrl(info)}`
            : "")
        );
      } else {
        logger.warn(`[Outbox] Could not resolve email for recipient ${row.recipient_id} — marking sent`);
      }

      // Mark as sent regardless (prevents infinite retry loop on bad recipient)
      await adminPool.query(
        `UPDATE notification
         SET    outbox_flag = FALSE,
                sent_flag   = TRUE
         WHERE  id = $1`,
        [row.id]
      );
    } catch (err) {
      logger.error(`[Outbox] Failed to process notification ${row.id}`, err);
      // Leave outbox_flag = TRUE so it will be retried next cycle
    }
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

/**
 * startOutboxScheduler()
 *
 * Kicks off the recurring outbox poll. Call once at service startup.
 * Poll interval is controlled by OUTBOX_POLL_MS env var (default 30 000 ms).
 */
export function startOutboxScheduler(): void {
  const intervalMs = parseInt(process.env.OUTBOX_POLL_MS || "30000");

  // Run immediately on startup, then on the interval
  processOutbox().catch((err) => logger.error("[Outbox] Initial run error", err));
  setInterval(() => {
    processOutbox().catch((err) => logger.error("[Outbox] Scheduled run error", err));
  }, intervalMs);

  logger.info(`📬  Outbox scheduler started (every ${intervalMs / 1000}s)`);
}
