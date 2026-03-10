/**
 * @fileoverview Singleton pg.Pool for OrderService
 * @module db/pool.ts
 * @author Darrell Hobson
 */
import { Pool } from "pg";
import { logger } from "../logger";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.DB_HOST || "localhost",
      port:     parseInt(process.env.DB_PORT || "5436"),
      database: process.env.DB_NAME || "order",
      user:     process.env.DB_USER || "order_user",
      password: process.env.DB_PASS || "order_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on("error", (err) => { logger.error("PostgreSQL pool error", err); });
  }
  return pool;
}

export async function testConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  order DB connection established");
  } finally {
    client.release();
  }
}
