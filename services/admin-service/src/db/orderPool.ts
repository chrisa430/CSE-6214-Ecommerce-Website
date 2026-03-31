/**
 * @fileoverview Lazy singleton pg.Pool for the order database (cross-service)
 * @module db/orderPool.ts
 * @author Darrell Hobson
 *
 * AdminService needs read access to the order database for:
 *   - Order Maintenance page: listing all orders with status, totals
 *   - Reading completed_order_items for seller resolution
 */
import { Pool } from "pg";
import { logger } from "../logger";

let orderPool: Pool | null = null;

export function getOrderPool(): Pool {
  if (!orderPool) {
    orderPool = new Pool({
      host:     process.env.ORDER_DB_HOST || "localhost",
      port:     parseInt(process.env.ORDER_DB_PORT || "5436"),
      database: process.env.ORDER_DB_NAME || "order",
      user:     process.env.ORDER_DB_USER || "order_user",
      password: process.env.ORDER_DB_PASS || "order_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis:       30_000,
      connectionTimeoutMillis:  5_000,
    });

    orderPool.on("error", (err) => {
      logger.error("Unexpected order PostgreSQL pool error (cross-service)", err);
    });
  }
  return orderPool;
}

export async function testOrderConnection(): Promise<void> {
  const client = await getOrderPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  order DB connection established (cross-service)");
  } finally {
    client.release();
  }
}
