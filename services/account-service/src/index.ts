/**
 * @fileoverview Application entry point and startup orchestrator.
 * @module index.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import "dotenv/config";
import * as net from "net";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { testConnection }     from "./db/pool";
import { getProducer }        from "./kafka/client";
import { startConsumer }      from "./kafka/consumer";
import accountRoutes          from "./routes/accounts";
import addressRoutes          from "./routes/addresses";
import paymentMethodRoutes    from "./routes/paymentMethods";
import profilePictureRoutes   from "./routes/profilePicture";
import { logger }             from "./logger";

const app  = express();
const PORT = parseInt(process.env.PORT || "3002");

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});

app.use(express.json({ limit: "16kb" }));   // multipart handled by multer — JSON stays small

app.get("/health", (_req, res) => {
  res.json({ service: "AccountService", status: "ok", ts: new Date().toISOString() });
});

app.use("/accounts/register", registerLimiter);
app.use("/accounts", accountRoutes);
app.use("/internal/accounts", accountRoutes);

// ── Profile-management routes (auth-guarded) ──────────────────────────────────
// Mounted before the generic 404 handler; mergeParams is set on each sub-router.
app.use("/accounts/:id/addresses",        addressRoutes);
app.use("/accounts/:id/payment-methods",  paymentMethodRoutes);
app.use("/accounts/:id/profile-picture",  profilePictureRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

/**
 * TCP check - Opens a raw Node.js net.Socket to a given host and port with a 2-second timeout
 *
 * @param host
 * @param port
 * @returns Promise<boolean>
 * @remarks
 * - Let's you know early if host is not reachable
 */
function tcpReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.once("connect", () => { sock.destroy(); resolve(true);  });
    sock.once("error",   () => { sock.destroy(); resolve(false); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

/**
 * DB check - Up to 20 attempts to reach PostgreSQL at 3-second intervals
 *
 * @param maxAttempts
 * @param delayMs
 * @returns Promise<void>
 * @remarks
 * - Let's you know early if database is not reachable
 */
async function waitForDb(maxAttempts = 20, delayMs = 3000): Promise<void> {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "5433");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reachable = await tcpReachable(host, port);
    if (!reachable) {
      logger.warn(
        `[${attempt}/${maxAttempts}] PostgreSQL not reachable at ${host}:${port}` +
        ` — run: cd Sprint_4 && docker compose up -d`
      );
      if (attempt === maxAttempts) {
        throw new Error(`PostgreSQL at ${host}:${port} unreachable after ${maxAttempts} attempts.`);
      }
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    try {
      await testConnection();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      logger.warn(`[${attempt}/${maxAttempts}] DB reachable but query failed, retrying in ${delayMs / 1000}s…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/**
 * Kafka check - Up to 8 attempts to reach Kafka at 4-second intervals
 *
 * @param maxAttempts
 * @param delayMs
 * @returns Promise<void>
 * @remarks
 * - Let's you know early if Kafka is not reachable
 */
async function waitForKafka(maxAttempts = 8, delayMs = 4000): Promise<void> {
  const [host, portStr] = (process.env.KAFKA_BROKERS || "localhost:9092").split(",")[0].split(":");
  const port = parseInt(portStr || "9092");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reachable = await tcpReachable(host, port);
    if (!reachable) {
      if (attempt === maxAttempts) {
        logger.warn("⚠️  Kafka not available — service will start WITHOUT event publishing.");
        return;
      }
      logger.warn(`[${attempt}/${maxAttempts}] Kafka not reachable, retrying in ${delayMs / 1000}s…`);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    try {
      await getProducer();
      logger.info("✅  Kafka producer connected");
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        logger.warn("⚠️  Kafka producer failed — service will start WITHOUT event publishing.");
        return;
      }
      logger.warn(`[${attempt}/${maxAttempts}] Kafka producer not ready, retrying in ${delayMs / 1000}s…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/**
 * Bootstrap - async main function
 *
 * @returns Promise<void>
 * @remarks
 * - Gets everything started
 */
async function bootstrap(): Promise<void> {
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = process.env.DB_PORT || "5433";
  const dbName = process.env.DB_NAME || "account";
  const kafka  = process.env.KAFKA_BROKERS || "localhost:9092";

  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("  AccountService — startup");
  logger.info(`  DB    → ${dbHost}:${dbPort}/${dbName}`);
  logger.info(`  Kafka → ${kafka}`);
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    await waitForDb();
    await waitForKafka();
    app.listen(PORT, () => {
      logger.info(`\n🚀  AccountService ready → http://localhost:${PORT}\n`);
      startConsumer().catch((err) =>
        logger.error("Kafka consumer failed to start", err)
      );
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`\n❌  Fatal: ${msg}`);
    logger.error("  Steps to fix:");
    logger.error("  1. Open Docker Desktop");
    logger.error("  2. cd Sprint_4 && docker compose up -d");
    logger.error("  3. docker compose ps   ← wait until all 4 containers say 'Up'");
    logger.error("  4. Re-run: npm run dev\n");
    process.exit(1);
  }
}

bootstrap();
