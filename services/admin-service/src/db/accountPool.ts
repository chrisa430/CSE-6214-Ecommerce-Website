/**
 * @fileoverview Lazy singleton pg.Pool for the account database (cross-service)
 * @module db/accountPool.ts
 * @author Darrell Hobson
 * @Date 2026.03.04
 *
 * AdminService needs read/write access to the account database for:
 *   - Fetching accounts with status='open'
 *   - Updating account status on approve/reject decisions
 *   - Reading admin-type account IDs when AccountService inserts notifications
 */
import { Pool } from "pg";
import { logger } from "../logger";

let accountPool: Pool | null = null;

export function getAccountPool(): Pool {
  if (!accountPool) {
    accountPool = new Pool({
      host:     process.env.ACCOUNT_DB_HOST || "localhost",
      port:     parseInt(process.env.ACCOUNT_DB_PORT || "5433"),
      database: process.env.ACCOUNT_DB_NAME || "account",
      user:     process.env.ACCOUNT_DB_USER || "account_user",
      password: process.env.ACCOUNT_DB_PASS || "account_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis:      30_000,
      connectionTimeoutMillis: 5_000,
    });

    accountPool.on("error", (err) => {
      logger.error("Unexpected account PostgreSQL pool error (cross-service)", err);
    });
  }
  return accountPool;
}

export async function testAccountConnection(): Promise<void> {
  const client = await getAccountPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  account DB connection established (cross-service)");
  } finally {
    client.release();
  }
}
