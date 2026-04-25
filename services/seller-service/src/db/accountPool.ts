/**
 * @fileoverview Secondary pg.Pool for read-only account lookups (cross-DB)
 * Used by seller review routes to resolve buyer names.
 */
import { Pool } from "pg";
import { logger } from "../logger";

let pool: Pool | null = null;

export function getAccountPool(): Pool {
  if (!pool) {
    pool = new Pool({
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
    pool.on("error", (err) => { logger.error("Account pool error", err); });
  }
  return pool;
}
