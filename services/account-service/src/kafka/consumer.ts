/**
 * @fileoverview Kafka consumer for AccountService — account.lookup request-reply
 * @module kafka/consumer.ts
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * Subscribes to account.lookup topic.
 * AuthnAuthzService publishes a lookup request with { correlationId, email }.
 * This consumer fetches the account from the DB and publishes the result back
 * to account.lookup.result so AuthnAuthzService can complete its async auth flow.
 *
 * The synchronous HTTP path (fetchAccountByEmail) remains the primary login path.
 * This Kafka path is the async fallback for decoupled/event-driven auth scenarios.
 */
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { getPool }          from "../db/pool";
import { publishEvent, TOPICS } from "./client";
import { logger }           from "../logger";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "account-service",
  brokers:  (process.env.KAFKA_BROKERS  || "localhost:9092").split(","),
  retry:    { retries: 5 },
});

let consumer: Consumer | null = null;

// ── Handler ───────────────────────────────────────────────────────────────────

async function handleAccountLookup(payload: {
  correlationId: string;
  email:         string;
}): Promise<void> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT a.id, a.password_hash AS "passwordHash",
              a.first_name AS "firstName", a.last_name AS "lastName",
              at.name AS type, ast.name AS status
       FROM account a
       JOIN account_type   at  ON at.id  = a.type_id
       JOIN account_status ast ON ast.id = a.status_id
       WHERE a.user_id = $1`,
      [payload.email.toLowerCase()]
    );

    const account = result.rowCount ? result.rows[0] : null;

    await publishEvent(TOPICS.ACCOUNT_RESULT, payload.correlationId, {
      correlationId: payload.correlationId,
      found:         !!account,
      account:       account ?? null,
      respondedAt:   new Date().toISOString(),
    });

    logger.info(
      `[Consumer] account.lookup resolved: email=${payload.email} ` +
      `found=${!!account} correlationId=${payload.correlationId}`
    );
  } catch (err) {
    logger.error(`[Consumer] account.lookup handler failed`, err);

    // Publish a not-found reply so the requester doesn't hang
    await publishEvent(TOPICS.ACCOUNT_RESULT, payload.correlationId, {
      correlationId: payload.correlationId,
      found:         false,
      account:       null,
      error:         "Internal lookup error",
      respondedAt:   new Date().toISOString(),
    }).catch(() => {}); // best-effort
  }
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

  try {
    await handleAccountLookup(event as any);
  } catch (err) {
    logger.error("[Consumer] Unhandled error in account.lookup handler", err);
  }
}

// ── Consumer lifecycle ────────────────────────────────────────────────────────

export async function startConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "account-service-group",
  });

  await consumer.connect();
  logger.info("✅  Kafka consumer connected");

  await consumer.subscribe({
    topic:         TOPICS.ACCOUNT_LOOKUP,
    fromBeginning: false,
  });

  await consumer.run({ eachMessage: handleMessage });

  logger.info(`📨  Listening on topic: ${TOPICS.ACCOUNT_LOOKUP}`);
}

export async function disconnectConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}
