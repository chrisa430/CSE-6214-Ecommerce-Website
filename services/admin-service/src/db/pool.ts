/**
 * @fileoverview Lazy singleton pg.Pool for the admin database
 * @module db/pool.ts
 * @author Darrell Hobson
 * @Date 2026.03.04
 */
import { Pool } from "pg";
import { logger } from "../logger";

let pool: Pool | null = null;

/**
 * Returns the singleton connection pool for the admin database.
 * Holds notification, decision, and audit-log data.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.DB_HOST     || "localhost",
      port:     parseInt(process.env.DB_PORT || "5434"),
      database: process.env.DB_NAME     || "admin",
      user:     process.env.DB_USER     || "admin_user",
      password: process.env.DB_PASS     || "admin_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis:      30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("error", (err) => {
      logger.error("Unexpected admin PostgreSQL pool error", err);
    });
  }
  return pool;
}

export async function testConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  admin DB connection established");
  } finally {
    client.release();
  }
}
