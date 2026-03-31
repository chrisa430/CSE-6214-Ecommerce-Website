/**
 * @fileoverview Lazy singleton pg.Pool for the account database (cross-service)
 * @module db/accountPool.ts
 * @author Darrell Hobson
 *
 * OrderService uses this pool to:
 *   - Look up all admin account IDs when sending return notifications
 *   - Resolve buyer/seller names for return request context
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
      idleTimeoutMillis:       30_000,
      connectionTimeoutMillis:  5_000,
    });
    accountPool.on("error", (err) => {
      logger.error("Unexpected account PostgreSQL pool error (cross-service)", err);
    });
  }
  return accountPool;
}
