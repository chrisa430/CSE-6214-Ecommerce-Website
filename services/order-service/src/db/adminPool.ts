/**
 * @fileoverview Lazy singleton pg.Pool for the admin database (cross-service)
 * @module db/adminPool.ts
 * @author Darrell Hobson
 *
 * OrderService uses this pool to write notification rows to the admin DB
 * when return requests are initiated.
 */
import { Pool } from "pg";
import { logger } from "../logger";

let adminPool: Pool | null = null;

export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({
      host:     process.env.ADMIN_DB_HOST || "localhost",
      port:     parseInt(process.env.ADMIN_DB_PORT || "5434"),
      database: process.env.ADMIN_DB_NAME || "admin",
      user:     process.env.ADMIN_DB_USER || "admin_user",
      password: process.env.ADMIN_DB_PASS || "admin_pass",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis:       30_000,
      connectionTimeoutMillis:  5_000,
    });
    adminPool.on("error", (err) => {
      logger.error("Unexpected admin PostgreSQL pool error (cross-service)", err);
    });
  }
  return adminPool;
}
