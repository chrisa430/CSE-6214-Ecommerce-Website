/**
 * @fileoverview KafkaJS producer/consumer for AdminService
 * @module kafka/client.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 */
import { Kafka, Producer } from "kafkajs";
import { logger } from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "admin-service",
  brokers:  (process.env.KAFKA_BROKERS  || "localhost:9092").split(","),
  retry:    { retries: 5 },
});

export const TOPICS = {
  ACCOUNT_EVENTS:  "account.events",   // consumed: account creation / suspension
  ADMIN_EVENTS:    "admin.events",     // published: account decisions
  PRODUCT_EVENTS:  "product.events",   // published: product status changes
  ORDER_EVENTS:    "order.events",     // consumed: order completed (RSS sales feed)
  RETURN_EVENTS:   "return.events",    // consumed: return initiated (RSS returns feed)
} as const;

let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    logger.info("✅  Kafka producer connected");
  }
  return producer;
}

export async function publishEvent(topic: string, key: string, value: object): Promise<void> {
  try {
    const p = await getProducer();
    await p.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
  } catch (err) {
    logger.warn("Kafka publish failed (non-fatal)", err);
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer) await producer.disconnect();
}
