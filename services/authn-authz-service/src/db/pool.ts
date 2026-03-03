/**
 * @fileoverview Creates a lazy singleton pg.Pool
 * @module pools.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Pool } from "pg";
import { logger } from "../logger";

let pool: Pool | null = null;

/**
 * Creates and configures connection pool
 *
 * @returns Pool
 * @remarks
 * - configured with max: 10 connections
 * - idleTimeoutMillis: 30,000 (unused connections closed after 30 s)
 * - connectionTimeoutMillis: 5,000 (fail fast if DB unreachable)
 * - pool.on('error') prevents uncaught pool errors from crashing the process
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "authn_authz",
      user: process.env.DB_USER || "authn_user",
      password: process.env.DB_PASS || "authn_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("error", (err) => {
      logger.error("Unexpected PostgreSQL pool error", err);
    });
  }
  return pool;
}

/**
 * Acquires a client
 *
 * @returns Promise<void>
 * @remarks
 * - runs SELECT 1, and releases it in a finally block — always returned even if the query throws an exception
 */
export async function testConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    logger.info("✅  authn_authz DB connection established");
  } finally {
    client.release();
  }
}
