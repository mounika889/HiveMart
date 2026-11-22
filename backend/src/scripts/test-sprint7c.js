import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import app from '../app.js';
import pool from '../config/database.js';
import openSearchClient from '../config/opensearch.js';
import { kafka, getKafkaProducer, disconnectKafkaProducer } from '../config/kafka.js';
import { INDEX_NAME, ALIAS_NAME } from './setup-search-index.js';
import {
  syncProductsToOpenSearch,
  handleOrderPlacedEvent,
} from '../services/inventory-search-sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TOPIC_NAME = process.env.KAFKA_ORDERS_TOPIC || 'hivemart.orders';
let serverInstance = null;
let baseUrl = 'http://127.0.0.1:5000/api';

const setupServer = async () => {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      console.log(`[INFO] Connected to existing server at ${baseUrl}`);
      return;
    }
  } catch {
    // Port 5000 not responding, start in-process listener
  }

  await new Promise((resolve) => {
    serverInstance = app.listen(5000, '127.0.0.1', () => {
      console.log('[INFO] Started in-process test server on port 5000');
      resolve();
    });
  });
};

const runTests = async () => {
  console.log('=== STARTING SPRINT 7C KAFKA SEARCH SYNC & CONSUMER TEST SUITE ===\n');
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

  const timestamp = Date.now();
  const testConsumerGroup = `test-search-sync-${timestamp}`;

  let testUserId = null;
  let testProductId = null;
  const testOrderIds = [];
  const testEventIds = [];

  try {
    await setupServer();

    // -------------------------------------------------------------
    // 1. Setup Isolated Temporary Test Product & Customer
    // -------------------------------------------------------------
    console.log('--- 1. Setting Up Isolated Test Product & City Inventory ---');
    const userRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Sync Test User', $1, 'hashed_pwd', 'customer')
       RETURNING id`,
      [`sync_user_${timestamp}@example.com`]
    );
    testUserId = userRes.rows[0].id;

    const prodRes = await pool.query(
      `INSERT INTO products (name, description, category, price, is_active, created_at, updated_at)
       VALUES ($1, 'Next-generation smart sync wearable tracker', 'Electronics', 2499.00, true, NOW(), NOW())
       RETURNING id, name, price, is_active`,
      [`Sprint 7C Smart Sync Tracker ${timestamp}`]
    );
    testProductId = prodRes.rows[0].id;

    // Seed all 5 cities for the test product
    const initialCityStock = {
      Bengaluru: 2,
      Hyderabad: 10,
      Chennai: 5,
      Mumbai: 8,
      Delhi: 12,
    };

    for (const [city, qty] of Object.entries(initialCityStock)) {
      await pool.query(
        `INSERT INTO inventory (product_id, city, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())`,
        [testProductId, city, qty]
      );
    }

    // Initial sync of the test product into OpenSearch
    const initialSync = await syncProductsToOpenSearch([testProductId], { force: true });
    assert(initialSync.syncedCount === 1, 'Initial test product synced to OpenSearch');

    // Verify initial stock via OpenSearch Search API
    const initialSearchRes = await fetch(`${baseUrl}/search?q=Sync+Tracker+${timestamp}&city=Bengaluru`).then((r) => r.json());
    assert(initialSearchRes.status === 'ok', 'Initial search query succeeds');
    const initialMatched = initialSearchRes.data?.find((p) => p.id === testProductId);
    assert(!!initialMatched, 'Test product found in OpenSearch search results');
    assert(initialMatched?.city_stock === 2, `Initial city_stock for Bengaluru is 2 (actual: ${initialMatched?.city_stock})`);

    // -------------------------------------------------------------
    // 2. Simulate Order Checkout & Stock Deduction in PostgreSQL
    // -------------------------------------------------------------
    console.log('\n--- 2. Simulating Order 1 Stock Deduction (2 -> 1 in Bengaluru) ---');
    // Stock is deducted in PostgreSQL checkout (2 - 1 = 1)
    await pool.query(
      `UPDATE inventory
       SET quantity = 1, updated_at = NOW()
       WHERE product_id = $1 AND city = 'Bengaluru'`,
      [testProductId]
    );

    const orderRes1 = await pool.query(
      `INSERT INTO orders (user_id, city, total_amount, status, idempotency_key, created_at)
       VALUES ($1, 'Bengaluru', 2499.00, 'CONFIRMED', $2, NOW())
       RETURNING id`,
      [testUserId, `sync-key-1-${timestamp}`]
    );
    const testOrderId1 = orderRes1.rows[0].id;
    testOrderIds.push(testOrderId1);

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
       VALUES ($1, $2, 1, 2499.00, 2499.00)`,
      [testOrderId1, testProductId]
    );

    const eventId1 = crypto.randomUUID();
    testEventIds.push(eventId1);

    const orderEvent1 = {
      event_id: eventId1,
      event_type: 'order.placed',
      aggregate_id: testOrderId1,
      payload: {
        order_id: testOrderId1,
        items: [{ product_id: testProductId, quantity: 1, unit_price: '2499.00' }],
      },
      created_at: new Date().toISOString(),
    };

    // -------------------------------------------------------------
    // 3. Process Event via Kafka Consumer Logic
    // -------------------------------------------------------------
    console.log('\n--- 3. Consumer Processes order.placed Event & Synchronizes Search ---');
    const processResult1 = await handleOrderPlacedEvent(orderEvent1, { consumerName: testConsumerGroup });
    assert(processResult1.success === true, 'Event 1 handled successfully');
    assert(processResult1.syncedProducts === 1, 'Synchronized 1 product to OpenSearch');

    // Verify processed_events table records deduplication entry
    const procCheck1 = await pool.query(
      `SELECT event_id, consumer_name, processed_at
       FROM processed_events
       WHERE event_id = $1::uuid AND consumer_name = $2`,
      [eventId1, testConsumerGroup]
    );
    assert(procCheck1.rows.length === 1, 'Event 1 recorded in processed_events table');

    // -------------------------------------------------------------
    // 4. Verify OpenSearch Document & Search API Reflect Updated Stock
    // -------------------------------------------------------------
    console.log('\n--- 4. Verifying OpenSearch Reflects PostgreSQL Stock (Bengaluru: 1) ---');
    const osDoc1 = await openSearchClient.get({
      index: ALIAS_NAME,
      id: testProductId,
    });
    const invBengaluru1 = osDoc1.body._source.inventory.find((i) => i.city === 'Bengaluru');
    assert(invBengaluru1.quantity === 1, `OpenSearch document shows Bengaluru stock = 1 (actual: ${invBengaluru1.quantity})`);

    // Other cities remain unchanged
    const invHyd1 = osDoc1.body._source.inventory.find((i) => i.city === 'Hyderabad');
    assert(invHyd1.quantity === 10, `Hyderabad inventory preserved at 10 (actual: ${invHyd1.quantity})`);
    const invDelhi1 = osDoc1.body._source.inventory.find((i) => i.city === 'Delhi');
    assert(invDelhi1.quantity === 12, `Delhi inventory preserved at 12 (actual: ${invDelhi1.quantity})`);

    // Verify Search API projects city_stock correctly
    const searchRes1 = await fetch(`${baseUrl}/search?q=Sync+Tracker+${timestamp}&city=Bengaluru`).then((r) => r.json());
    const matched1 = searchRes1.data?.find((p) => p.id === testProductId);
    assert(matched1?.city_stock === 1, `Search API returns city_stock = 1 for Bengaluru (actual: ${matched1?.city_stock})`);

    // -------------------------------------------------------------
    // 5. Test Sold-Out Scenario (Stock = 0 Excluded from inStock=true)
    // -------------------------------------------------------------
    console.log('\n--- 5. Simulating Order 2 (1 -> 0 in Bengaluru, Sold-Out Filtering) ---');
    await pool.query(
      `UPDATE inventory
       SET quantity = 0, updated_at = NOW()
       WHERE product_id = $1 AND city = 'Bengaluru'`,
      [testProductId]
    );

    const orderRes2 = await pool.query(
      `INSERT INTO orders (user_id, city, total_amount, status, idempotency_key, created_at)
       VALUES ($1, 'Bengaluru', 2499.00, 'CONFIRMED', $2, NOW())
       RETURNING id`,
      [testUserId, `sync-key-2-${timestamp}`]
    );
    const testOrderId2 = orderRes2.rows[0].id;
    testOrderIds.push(testOrderId2);

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
       VALUES ($1, $2, 1, 2499.00, 2499.00)`,
      [testOrderId2, testProductId]
    );

    const eventId2 = crypto.randomUUID();
    testEventIds.push(eventId2);

    const orderEvent2 = {
      event_id: eventId2,
      event_type: 'order.placed',
      aggregate_id: testOrderId2,
      payload: {
        order_id: testOrderId2,
        items: [{ product_id: testProductId, quantity: 1, unit_price: '2499.00' }],
      },
      created_at: new Date().toISOString(),
    };

    const processResult2 = await handleOrderPlacedEvent(orderEvent2, { consumerName: testConsumerGroup });
    assert(processResult2.success === true, 'Event 2 handled successfully');

    // Verify OpenSearch document shows Bengaluru: 0
    const osDoc2 = await openSearchClient.get({
      index: ALIAS_NAME,
      id: testProductId,
    });
    const invBengaluru2 = osDoc2.body._source.inventory.find((i) => i.city === 'Bengaluru');
    assert(invBengaluru2.quantity === 0, 'OpenSearch document shows Bengaluru stock = 0');

    // Query Search API with inStock=true for Bengaluru -> Must be excluded!
    const searchSoldOutRes = await fetch(`${baseUrl}/search?q=Sync+Tracker+${timestamp}&city=Bengaluru&inStock=true`).then((r) => r.json());
    const matchedSoldOut = searchSoldOutRes.data?.find((p) => p.id === testProductId);
    assert(!matchedSoldOut, 'Sold-out product is excluded when inStock=true in Bengaluru');

    // Query Search API with inStock=true for Hyderabad -> Must be included!
    const searchHydRes = await fetch(`${baseUrl}/search?q=Sync+Tracker+${timestamp}&city=Hyderabad&inStock=true`).then((r) => r.json());
    const matchedHyd = searchHydRes.data?.find((p) => p.id === testProductId);
    assert(matchedHyd?.city_stock === 10, 'Product is included for Hyderabad where 10 units are in stock');

    // -------------------------------------------------------------
    // 6. Test Deduplication (Duplicate Event Replay)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Deduplication on Event Replay ---');
    const duplicateResult = await handleOrderPlacedEvent(orderEvent1, { consumerName: testConsumerGroup });
    assert(duplicateResult.success === true, 'Duplicate call returns success');
    assert(duplicateResult.duplicate === true, 'Duplicate call identified as duplicate');

    const procCount = await pool.query(
      `SELECT count(*) AS total FROM processed_events WHERE event_id = $1::uuid AND consumer_name = $2`,
      [eventId1, testConsumerGroup]
    );
    assert(parseInt(procCount.rows[0].total, 10) === 1, 'processed_events record not duplicated');

    // -------------------------------------------------------------
    // 7. Stale Update Protection (Delayed Event Cannot Overwrite Newer Stock)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Stale-Update Protection ---');
    // Artificially update PostgreSQL with an older timestamp and version to simulate delayed replay of older state
    const olderTime = new Date(Date.now() - 3600000); // 1 hour ago
    await pool.query(
      `UPDATE products SET updated_at = $1, version = 5 WHERE id = $2`,
      [olderTime, testProductId]
    );
    await pool.query(
      `UPDATE inventory SET quantity = 99, updated_at = $1 WHERE product_id = $2 AND city = 'Bengaluru'`,
      [olderTime, testProductId]
    );

    // Call sync with stale protection enabled (force: false)
    const staleSyncResult = await syncProductsToOpenSearch([testProductId], { force: false });
    assert(staleSyncResult.staleSkippedCount === 1, 'Stale update was detected and skipped by STALE_GUARD');

    // Verify OpenSearch stock remained at 0 and was NOT overwritten with 99
    const osDocPostStale = await openSearchClient.get({
      index: ALIAS_NAME,
      id: testProductId,
    });
    const invBengaluruPostStale = osDocPostStale.body._source.inventory.find((i) => i.city === 'Bengaluru');
    assert(invBengaluruPostStale.quantity === 0, `OpenSearch stock preserved at 0 against stale update (actual: ${invBengaluruPostStale.quantity})`);

    // Restore correct PostgreSQL inventory
    await pool.query(
      `UPDATE inventory SET quantity = 0, updated_at = NOW() WHERE product_id = $1 AND city = 'Bengaluru'`,
      [testProductId]
    );
    await pool.query(
      `UPDATE products SET updated_at = NOW(), version = 20 WHERE id = $1`,
      [testProductId]
    );

    // -------------------------------------------------------------
    // 8. Safe Handling of Synthetic Historical Orders
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Synthetic / Non-Existent Historical Order Handling ---');
    const syntheticEventId = crypto.randomUUID();
    testEventIds.push(syntheticEventId);
    const syntheticEvent = {
      event_id: syntheticEventId,
      event_type: 'order.placed',
      aggregate_id: crypto.randomUUID(), // Non-existent order in PostgreSQL
      payload: { order_id: 'synthetic-order-123' },
      created_at: new Date().toISOString(),
    };

    const synthResult = await handleOrderPlacedEvent(syntheticEvent, { consumerName: testConsumerGroup });
    assert(synthResult.success === true, 'Synthetic order handled safely without failure');
    assert(synthResult.skipped === true, 'Synthetic order recognized and skipped');

    // -------------------------------------------------------------
    // 9. Testing Retryable Failure Handling
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Retryable Failure on OpenSearch Disconnection ---');
    const retryEventId = crypto.randomUUID();
    testEventIds.push(retryEventId);

    // Create an order for retry testing
    const orderResRetry = await pool.query(
      `INSERT INTO orders (user_id, city, total_amount, status, idempotency_key, created_at)
       VALUES ($1, 'Delhi', 2499.00, 'CONFIRMED', $2, NOW())
       RETURNING id`,
      [testUserId, `sync-key-retry-${timestamp}`]
    );
    const retryOrderId = orderResRetry.rows[0].id;
    testOrderIds.push(retryOrderId);

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
       VALUES ($1, $2, 1, 2499.00, 2499.00)`,
      [retryOrderId, testProductId]
    );

    const retryEvent = {
      event_id: retryEventId,
      event_type: 'order.placed',
      aggregate_id: retryOrderId,
      payload: { order_id: retryOrderId, items: [{ product_id: testProductId }] },
      created_at: new Date().toISOString(),
    };

    // Temporarily mock openSearchClient.index to throw transient network error
    const originalIndex = openSearchClient.index.bind(openSearchClient);
    openSearchClient.index = async () => {
      const connErr = new Error('ECONNREFUSED 127.0.0.1:9200');
      connErr.isRetryable = true;
      throw connErr;
    };

    let caughtRetryable = false;
    try {
      await handleOrderPlacedEvent(retryEvent, { consumerName: testConsumerGroup });
    } catch (e) {
      caughtRetryable = e.isRetryable === true;
    } finally {
      openSearchClient.index = originalIndex;
    }

    assert(caughtRetryable, 'Transient failure threw retryable error to prevent committing offset');

    // Verify event was NOT recorded in processed_events so it remains retryable
    const retryProcCheck = await pool.query(
      `SELECT 1 FROM processed_events WHERE event_id = $1::uuid AND consumer_name = $2`,
      [retryEventId, testConsumerGroup]
    );
    assert(retryProcCheck.rows.length === 0, 'Retryable failure did NOT record event in processed_events');

    // -------------------------------------------------------------
    // 10. Live Kafka Consumer Connectivity Verification
    // -------------------------------------------------------------
    console.log('\n--- 10. Live Kafka Consumer Connection & Subscription ---');
    const liveConsumerGroup = `test-live-consumer-${timestamp}`;
    const testLiveConsumer = kafka.consumer({ groupId: liveConsumerGroup });
    await testLiveConsumer.connect();
    assert(true, 'Kafka consumer connected to Aiven Kafka 4.3 cluster');

    await testLiveConsumer.subscribe({ topic: TOPIC_NAME, fromBeginning: false });
    assert(true, `Kafka consumer subscribed to "${TOPIC_NAME}" without error`);

    await testLiveConsumer.disconnect();
    assert(true, 'Kafka consumer disconnected cleanly');

    // -------------------------------------------------------------
    // 11. Preservation of Existing Seeded Products & System Regression
    // -------------------------------------------------------------
    console.log('\n--- 11. Verifying Preservation of Seeded Products & APIs ---');
    const productsCount = await pool.query(`SELECT count(*) AS total FROM products WHERE is_active = true`);
    assert(parseInt(productsCount.rows[0].total, 10) >= 36, `PostgreSQL has ${productsCount.rows[0].total} active products`);

    const invCount = await pool.query(`SELECT count(*) AS total FROM inventory`);
    assert(parseInt(invCount.rows[0].total, 10) >= 180, `PostgreSQL has ${invCount.rows[0].total} inventory rows`);

    const healthCheck = await fetch(`${baseUrl}/health`).then((r) => r.json());
    assert(healthCheck.status === 'ok', 'GET /api/health returns ok');

    const dbHealthCheck = await fetch(`${baseUrl}/health/db`).then((r) => r.json());
    assert(dbHealthCheck.status === 'ok' && dbHealthCheck.database === 'connected', 'GET /api/health/db returns connected');

    const searchHealthCheck = await fetch(`${baseUrl}/health/search`).then((r) => r.json());
    assert(searchHealthCheck.status === 'ok' && searchHealthCheck.search === 'connected', 'GET /api/health/search returns connected');

    const kafkaHealthCheck = await fetch(`${baseUrl}/health/kafka`).then((r) => r.json());
    assert(kafkaHealthCheck.status === 'ok' && kafkaHealthCheck.kafka === 'connected', 'GET /api/health/kafka returns connected');

    console.log('\n================================================================');
    console.log(`SPRINT 7C TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in Sprint 7C test suite:', err);
    process.exit(1);
  } finally {
    // -------------------------------------------------------------
    // 12. Safe Cleanup of Temporary Test Data
    // -------------------------------------------------------------
    console.log('[CLEANUP] Cleaning up isolated Sprint 7C test data...');

    // 1. Delete test product from OpenSearch
    if (testProductId) {
      try {
        await openSearchClient.delete({
          index: ALIAS_NAME,
          id: testProductId,
          refresh: true,
        });
        console.log(`[CLEANUP] Removed test product ${testProductId} from OpenSearch.`);
      } catch {
        // Ignore delete error if document not found
      }
    }

    // 2. Delete test records from PostgreSQL
    try {
      if (testEventIds.length > 0) {
        await pool.query(`DELETE FROM processed_events WHERE event_id = ANY($1::uuid[])`, [testEventIds]);
      }
      if (testOrderIds.length > 0) {
        await pool.query(`DELETE FROM order_items WHERE order_id = ANY($1::uuid[])`, [testOrderIds]);
        await pool.query(`DELETE FROM orders WHERE id = ANY($1::uuid[])`, [testOrderIds]);
      }
      if (testProductId) {
        await pool.query(`DELETE FROM order_items WHERE product_id = $1::uuid`, [testProductId]);
        await pool.query(`DELETE FROM inventory WHERE product_id = $1::uuid`, [testProductId]);
        await pool.query(`DELETE FROM products WHERE id = $1::uuid`, [testProductId]);
      }
      if (testUserId) {
        await pool.query(`DELETE FROM users WHERE id = $1::uuid`, [testUserId]);
      }
      console.log('[CLEANUP] PostgreSQL test records cleaned up successfully.');
    } catch (cleanErr) {
      console.error('[CLEANUP] Error during PostgreSQL cleanup:', cleanErr.message);
    }

    if (serverInstance) {
      serverInstance.close();
    }
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
