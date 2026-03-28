/**
 * @fileoverview KafkaJS producer/consumer for AdminService
 * @module kafka/client.ts
 * @author Darrell Hobson
 * @Date 2026.03.04
 */
import { Kafka, Producer } from "kafkajs";
import { logger } from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "admin-service",
  brokers:  (process.env.KAFKA_BROKERS  || "localhost:9092").split(","),
  retry:    { retries: 5 },
});

export const TOPICS = {
  ACCOUNT_EVENTS:  "account.events",   // consumed from AccountService
  ADMIN_EVENTS:    "admin.events",     // published by this service (account decisions)
  PRODUCT_EVENTS:  "product.events",   // published by this service (product status changes)
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

export async function publishEvent(
  topic: string,
  key: string,
  value: object
): Promise<void> {
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
