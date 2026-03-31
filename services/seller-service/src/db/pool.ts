/**
 * @fileoverview Singleton pg.Pool for SellerService
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
      port:     parseInt(process.env.DB_PORT || "5438"),
      database: process.env.DB_NAME || "seller",
      user:     process.env.DB_USER || "seller_user",
      password: process.env.DB_PASS || "seller_pass",
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
    logger.info("✅  seller DB connection established");
  } finally {
    client.release();
  }
}
