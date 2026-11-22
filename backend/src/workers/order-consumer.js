import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { kafka } from '../config/kafka.js';
import pool from '../config/database.js';
import { handleOrderPlacedEvent } from '../services/inventory-search-sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TOPIC_NAME = process.env.KAFKA_ORDERS_TOPIC || 'hivemart.orders';
export const CONSUMER_GROUP = process.env.KAFKA_SEARCH_SYNC_GROUP || 'hivemart-search-sync-v1';

let consumer = null;
let isRunning = false;
let isShuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Initializes and starts the Kafka order consumer for search inventory synchronization.
 *
 * Offset Management & At-Least-Once Delivery:
 * 1. autoCommit is disabled; offsets are committed manually only after successful
 *    OpenSearch synchronization and processed_events recording.
 * 2. On transient failure (PostgreSQL / OpenSearch disconnect), retries up to 3 times
 *    with exponential backoff. If retries fail, offset is NOT committed, ensuring
 *    Kafka redelivers the event.
 * 3. Downstream deduplication via processed_events ensures redelivered messages are
 *    idempotently acknowledged without duplicating effects.
 */
export const startConsumer = async ({
  groupId = CONSUMER_GROUP,
  fromBeginning = false,
  onMessageProcessed = null,
} = {}) => {
  consumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: false,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  console.log(`[ORDER_CONSUMER] Connecting to Kafka (groupId="${groupId}", topic="${TOPIC_NAME}")...`);
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning });
  isRunning = true;

  console.log(`[ORDER_CONSUMER] Successfully subscribed to topic "${TOPIC_NAME}". Listening for order.placed events...`);

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      const offset = message.offset;
      const key = message.key?.toString();
      let eventPayload = null;

      try {
        eventPayload = JSON.parse(message.value?.toString() || '{}');
      } catch (parseErr) {
        console.error(`[ORDER_CONSUMER] Poison message: Failed to parse JSON at partition ${partition}, offset ${offset}:`, parseErr.message);
        // Permanently unparseable JSON: commit offset to prevent blocking consumer partition
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(offset) + 1n).toString() },
        ]);
        return;
      }

      const eventId = eventPayload.event_id || 'unknown';
      const eventType = eventPayload.event_type || 'unknown';

      // Ignore event types not handled by this consumer
      if (eventType !== 'order.placed' && eventType !== 'offline.sale.completed') {
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(offset) + 1n).toString() },
        ]);
        return;
      }

      console.log(`[ORDER_CONSUMER] Received event ${eventId} (type: ${eventType}, key: ${key}) [p=${partition}, offset=${offset}]`);

      // Bounded retry loop with exponential backoff for transient failures
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const result = await handleOrderPlacedEvent(eventPayload, { consumerName: groupId });
          
          // Successfully processed: commit Kafka offset
          await consumer.commitOffsets([
            { topic, partition, offset: (BigInt(offset) + 1n).toString() },
          ]);

          if (onMessageProcessed) {
            await onMessageProcessed({ event: eventPayload, result, partition, offset });
          }
          return;
        } catch (err) {
          console.error(
            `[ORDER_CONSUMER] Error processing event ${eventId} (attempt ${attempts}/${maxAttempts}):`,
            err.message
          );

          if (attempts < maxAttempts) {
            const backoffMs = Math.min(500 * Math.pow(2, attempts - 1), 4000);
            console.log(`[ORDER_CONSUMER] Retrying event ${eventId} in ${backoffMs}ms...`);
            await sleep(backoffMs);
          } else {
            console.error(
              `[ORDER_CONSUMER] Exhausted ${maxAttempts} attempts for event ${eventId}. Leaving offset uncommitted for retry on consumer restart.`
            );
            // Re-throw so KafkaJS handles partition pause / recovery without skipping offset
            throw err;
          }
        }
      }
    },
  });
};

/**
 * Gracefully disconnects consumer and closes database pool.
 */
export const stopConsumer = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[ORDER_CONSUMER] Shutting down consumer gracefully...');

  if (consumer) {
    try {
      await consumer.stop();
      await consumer.disconnect();
      console.log('[ORDER_CONSUMER] Kafka consumer disconnected.');
    } catch (err) {
      console.error('[ORDER_CONSUMER] Error disconnecting Kafka consumer:', err.message);
    }
  }

  try {
    await pool.end();
    console.log('[ORDER_CONSUMER] PostgreSQL pool closed.');
  } catch {
    // Ignore pool close errors on shutdown
  }
};

// Handle process termination signals
const handleSignal = async (sig) => {
  console.log(`[ORDER_CONSUMER] Received signal ${sig}.`);
  await stopConsumer();
  process.exit(0);
};

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

// CLI Execution Entrypoint
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  startConsumer({ groupId: CONSUMER_GROUP, fromBeginning: false }).catch((err) => {
    console.error('[ORDER_CONSUMER] Fatal consumer startup error:', err.message);
    process.exit(1);
  });
}

export default {
  startConsumer,
  stopConsumer,
  CONSUMER_GROUP,
};

