/**
 * @fileoverview Initializes KafkaJS client
 * @module client.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs";
import { logger } from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "authn-authz-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  retry: { retries: 5 },
});

// Defines three topic constants
export const TOPICS = {
  AUTH_EVENTS:    "auth.events",          // published by this service
  ACCOUNT_LOOKUP: "account.lookup",       // request to AccountService
  ACCOUNT_RESULT: "account.lookup.result",// reply from AccountService
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

let consumer: Consumer | null = null;

/**
 *
 * @param handler
 * @returns Promise<void>
 * @remarks
 * -
 */
export async function startConsumer(
  handler: (payload: EachMessagePayload) => Promise<void>
): Promise<void> {
  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "authn-authz-group",
  });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.ACCOUNT_RESULT, fromBeginning: false });
  await consumer.run({ eachMessage: handler });
  logger.info(`✅  Kafka consumer subscribed to ${TOPICS.ACCOUNT_RESULT}`);
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
  if (consumer) await consumer.disconnect();
}
