
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { testConnection } from "./db/pool";
import { logger } from "./logger";
import productRoutes from "./routes/products";

const app = express();
const PORT = parseInt(process.env.PORT || "3004");

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    service: "InventoryService",
    status: "ok",
    ts: new Date().toISOString(),
  });
});

app.use("/inventory/products", productRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function bootstrap(): Promise<void> {
  try {
    await testConnection();
    app.listen(PORT, () => {
      logger.info(`InventoryService running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error("InventoryService failed to start", err);
    process.exit(1);
  }
}

bootstrap();