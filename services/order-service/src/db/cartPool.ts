import { Pool } from "pg";
import { logger } from "../logger";

let cartPool: Pool | null = null;

export function getCartPool(): Pool {
  if (!cartPool) {
    cartPool = new Pool({
      host: process.env.CART_DB_HOST || "localhost",
      port: parseInt(process.env.CART_DB_PORT || "5435"),
      database: process.env.CART_DB_NAME || "shopping_cart",
      user: process.env.CART_DB_USER || "shopping_cart_user",
      password: process.env.CART_DB_PASS || "shopping_cart_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    cartPool.on("error", (err) => {
      logger.error("Unexpected shopping_cart PostgreSQL pool error (cross-service)", err);
    });
  }

  return cartPool;
}