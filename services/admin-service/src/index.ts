/**
 * @fileoverview AdminService — application entry point and startup orchestrator
 * @module index.ts
 * @author Darrell Hobson
 * @Date 2026.03.04
 *
 * Responsibilities:
 *   - REST API for admin account approval workflow
 *   - Internal notification-insert endpoint (called by AccountService)
 *   - Periodic notification outbox processor (email dispatch)
 */
import "dotenv/config";
import * as net      from "net";
import express       from "express";
import helmet        from "helmet";
import cors          from "cors";
import rateLimit     from "express-rate-limit";

import { testConnection }           from "./db/pool";
import { testAccountConnection }    from "./db/accountPool";
import { testInventoryConnection }  from "./db/inventoryPool";
import { getProducer }            from "./kafka/client";
import { startConsumer }          from "./kafka/consumer";
import adminRoutes                from "./routes/admin";
import { startOutboxScheduler }   from "./jobs/outboxProcessor";
import { logger }                 from "./logger";

const app  = express();
const PORT = parseInt(process.env.PORT || "3003");

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "64kb" }));

// Rate-limit the public decision/open endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ service: "AdminService", status: "ok", ts: new Date().toISOString() });
});

app.use("/admin", apiLimiter, adminRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Infrastructure helpers ────────────────────────────────────────────────────

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
 * waitForDb — polls until the given DB is TCP-reachable and accepts a query.
 */
async function waitForDb(
  label: string,
  host: string,
  port: number,
  testFn: () => Promise<void>,
  maxAttempts = 20,
  delayMs = 3000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reachable = await tcpReachable(host, port);
    if (!reachable) {
      logger.warn(
        `[${attempt}/${maxAttempts}] ${label} not reachable at ${host}:${port} — ` +
        `run: docker compose up -d`
      );
      if (attempt === maxAttempts)
        throw new Error(`${label} at ${host}:${port} unreachable after ${maxAttempts} attempts.`);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    try {
      await testFn();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      logger.warn(`[${attempt}/${maxAttempts}] ${label} reachable but query failed — retrying…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

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
      logger.warn(`[${attempt}/${maxAttempts}] Kafka producer not ready, retrying…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const adminDbHost      = process.env.DB_HOST                || "localhost";
  const adminDbPort      = parseInt(process.env.DB_PORT       || "5434");
  const accountDbHost    = process.env.ACCOUNT_DB_HOST        || "localhost";
  const accountDbPort    = parseInt(process.env.ACCOUNT_DB_PORT || "5433");
  const inventoryDbHost  = process.env.INVENTORY_DB_HOST      || "localhost";
  const inventoryDbPort  = parseInt(process.env.INVENTORY_DB_PORT || "5437");
  const kafka            = process.env.KAFKA_BROKERS          || "localhost:9092";

  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("  AdminService — startup");
  logger.info(`  Admin DB      → ${adminDbHost}:${adminDbPort}/admin`);
  logger.info(`  Account DB    → ${accountDbHost}:${accountDbPort}/account`);
  logger.info(`  Inventory DB  → ${inventoryDbHost}:${inventoryDbPort}/inventory`);
  logger.info(`  Kafka         → ${kafka}`);
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    await waitForDb("AdminDB",     adminDbHost,     adminDbPort,     testConnection);
    await waitForDb("AccountDB",   accountDbHost,   accountDbPort,   testAccountConnection);
    await waitForDb("InventoryDB", inventoryDbHost, inventoryDbPort, testInventoryConnection);
    await waitForKafka();

    app.listen(PORT, () => {
      logger.info(`\n🚀  AdminService ready → http://localhost:${PORT}\n`);
      // Start the notification outbox email dispatcher (Req 6)
      startOutboxScheduler();
      // Start Kafka consumer — listens for ACCOUNT_CREATION_SUBMITTED events
      startConsumer().catch((err) =>
        logger.error("Kafka consumer failed to start", err)
      );
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`\n❌  Fatal: ${msg}`);
    logger.error("  Steps to fix:");
    logger.error("  1. Open Docker Desktop");
    logger.error("  2. cd Sprint_3 && docker compose up -d");
    logger.error("  3. docker compose ps   ← wait until all containers say 'Up'");
    logger.error("  4. Re-run: npm run dev\n");
    process.exit(1);
  }
}

bootstrap();
