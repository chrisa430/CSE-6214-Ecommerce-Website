/**
 * @fileoverview Lazy singleton pg.Pool for the inventory database (cross-service)
 * @module db/inventoryPool.ts
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * AdminService needs read/write access to the inventory database for:
 *   - Listing all products with category, subcategory, and status joins
 *   - Fetching full product detail records
 *   - Updating product status (active / suspended)
 */
import { Pool } from "pg";
import { logger } from "../logger";

let inventoryPool: Pool | null = null;

export function getInventoryPool(): Pool {
  if (!inventoryPool) {
    inventoryPool = new Pool({
      host:     process.env.INVENTORY_DB_HOST || "localhost",
      port:     parseInt(process.env.INVENTORY_DB_PORT || "5437"),
      database: process.env.INVENTORY_DB_NAME || "inventory",
      user:     process.env.INVENTORY_DB_USER || "inventory_user",
      password: process.env.INVENTORY_DB_PASS || "inventory_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis:      30_000,
      connectionTimeoutMillis: 5_000,
    });

    inventoryPool.on("error", (err) => {
      logger.error("Unexpected inventory PostgreSQL pool error (cross-service)", err);
    });
  }
  return inventoryPool;
}

export async function testInventoryConnection(): Promise<void> {
  const client = await getInventoryPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  inventory DB connection established (cross-service)");
  } finally {
    client.release();
  }
}
