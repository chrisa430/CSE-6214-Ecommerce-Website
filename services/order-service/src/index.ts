/**
 * @fileoverview Application entry point — OrderService
 * @module index.ts
 * @author Darrell Hobson
 */
import "dotenv/config";
import * as net from "net";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { testConnection } from "./db/pool";
import { getProducer }   from "./kafka/client";
import routes             from "./routes/orders";
import { logger }        from "./logger";

const app  = express();
const PORT = parseInt(process.env.PORT || "3005");

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "16kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.get("/health", (_req, res) => {
  res.json({ service: "OrderService", status: "ok", ts: new Date().toISOString() });
});

app.use("/orders", apiLimiter, routes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

function tcpReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.once("connect",  () => { sock.destroy(); resolve(true);  });
    sock.once("error",    () => { sock.destroy(); resolve(false); });
    sock.once("timeout",  () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

async function waitForDb(maxAttempts = 20, delayMs = 3000): Promise<void> {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "5436");
  for (let i = 1; i <= maxAttempts; i++) {
    if (await tcpReachable(host, port)) {
      try { await testConnection(); return; } catch (err) {
        if (i === maxAttempts) throw err;
        logger.warn(`[${i}/${maxAttempts}] DB query failed, retrying...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } else {
      if (i === maxAttempts) throw new Error(`PostgreSQL at ${host}:${port} unreachable.`);
      logger.warn(`[${i}/${maxAttempts}] Postgres not reachable at ${host}:${port} — retrying in ${delayMs/1000}s`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function waitForKafka(maxAttempts = 8, delayMs = 4000): Promise<void> {
  const [host, portStr] = (process.env.KAFKA_BROKERS || "localhost:9092").split(",")[0].split(":");
  const port = parseInt(portStr || "9092");
  for (let i = 1; i <= maxAttempts; i++) {
    if (await tcpReachable(host, port)) {
      try { await getProducer(); logger.info("✅  Kafka producer connected"); return; } catch {
        if (i === maxAttempts) { logger.warn("⚠️  Kafka unavailable — starting without event publishing."); return; }
      }
    } else {
      if (i === maxAttempts) { logger.warn("⚠️  Kafka unavailable — starting without event publishing."); return; }
      logger.warn(`[${i}/${maxAttempts}] Kafka not reachable, retrying in ${delayMs/1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function bootstrap(): Promise<void> {
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(`  OrderService — startup`);
  logger.info(`  DB    → ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5436"}/${process.env.DB_NAME || "order"}`);
  logger.info(`  Kafka → ${process.env.KAFKA_BROKERS || "localhost:9092"}`);
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    await waitForDb();
    await waitForKafka();
    app.listen(PORT, () => logger.info(`\n🚀  OrderService ready → http://localhost:${PORT}\n`));
  } catch (err) {
    logger.error(`\n❌  Fatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

bootstrap();
