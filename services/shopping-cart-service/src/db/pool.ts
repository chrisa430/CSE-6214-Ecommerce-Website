import { Pool } from "pg";
import { logger } from "../logger";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5435"),
      database: process.env.DB_NAME || "shopping_cart",
      user: process.env.DB_USER || "shopping_cart_user",
      password: process.env.DB_PASS || "shopping_cart_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("error", (err) => {
      logger.error("Unexpected shopping_cart PostgreSQL pool error", err);
    });
  }

  return pool;
}

export async function testConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅ shopping_cart DB connection established");
  } finally {
    client.release();
  }
}