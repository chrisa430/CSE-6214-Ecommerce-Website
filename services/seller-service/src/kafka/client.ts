/**
 * @fileoverview Kafka producer for seller-service
 * @module kafka/client.ts
 * @author Darrell Hobson
 */
import { Kafka, Producer } from "kafkajs";
import { logger } from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "seller-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  retry: { retries: 5 },
});

export const TOPICS = {
  SELLER_EVENTS: "seller.events",
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
  const p = await getProducer();
  await p.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) await producer.disconnect();
}
