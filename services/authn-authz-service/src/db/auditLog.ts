/**
 * @fileoverview Records every authentication event — successful and failed logins, logouts, and token refreshes.
 * @module auditLog.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { getPool } from "../db/pool";
import { logger } from "../logger";


export interface AuditEntry {
  accountId: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  detail?: string;
}

/**
 * Writes audit log entry
 *
 * @param entry - Account creation fields.
 * @returns Promise<void>
 * @remarks
 * - inserts one row into auth_audit_log using parameterized queries
 */
export async function writeAuthAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO auth_audit_log
         (account_id, action, ip_address, user_agent, success, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.accountId,
        entry.action,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.success,
        entry.detail ?? null,
      ]
    );
  } catch (err) {
    logger.error("Failed to write auth audit log", err);
  }
}
