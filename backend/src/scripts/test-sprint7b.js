import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { kafka, getKafkaAdmin, disconnectKafkaAdmin, disconnectKafkaProducer } from '../config/kafka.js';
import { publishOutboxBatch } from '../services/outbox.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TOPIC_NAME = process.env.KAFKA_ORDERS_TOPIC || 'hivemart.orders';

const runTests = async () => {
  console.log('=== STARTING SPRINT 7B KAFKA TOPIC & OUTBOX PUBLISHING TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  };

  const testEventIds = [];

  try {
    // -------------------------------------------------------------
    // 1. Verify Topic Topology & Metadata on Real Aiven Kafka Cluster
    // -------------------------------------------------------------
    console.log('--- 1. Verifying Kafka Topic Metadata on Real Aiven Cluster ---');
    const admin = await getKafkaAdmin();
    const metadata = await admin.fetchTopicMetadata({ topics: [TOPIC_NAME] });
    const topicMeta = metadata.topics.find((t) => t.name === TOPIC_NAME);

    assert(!!topicMeta, `Topic "${TOPIC_NAME}" exists on Kafka cluster`);
    assert(topicMeta.partitions.length >= 2, `Topic has expected partition count: ${topicMeta.partitions.length}`);
    console.log(`  Topic "${TOPIC_NAME}" partitions:`);
    topicMeta.partitions.forEach((p) => {
      console.log(`    - Partition ${p.partitionId}: leader=${p.leader}, replicas=[${p.replicas.join(',')}], isr=[${p.isr.join(',')}]`);
      assert(p.isr.length >= 1, `Partition ${p.partitionId} has active in-sync replicas (${p.isr.join(',')})`);
    });

    // -------------------------------------------------------------
    // 2. Create Isolated Test Outbox Events
    // -------------------------------------------------------------
    console.log('\n--- 2. Setting Up Isolated Test Outbox Events ---');
    const timestamp = Date.now();
    const createdEvents = [];

    for (let i = 1; i <= 3; i++) {
      const orderId = `test-order-7b-${i}-${timestamp}`;
      const payload = {
        order_id: orderId,
        user_id: '00000000-0000-0000-0000-000000000001',
        city: 'Bengaluru',
        total_amount: (1000 * i).toFixed(2),
        status: 'CONFIRMED',
        idempotency_key: `test-key-7b-${i}-${timestamp}`,
        items: [
          {
            product_id: '00000000-0000-0000-0000-000000000002',
            product_name: `Test Product ${i}`,
            quantity: i,
            unit_price: '1000.00',
            subtotal: (1000 * i).toFixed(2),
          },
        ],
      };

      const insertRes = await pool.query(
        `INSERT INTO outbox_events (event_type, aggregate_id, payload, created_at)
         VALUES ('order.placed', $1, $2, NOW())
         RETURNING id, event_type, aggregate_id, payload, created_at, published_at, retry_count`,
        [orderId, JSON.stringify(payload)]
      );

      const ev = insertRes.rows[0];
      createdEvents.push(ev);
      testEventIds.push(ev.id);
    }

    assert(createdEvents.length === 3, 'Created 3 isolated test outbox events');
    assert(
      createdEvents.every((e) => e.published_at === null && e.retry_count === 0),
      'All 3 events initialized with published_at=null and retry_count=0'
    );

    // -------------------------------------------------------------
    // 3. Batch Publication Execution (Isolated Event IDs)
    // -------------------------------------------------------------
    console.log('\n--- 3. Publishing Test Outbox Batch to Kafka ---');
    const publishResult = await publishOutboxBatch({
      eventIds: testEventIds,
      batchSize: 10,
    });

    assert(publishResult.claimed === 3, `Claimed 3 test events (actual: ${publishResult.claimed})`);
    assert(publishResult.published === 3, `Published 3 test events to Kafka (actual: ${publishResult.published})`);
    assert(publishResult.failed === 0, `0 events failed in normal run (actual: ${publishResult.failed})`);
    assert(publishResult.publishedIds.length === 3, 'Returned 3 published event IDs');

    // -------------------------------------------------------------
    // 4. Verify Database State Post-Publish
    // -------------------------------------------------------------
    console.log('\n--- 4. Verifying Database State Post-Publish ---');
    const postCheckRes = await pool.query(
      `SELECT id, aggregate_id, published_at, retry_count
       FROM outbox_events
       WHERE id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [testEventIds]
    );

    assert(postCheckRes.rows.length === 3, 'Retrieved 3 test events from database');
    assert(
      postCheckRes.rows.every((r) => r.published_at !== null),
      'All 3 test events now have non-null published_at timestamps'
    );
    assert(
      postCheckRes.rows.every((r) => r.retry_count === 0),
      'All 3 test events retained retry_count=0'
    );
    console.log('  Updated rows sample:', postCheckRes.rows[0]);

    // -------------------------------------------------------------
    // 5. Verify No Duplicate Publication on Repeat Run
    // -------------------------------------------------------------
    console.log('\n--- 5. Verifying No Duplicate Publication on Repeat Run ---');
    const repeatResult = await publishOutboxBatch({
      eventIds: testEventIds,
      batchSize: 10,
    });

    assert(repeatResult.claimed === 0, 'Repeat run claimed 0 events (already marked published)');
    assert(repeatResult.published === 0, 'Repeat run published 0 events');
    assert(repeatResult.failed === 0, 'Repeat run failed 0 events');

    // -------------------------------------------------------------
    // 6. Verify Published Message Content in Kafka
    // -------------------------------------------------------------
    console.log('\n--- 6. Verifying Message Delivery in Kafka Topic ---');
    // First, verify broker high watermark offsets via Admin API
    const topicOffsets = await admin.fetchTopicOffsets(TOPIC_NAME);
    console.log('  Kafka Topic Offsets:', JSON.stringify(topicOffsets));
    const totalHighWatermark = topicOffsets.reduce((acc, p) => acc + parseInt(p.high, 10), 0);
    assert(totalHighWatermark >= 3, `Broker reported total high watermark offset of ${totalHighWatermark} across partitions`);

    const testConsumerGroup = `test-verify-group-${timestamp}`;
    const consumer = kafka.consumer({ groupId: testConsumerGroup });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true });

    let verifiedMessageCount = 0;
    const targetAggregateIds = new Set(createdEvents.map((e) => e.aggregate_id));

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 15000);

      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const key = message.key?.toString();
          if (targetAggregateIds.has(key)) {
            const body = JSON.parse(message.value?.toString() || '{}');
            if (body.event_type === 'order.placed' && targetAggregateIds.has(body.aggregate_id)) {
              verifiedMessageCount++;
              console.log(`  Found published Kafka message: key=${key}, event_id=${body.event_id}, partition=${partition}, offset=${message.offset}`);
              if (verifiedMessageCount >= targetAggregateIds.size) {
                clearTimeout(timeout);
                resolve();
              }
            }
          }
        },
      });
    });

    try {
      await consumer.stop();
      await consumer.disconnect();
    } catch {
      // Ignore disconnect error
    }

    assert(verifiedMessageCount >= 3, `Verified ${verifiedMessageCount} published test message(s) directly from Kafka topic`);

    // -------------------------------------------------------------
    // 7. Verify Safe Failure Behavior & Retry Count Increment
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Failure Behavior & Retry Count Handling ---');
    const failedOrderId = `test-order-fail-${timestamp}`;
    const insertFailRes = await pool.query(
      `INSERT INTO outbox_events (event_type, aggregate_id, payload, created_at)
       VALUES ('order.placed', $1, $2, NOW())
       RETURNING id, event_type, aggregate_id, published_at, retry_count`,
      [failedOrderId, JSON.stringify({ order_id: failedOrderId, reason: 'failure-test' })]
    );

    const failEvent = insertFailRes.rows[0];
    testEventIds.push(failEvent.id);

    // Call publisher targeting an invalid non-existent topic to trigger a controlled Kafka publish error
    const failPublishResult = await publishOutboxBatch({
      eventIds: [failEvent.id],
      targetTopic: 'invalid-non-existent-topic-hivemart',
      timeoutMs: 3000,
    });

    assert(failPublishResult.claimed === 1, 'Claimed 1 event for failure test');
    assert(failPublishResult.published === 0, '0 events published during simulated failure');
    assert(failPublishResult.failed === 1, '1 event recorded as failed');

    // Check database to ensure published_at remains NULL and retry_count was incremented
    const failDbCheck = await pool.query(
      `SELECT id, published_at, retry_count FROM outbox_events WHERE id = $1`,
      [failEvent.id]
    );

    assert(failDbCheck.rows[0].published_at === null, 'Failed event published_at remains NULL');
    assert(failDbCheck.rows[0].retry_count === 1, `Failed event retry_count incremented to 1 (actual: ${failDbCheck.rows[0].retry_count})`);

    // -------------------------------------------------------------
    // 8. Verify Concurrency Safety (FOR UPDATE SKIP LOCKED)
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Concurrency Safety with SKIP LOCKED ---');
    const concurrentOrderId = `test-order-concurrent-${timestamp}`;
    const insertConcRes = await pool.query(
      `INSERT INTO outbox_events (event_type, aggregate_id, payload, created_at)
       VALUES ('order.placed', $1, $2, NOW())
       RETURNING id`,
      [concurrentOrderId, JSON.stringify({ order_id: concurrentOrderId })]
    );
    const concEventId = insertConcRes.rows[0].id;
    testEventIds.push(concEventId);

    // Worker 1 holds a lock in an open transaction
    const client1 = await pool.connect();
    await client1.query('BEGIN');
    const worker1Claim = await client1.query(
      `SELECT id FROM outbox_events WHERE id = $1 AND published_at IS NULL FOR UPDATE SKIP LOCKED`,
      [concEventId]
    );
    assert(worker1Claim.rows.length === 1, 'Worker 1 acquired exclusive row lock on outbox event');

    // Worker 2 attempts to claim the same row concurrently
    const client2 = await pool.connect();
    await client2.query('BEGIN');
    const worker2Claim = await client2.query(
      `SELECT id FROM outbox_events WHERE id = $1 AND published_at IS NULL FOR UPDATE SKIP LOCKED`,
      [concEventId]
    );
    assert(worker2Claim.rows.length === 0, 'Worker 2 skipped the locked row (SKIP LOCKED guaranteed non-overlapping claim)');

    await client1.query('ROLLBACK');
    client1.release();
    await client2.query('ROLLBACK');
    client2.release();

    // -------------------------------------------------------------
    // 9. Verify Existing Catalog and Data Preservation
    // -------------------------------------------------------------
    console.log('\n--- 9. Verifying Catalog, Inventory, & Orders Preservation ---');
    const productsCountRes = await pool.query('SELECT count(*) AS total FROM products WHERE is_active = true');
    assert(parseInt(productsCountRes.rows[0].total, 10) >= 36, `Active product catalog intact: ${productsCountRes.rows[0].total} products`);

    const inventoryCountRes = await pool.query('SELECT count(*) AS total FROM inventory');
    assert(parseInt(inventoryCountRes.rows[0].total, 10) >= 180, `City inventory intact: ${inventoryCountRes.rows[0].total} records across cities`);

    console.log('\n================================================================');
    console.log(`SPRINT 7B TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in Sprint 7B test suite:', err);
    process.exit(1);
  } finally {
    // -------------------------------------------------------------
    // 10. Clean Up Test Events Safely
    // -------------------------------------------------------------
    console.log('[CLEANUP] Cleaning up isolated test events from outbox_events...');
    if (testEventIds.length > 0) {
      try {
        const delRes = await pool.query(
          `DELETE FROM outbox_events WHERE id = ANY($1::uuid[])`,
          [testEventIds]
        );
        console.log(`[CLEANUP] Safely removed ${delRes.rowCount} test events.`);
      } catch (cleanErr) {
        console.error('[CLEANUP] Error deleting test events:', cleanErr.message);
      }
    }

    try {
      await disconnectKafkaProducer();
    } catch {
      // Ignore
    }
    try {
      await disconnectKafkaAdmin();
    } catch {
      // Ignore
    }
    try {
      await pool.end();
    } catch {
      // Ignore
    }

    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
