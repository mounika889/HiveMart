import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { getKafkaProducer } from '../config/kafka.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_ORDERS_TOPIC = process.env.KAFKA_ORDERS_TOPIC || 'hivemart.orders';
const DEFAULT_BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10);
const DEFAULT_SEND_TIMEOUT_MS = 15000;

/**
 * Reusable transactional outbox publisher service:
 *
 * Concurrency & Lock Tradeoffs:
 * 1. SELECT ... FOR UPDATE SKIP LOCKED guarantees that multiple concurrent worker processes
 *    claim non-overlapping batches of outbox events without blocking each other.
 * 2. Holding database row locks during Kafka publish ensures other workers cannot claim
 *    the same rows while in-flight.
 * 3. To prevent holding database locks indefinitely during network hiccups or Kafka outages,
 *    each Kafka send is bounded by a strict timeout (e.g. 5000ms).
 * 4. At-Least-Once Delivery: If Kafka acknowledges the publish but database commit fails
 *    (e.g., transient network disconnection right before COMMIT), the outbox row remains
 *    with published_at = NULL and will be published again upon retry.
 *    Therefore, downstream consumers must deduplicate events by event_id.
 *
 * @param {Object} options
 * @param {number} [options.batchSize=50] - Maximum events to claim in one batch
 * @param {string[]} [options.eventIds=null] - Optional list of specific event UUIDs (for isolated testing)
 * @param {string} [options.targetTopic=null] - Kafka topic name override
 * @param {number} [options.timeoutMs=5000] - Bounded timeout for Kafka producer sends
 * @returns {Promise<{ claimed: number, published: number, failed: number, publishedIds: string[], failedIds: string[] }>}
 */
export const publishOutboxBatch = async ({
  batchSize = DEFAULT_BATCH_SIZE,
  eventIds = null,
  targetTopic = null,
  timeoutMs = DEFAULT_SEND_TIMEOUT_MS,
} = {}) => {
  const topic = targetTopic || process.env.KAFKA_ORDERS_TOPIC || DEFAULT_ORDERS_TOPIC;
  const client = await pool.connect();

  const resultSummary = {
    claimed: 0,
    published: 0,
    failed: 0,
    publishedIds: [],
    failedIds: [],
  };

  try {
    await client.query('BEGIN');

    // 1. Claim unpublished outbox events with SKIP LOCKED
    let claimQuery;
    let claimParams;

    if (Array.isArray(eventIds) && eventIds.length > 0) {
      // Targeted isolation mode (for tests or manual replay of specific events)
      claimQuery = `
        SELECT id, event_type, aggregate_id, payload, created_at, retry_count
        FROM outbox_events
        WHERE id = ANY($1::uuid[]) AND published_at IS NULL
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      `;
      claimParams = [eventIds, batchSize];
    } else {
      // Standard production worker mode (all unpublished order.placed & offline.sale.completed events)
      claimQuery = `
        SELECT id, event_type, aggregate_id, payload, created_at, retry_count
        FROM outbox_events
        WHERE published_at IS NULL AND event_type IN ('order.placed', 'offline.sale.completed')
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;
      claimParams = [batchSize];
    }

    const claimRes = await client.query(claimQuery, claimParams);
    const events = claimRes.rows;
    resultSummary.claimed = events.length;

    if (events.length === 0) {
      await client.query('COMMIT');
      return resultSummary;
    }

    // 2. Obtain connected Kafka producer
    const producer = await getKafkaProducer();

    const successfullySentIds = [];
    const failedEventIds = [];

    // 3. Publish claimed events sequentially or in batch with bounded timeout
    for (const event of events) {
      let parsedPayload = event.payload;
      if (typeof parsedPayload === 'string') {
        try {
          parsedPayload = JSON.parse(parsedPayload);
        } catch {
          // Keep raw string if JSON parsing fails
        }
      }

      const messagePayload = {
        event_id: event.id,
        event_type: event.event_type,
        aggregate_id: event.aggregate_id,
        payload: parsedPayload,
        created_at: event.created_at,
      };

      const messageKey = String(event.aggregate_id);

      const sendPromise = producer.send({
        topic,
        messages: [
          {
            key: messageKey,
            value: JSON.stringify(messagePayload),
            headers: {
              'event-id': String(event.id),
              'event-type': String(event.event_type),
              'published-by': 'hivemart-outbox-publisher',
            },
          },
        ],
      });

      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Kafka producer send timed out after ${timeoutMs}ms for event ${event.id}`));
        }, timeoutMs);
        if (timer.unref) timer.unref();
      });

      try {
        const sendResult = await Promise.race([sendPromise, timeoutPromise]);
        successfullySentIds.push(event.id);
        const partition = sendResult[0]?.partition ?? 'unknown';
        const offset = sendResult[0]?.baseOffset ?? 'unknown';
        console.log(`[OUTBOX_PUBLISHER] Published event ${event.id} (key: ${messageKey}) -> ${topic} [partition: ${partition}, offset: ${offset}]`);
      } catch (sendErr) {
        console.error(`[OUTBOX_PUBLISHER] Failed to publish event ${event.id}:`, sendErr.message);
        failedEventIds.push(event.id);
        // Break out to avoid holding DB lock across subsequent timeouts if Kafka broker is unavailable
        break;
      }
    }

    // Identify any remaining claimed events that were not attempted due to an earlier failure in the batch
    const attemptedIds = new Set([...successfullySentIds, ...failedEventIds]);
    for (const event of events) {
      if (!attemptedIds.has(event.id)) {
        failedEventIds.push(event.id);
      }
    }

    // 4. Update database state
    // A. Mark successfully acknowledged events as published
    if (successfullySentIds.length > 0) {
      await client.query(
        `UPDATE outbox_events
         SET published_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [successfullySentIds]
      );
    }

    // B. Increment retry_count on failed events (do NOT mark published)
    if (failedEventIds.length > 0) {
      await client.query(
        `UPDATE outbox_events
         SET retry_count = retry_count + 1
         WHERE id = ANY($1::uuid[])`,
        [failedEventIds]
      );
    }

    // 5. Commit transaction to release row locks
    await client.query('COMMIT');

    resultSummary.published = successfullySentIds.length;
    resultSummary.failed = failedEventIds.length;
    resultSummary.publishedIds = successfullySentIds;
    resultSummary.failedIds = failedEventIds;

    return resultSummary;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback error if connection lost
    }
    console.error('[OUTBOX_PUBLISHER] Batch transaction error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

export default {
  publishOutboxBatch,
};

