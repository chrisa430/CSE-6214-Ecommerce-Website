/**
 * @fileoverview Notification outbox processor — AWS SES email dispatch
 * @module jobs/outboxProcessor.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Email transport priority:
 *   1. AWS SES  — when AWS_SES_REGION + AWS_SES_FROM_ADDRESS are set
 *   2. SMTP     — when SMTP_HOST + SMTP_USER + SMTP_PASS are set (legacy)
 *   3. Ethereal — development catch-all fallback
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer, { Transporter }     from "nodemailer";
import { getPool }                      from "../db/pool";
import { getAccountPool }              from "../db/accountPool";
import { logger }                      from "../logger";

type TransportMode = "ses" | "smtp" | "ethereal";

function resolveTransportMode(): TransportMode {
  if (process.env.AWS_SES_REGION && process.env.AWS_SES_FROM_ADDRESS) return "ses";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "ethereal";
}

// ── AWS SES client ─────────────────────────────────────────────────────────

let sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_SES_REGION!,
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              ...(process.env.AWS_SESSION_TOKEN
                ? { sessionToken: process.env.AWS_SESSION_TOKEN }
                : {}),
            },
          }
        : {}),
    });
    logger.info(`📧  AWS SES client initialised (region: ${process.env.AWS_SES_REGION})`);
  }
  return sesClient;
}

function bodyToHtml(subject: string, body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${subject}</title>
<style>body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.container{max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
h2{color:#2d2d2d;margin-top:0}p{color:#555;line-height:1.6}
.footer{margin-top:32px;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
</style></head><body><div class="container"><h2>${subject}</h2><p>${escaped}</p>
<div class="footer">This message was sent automatically by SportVault. Please do not reply.</div>
</div></body></html>`;
}

async function sendViaSes(opts: {from:string;to:string;subject:string;body:string}): Promise<void> {
  const cmd = new SendEmailCommand({
    Source: opts.from,
    Destination: { ToAddresses: [opts.to] },
    Message: {
      Subject: { Data: opts.subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: opts.body, Charset: "UTF-8" },
        Html: { Data: bodyToHtml(opts.subject, opts.body), Charset: "UTF-8" },
      },
    },
  });
  await getSesClient().send(cmd);
}

// ── SMTP / Ethereal transport ─────────────────────────────────────────────────

let smtpTransporter: Transporter | null = null;

async function getSmtpTransporter(): Promise<Transporter> {
  if (smtpTransporter) return smtpTransporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    logger.info("📧  SMTP transport configured");
  } else {
    const testAccount = await nodemailer.createTestAccount();
    smtpTransporter   = nodemailer.createTransport({
      host: "smtp.ethereal.email", port: 587, secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info(`📧  Ethereal dev SMTP ready — preview: https://ethereal.email (user: ${testAccount.user})`);
  }
  return smtpTransporter;
}

async function resolveRecipientEmail(recipientId: string): Promise<string | null> {
  try {
    const result = await getAccountPool().query("SELECT user_id FROM account WHERE id = $1", [recipientId]);
    return result.rowCount ? (result.rows[0].user_id as string) : null;
  } catch { return null; }
}

export async function processOutbox(): Promise<void> {
  const adminPool = getPool();
  const mode      = resolveTransportMode();

  let pending: { id: string; recipient_id: string; subject: string; message_body: string }[];
  try {
    pending = (await adminPool.query<{id:string;recipient_id:string;subject:string;message_body:string}>(
      `SELECT id, recipient_id, subject, message_body
       FROM notification WHERE outbox_flag=TRUE AND sent_flag=FALSE ORDER BY date_sent ASC`
    )).rows;
  } catch (err) {
    logger.error("[Outbox] Failed to query notification table", err); return;
  }

  if (pending.length === 0) return;
  logger.info(`[Outbox] Processing ${pending.length} pending notification(s) via ${mode.toUpperCase()}…`);

  const from = process.env.AWS_SES_FROM_ADDRESS || process.env.SMTP_FROM || "noreply@sportvault.local";

  for (const row of pending) {
    try {
      const toEmail = await resolveRecipientEmail(row.recipient_id);
      if (toEmail) {
        if (mode === "ses") {
          await sendViaSes({ from, to: toEmail, subject: row.subject ?? "(no subject)", body: row.message_body ?? "" });
          logger.info(`[Outbox][SES] Sent → ${toEmail} | "${row.subject}"`);
        } else {
          const mailer = await getSmtpTransporter();
          const info   = await mailer.sendMail({
            from, to: toEmail,
            subject: row.subject ?? "(no subject)",
            text: row.message_body ?? "",
            html: bodyToHtml(row.subject ?? "(no subject)", row.message_body ?? ""),
          });
          logger.info(
            `[Outbox][${mode.toUpperCase()}] Sent → ${toEmail} | ${info.messageId}` +
            (nodemailer.getTestMessageUrl(info) ? ` | ${nodemailer.getTestMessageUrl(info)}` : "")
          );
        }
      } else {
        logger.warn(`[Outbox] Could not resolve email for recipient ${row.recipient_id} — marking sent`);
      }
      await adminPool.query(
        `UPDATE notification SET outbox_flag=FALSE, sent_flag=TRUE WHERE id=$1`, [row.id]
      );
    } catch (err) {
      logger.error(`[Outbox] Failed to process notification ${row.id}`, err);
    }
  }
}

export function startOutboxScheduler(): void {
  const intervalMs = parseInt(process.env.OUTBOX_POLL_MS || "30000");
  processOutbox().catch((err) => logger.error("[Outbox] Initial run error", err));
  setInterval(() => {
    processOutbox().catch((err) => logger.error("[Outbox] Scheduled run error", err));
  }, intervalMs);
  logger.info(`📬  Outbox scheduler started (every ${intervalMs / 1000}s, transport: ${resolveTransportMode().toUpperCase()})`);
}
