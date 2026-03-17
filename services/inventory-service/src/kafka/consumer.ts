/**
 * @fileoverview Kafka consumer for InventoryService
 * @module kafka/consumer.ts
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * Subscribes to product.events topic.
 * On PRODUCT_STATUS_UPDATED: logs the admin action for audit visibility.
 * Future handlers can sync caches, trigger notifications, or reindex search.
 */
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { logger } from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "inventory-service",
  brokers:  (process.env.KAFKA_BROKERS  || "localhost:9092").split(","),
  retry:    { retries: 5 },
});

const TOPICS = {
  PRODUCT_EVENTS: "product.events",
} as const;

let consumer: Consumer | null = null;

// ── Event handlers ────────────────────────────────────────────────────────────

function handleProductStatusUpdated(event: {
  productIds: string[];
  status:     string;
  count:      number;
  occurredAt: string;
}): void {
  logger.info(
    `[Consumer] PRODUCT_STATUS_UPDATED — ` +
    `${event.count} product(s) set to '${event.status}' at ${event.occurredAt}. ` +
    `IDs: [${event.productIds.join(", ")}]`
  );
  // Future: invalidate product cache, trigger re-index, send seller notification, etc.
}

// ── Message dispatcher ────────────────────────────────────────────────────────

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(message.value.toString()) as Record<string, unknown>;
  } catch {
    logger.warn("[Consumer] Received non-JSON Kafka message — skipping");
    return;
  }

  const eventType = event.eventType as string | undefined;
  logger.debug(`[Consumer] Received event: ${eventType}`);

  try {
    switch (eventType) {
      case "PRODUCT_STATUS_UPDATED":
        handleProductStatusUpdated(event as any);
        break;
      default:
        break;
    }
  } catch (err) {
    logger.error(`[Consumer] Error handling event ${eventType}`, err);
  }
}

// ── Consumer lifecycle ────────────────────────────────────────────────────────

export async function startConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "inventory-service-group",
  });

  await consumer.connect();
  logger.info("✅  Kafka consumer connected");

  await consumer.subscribe({
    topic:         TOPICS.PRODUCT_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({ eachMessage: handleMessage });

  logger.info(`📨  Listening on topic: ${TOPICS.PRODUCT_EVENTS}`);
}

export async function disconnectConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}
