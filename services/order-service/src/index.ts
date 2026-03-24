import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";

import { testConnection } from "./db/pool";
import { logger } from "./logger";
import orderRoutes from "./routes/orders";

const app = express();
const PORT = parseInt(process.env.PORT || "3006");

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    service: "OrderService",
    status: "ok",
    ts: new Date().toISOString(),
  });
});

app.use("/orders", orderRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function bootstrap(): Promise<void> {
  try {
    await testConnection();
    app.listen(PORT, () => {
      logger.info(`OrderService running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error("OrderService failed to start", err);
    process.exit(1);
  }
}

bootstrap();