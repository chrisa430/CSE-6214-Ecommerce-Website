/**
 * @fileoverview Lazy singleton pg.Pool for the seller database
 * @module db/sellerPool.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Used by AdminService RSS routes to verify seller existence and store
 * rss_subscription rows (which live in the admin DB, not here — this pool
 * is only needed to validate seller_id values against the seller DB).
 */
import { Pool } from "pg";
import { logger } from "../logger";

let pool: Pool | null = null;

export function getSellerPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.SELLER_DB_HOST || "localhost",
      port:     parseInt(process.env.SELLER_DB_PORT || "5436"),
      database: process.env.SELLER_DB_NAME || "seller",
      user:     process.env.SELLER_DB_USER || "seller_user",
      password: process.env.SELLER_DB_PASS || "seller_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis:       30_000,
      connectionTimeoutMillis:  5_000,
    });
    pool.on("error", (err) => {
      logger.error("Unexpected seller PostgreSQL pool error", err);
    });
  }
  return pool;
}

export async function testSellerConnection(): Promise<void> {
  const client = await getSellerPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  seller DB connection established");
  } finally {
    client.release();
  }
}
