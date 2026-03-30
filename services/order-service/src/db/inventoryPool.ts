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
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    inventoryPool.on("error", (err) => {
      logger.error("Unexpected inventory PostgreSQL pool error (cross-service)", err);
    });
  }

  return inventoryPool;
}