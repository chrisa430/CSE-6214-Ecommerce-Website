/**
 * @fileoverview
 * @module client.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs";
import { logger } from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "account-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  retry: { retries: 5 },
});

export const TOPICS = {
  ACCOUNT_EVENTS: "account.events",        // published by this service
  ACCOUNT_LOOKUP: "account.lookup",        // consumed from AuthnAuthzService (optional async path)
  ACCOUNT_RESULT: "account.lookup.result", // published to AuthnAuthzService (optional async path)
} as const;

let producer: Producer | null = null;

/**
 *
 *
 *  @returns Promise<Producer>
 * @remarks
 * -
 */
export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    logger.info("✅  Kafka producer connected");
  }
  return producer;
}

/**
 *
 * @param topic
 * @param key
 * @param value
 * @returns Promise<void>
 * @remarks
 * -
 */
export async function publishEvent(
  topic: string,
  key: string,
  value: object
): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [{ key, value: JSON.stringify(value) }],
  });
}

/**
 * shutdown gracefully
 *
 * @returns Promise<void>
 * @remarks
 * -
 */
export async function disconnectKafka(): Promise<void> {
  if (producer) await producer.disconnect();
}
