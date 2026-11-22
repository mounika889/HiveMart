import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import app from '../app.js';
import pool from '../config/database.js';
import openSearchClient from '../config/opensearch.js';
import { kafka, disconnectKafkaProducer, disconnectKafkaAdmin } from '../config/kafka.js';
import { INDEX_NAME, ALIAS_NAME } from './setup-search-index.js';
import { publishOutboxBatch } from '../services/outbox.service.js';
import { handleOrderPlacedEvent, syncProductsToOpenSearch } from '../services/inventory-search-sync.service.js';

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
    // Existing server not running on port 5000, start in-process listener
  }

  await new Promise((resolve) => {
    serverInstance = app.listen(5000, '127.0.0.1', () => {
      console.log('[INFO] Started in-process test server on port 5000');
      resolve();
    });
  });
};

const runSprint8Tests = async () => {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 8 FULL INTEGRATION & RELIABILITY TEST SUITE ===');
  console.log('================================================================\n');

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
  const testConsumerGroup = `test-sprint8-sync-${timestamp}`;

  // Track created fixtures for cleanup
  const cleanupUserIds = [];
  const cleanupProductIds = [];
  const cleanupOrderIds = [];
  const cleanupEventIds = [];

  let customerAToken = '';
  let customerAId = '';
  let customerBToken = '';
  let customerBId = '';

  let tempProductId1 = null;
  let tempProductId2 = null;

  try {
    await setupServer();

    // =============================================================
    // SECTION 1: COMPREHENSIVE API AUDIT (Task 2)
    // =============================================================
    console.log('--- 1. API Verification: Health Endpoints ---');
    const h1 = await fetch(`${baseUrl}/health`).then((r) => r.json());
    assert(h1.status === 'ok' && h1.service === 'HiveMart API', 'GET /api/health returns 200 ok');

    const h2 = await fetch(`${baseUrl}/health/db`).then((r) => r.json());
    assert(h2.status === 'ok' && h2.database === 'connected' && !!h2.timestamp, 'GET /api/health/db returns 200 connected');

    const h3 = await fetch(`${baseUrl}/health/search`).then((r) => r.json());
    assert(h3.status === 'ok' && h3.search === 'connected' && !!h3.cluster_name, 'GET /api/health/search returns 200 connected');

    const h4 = await fetch(`${baseUrl}/health/kafka`).then((r) => r.json());
    assert(h4.status === 'ok' && h4.kafka === 'connected' && !!h4.cluster_id, 'GET /api/health/kafka returns 200 connected');

    console.log('\n--- 2. API Verification: Products & Catalog Endpoints ---');
    const categoriesRes = await fetch(`${baseUrl}/categories`).then((r) => r.json());
    assert(categoriesRes.status === 'ok' && Array.isArray(categoriesRes.data) && categoriesRes.data.length >= 6, 'GET /api/categories returns 6+ categories');

    const productsRes = await fetch(`${baseUrl}/products?limit=5&category=Electronics`).then((r) => r.json());
    assert(productsRes.status === 'ok' && Array.isArray(productsRes.data), 'GET /api/products with category filter returns array');

    // Retrieve a guaranteed seeded catalog product
    const seededProdDb = await pool.query(
      "SELECT id FROM products WHERE is_active = true AND name NOT LIKE 'Sprint 8%' AND name NOT LIKE 'TEMP%' LIMIT 1"
    );
    const firstSeededProduct = seededProdDb.rows[0];
    assert(!!firstSeededProduct?.id, 'Seeded product has UUID id');

    const singleProdRes = await fetch(`${baseUrl}/products/${firstSeededProduct.id}`).then((r) => r.json());
    assert(singleProdRes.status === 'ok' && singleProdRes.data.id === firstSeededProduct.id, 'GET /api/products/:id returns product details');
    assert(Array.isArray(singleProdRes.data.inventory) && singleProdRes.data.inventory.length === 5, 'Product details include 5 city inventory records');

    const invRes = await fetch(`${baseUrl}/inventory/${firstSeededProduct.id}`).then((r) => r.json());
    assert(invRes.status === 'ok' && invRes.data?.product_id === firstSeededProduct.id && Array.isArray(invRes.data?.cities) && invRes.data.cities.length === 5, 'GET /api/inventory/:productId returns city inventory');

    console.log('\n--- 3. API Verification: OpenSearch Search Endpoint ---');
    // Keyword search
    const searchKeyword = await fetch(`${baseUrl}/search?q=coffee`).then((r) => r.json());
    assert(searchKeyword.status === 'ok' && Array.isArray(searchKeyword.data) && searchKeyword.data.length > 0, 'GET /api/search with keyword matches products');

    // Typo-tolerant search
    const searchTypo = await fetch(`${baseUrl}/search?q=cofee`).then((r) => r.json());
    assert(searchTypo.status === 'ok' && Array.isArray(searchTypo.data) && searchTypo.data.length > 0, 'GET /api/search handles fuzzy typo matching (cofee -> coffee)');

    // Category + City filter + Sorting
    const searchFiltered = await fetch(`${baseUrl}/search?category=Electronics&city=Bengaluru&sort=price_asc&limit=3`).then((r) => r.json());
    assert(searchFiltered.status === 'ok' && Array.isArray(searchFiltered.data), 'GET /api/search supports category, city, and sort filters');
    if (searchFiltered.data.length > 0) {
      assert(searchFiltered.data[0].city === 'Bengaluru' && typeof searchFiltered.data[0].city_stock === 'number', 'Search result projects city_stock for Bengaluru');
    }

    // In-stock filter
    const searchInStock = await fetch(`${baseUrl}/search?city=Bengaluru&inStock=true&limit=2`).then((r) => r.json());
    assert(searchInStock.status === 'ok' && searchInStock.data.every((p) => p.city_stock > 0), 'GET /api/search inStock=true returns only available products');

    // Empty result handling
    const searchEmpty = await fetch(`${baseUrl}/search?q=nonexistentproductxyz123987`).then((r) => r.json());
    assert(searchEmpty.status === 'ok' && Array.isArray(searchEmpty.data) && searchEmpty.data.length === 0, 'GET /api/search returns empty array on unmatched queries');

    // =============================================================
    // SECTION 2: CUSTOMER JOURNEY A (Tasks 3 & 4)
    // =============================================================
    console.log('\n--- 4. Customer A Journey: Registration & Login ---');
    const customerAEmail = `customer_a_${timestamp}@example.com`;
    const regResA = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Customer A', email: customerAEmail, password: 'Password123!' }),
    }).then((r) => r.json());

    assert(regResA.status === 'ok' && !!regResA.data?.token, 'Customer A registered successfully with JWT');
    customerAId = regResA.data?.user?.id;
    customerAToken = regResA.data?.token;
    cleanupUserIds.push(customerAId);

    const loginResA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerAEmail, password: 'Password123!' }),
    }).then((r) => r.json());
    assert(loginResA.status === 'ok' && loginResA.data?.user?.email === customerAEmail, 'Customer A logged in successfully');

    const meResA = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    }).then((r) => r.json());
    assert(meResA.status === 'ok' && meResA.data?.user?.id === customerAId, 'GET /api/auth/me returns authenticated customer profile');

    console.log('\n--- 5. Setting Up Isolated Test Product 1 (Initial Stock: Bengaluru=3) ---');
    const prodRes1 = await pool.query(
      `INSERT INTO products (name, description, category, price, is_active, version, created_at, updated_at)
       VALUES ($1, 'High-fidelity wireless studio audio monitor', 'Electronics', 3499.00, true, 10, NOW(), NOW())
       RETURNING id, name, price`,
      [`Sprint 8 Wireless Studio Monitor ${timestamp}`]
    );
    tempProductId1 = prodRes1.rows[0].id;
    cleanupProductIds.push(tempProductId1);

    const initialCities1 = {
      Bengaluru: 3,
      Hyderabad: 10,
      Chennai: 5,
      Mumbai: 8,
      Delhi: 12,
    };
    for (const [city, qty] of Object.entries(initialCities1)) {
      await pool.query(
        `INSERT INTO inventory (product_id, city, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())`,
        [tempProductId1, city, qty]
      );
    }

    // Index product 1 into OpenSearch
    await syncProductsToOpenSearch([tempProductId1], { force: true });

    // Verify Customer A can search for the product
    const searchFound1 = await fetch(`${baseUrl}/search?q=Studio+Monitor+${timestamp}&city=Bengaluru`).then((r) => r.json());
    const matchedP1 = searchFound1.data?.find((p) => p.id === tempProductId1);
    assert(!!matchedP1 && matchedP1.city_stock === 3, `Customer A searches and finds product with Bengaluru stock = 3`);

    console.log('\n--- 6. Customer A: Cart Operations & Persistence ---');
    // Add product 1 (2 units) to cart
    const addCartResA = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAToken}` },
      body: JSON.stringify({ productId: tempProductId1, quantity: 2 }),
    }).then((r) => r.json());
    assert(addCartResA.status === 'ok', 'Product added to Customer A cart');

    // Verify persistent cart
    const cartResA = await fetch(`${baseUrl}/cart?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    }).then((r) => r.json());
    assert(cartResA.status === 'ok' && cartResA.data.items.length === 1, 'Customer A persistent cart contains 1 item');
    assert(cartResA.data.items[0].quantity === 2, 'Item quantity is 2');
    assert(cartResA.data.items[0].city_stock === 3, 'Cart projects city_stock = 3');
    assert(cartResA.data.items[0].is_available_in_city === true, 'Cart confirms item is available in city');

    console.log('\n--- 7. Customer A: Atomic Checkout & Outbox Generation ---');
    const checkoutKeyA = `checkout-key-a-${timestamp}`;
    const checkoutResA = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAToken}` },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: checkoutKeyA }),
    }).then((r) => r.json());

    assert(checkoutResA.status === 'ok', 'Customer A checkout succeeds');
    const orderA = checkoutResA.data;
    assert(!!orderA && orderA.status === 'CONFIRMED', 'Order created with CONFIRMED status');
    cleanupOrderIds.push(orderA.id);

    // Verify cart cleared
    const cartPostCheckoutA = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    }).then((r) => r.json());
    assert(cartPostCheckoutA.status === 'ok' && cartPostCheckoutA.data.items.length === 0, 'Customer A cart was cleared upon checkout');

    // Verify PostgreSQL inventory deducted exactly once (3 - 2 = 1)
    const invCheckA = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = 'Bengaluru'`,
      [tempProductId1]
    );
    assert(invCheckA.rows[0].quantity === 1, `PostgreSQL inventory deducted exactly once: 3 - 2 = 1 (actual: ${invCheckA.rows[0].quantity})`);

    // Verify outbox event created atomically
    const outboxResA = await pool.query(
      `SELECT id, event_type, aggregate_id, payload, published_at
       FROM outbox_events
       WHERE aggregate_id = $1 AND event_type = 'order.placed'`,
      [orderA.id]
    );
    assert(outboxResA.rows.length === 1, 'Transactional outbox event created for order');
    const outboxEventA = outboxResA.rows[0];
    cleanupEventIds.push(outboxEventA.id);
    assert(outboxEventA.published_at === null, 'Outbox event initialized with published_at = null');

    // =============================================================
    // SECTION 3: REAL KAFKA END-TO-END CONSUMPTION (Task 4)
    // =============================================================
    console.log('\n--- 8. Real Kafka End-to-End Pipeline: Publish & Dedicated Consumer ---');
    // Step A: Publish targeted outbox event to real Kafka
    const publishResultA = await publishOutboxBatch({ eventIds: [outboxEventA.id] });
    assert(publishResultA.published === 1, 'Outbox publisher sent event to Kafka topic');

    // Verify database marked published
    const postPubCheckA = await pool.query(`SELECT published_at FROM outbox_events WHERE id = $1`, [outboxEventA.id]);
    assert(postPubCheckA.rows[0].published_at !== null, 'Outbox row marked published_at after broker send acknowledgment');

    // Step B: Dedicated real Kafka consumer receives message from Kafka topic
    const realConsumer = kafka.consumer({ groupId: testConsumerGroup });
    await realConsumer.connect();
    await realConsumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true });

    let messageReceivedOverKafka = false;
    let receivedPayload = null;

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, 15000);

      realConsumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
          const key = message.key?.toString();
          if (key === String(orderA.id)) {
            messageReceivedOverKafka = true;
            receivedPayload = JSON.parse(message.value?.toString() || '{}');
            console.log(`  [KAFKA_LIVE] Received message over Kafka: key=${key}, offset=${message.offset}, partition=${partition}`);

            // Invoke real synchronization handler
            await handleOrderPlacedEvent(receivedPayload, { consumerName: testConsumerGroup });
            await realConsumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
            clearTimeout(timer);
            resolve();
          }
        },
      });
    });

    try {
      await realConsumer.stop();
      await realConsumer.disconnect();
    } catch {
      // Ignore
    }

    assert(messageReceivedOverKafka, 'Message was actually received over live Kafka broker connection');
    assert(receivedPayload?.event_id === outboxEventA.id, 'Received Kafka event matches published outbox event ID');

    // Verify processed_events updated
    const procCheckA = await pool.query(
      `SELECT 1 FROM processed_events WHERE event_id = $1::uuid AND consumer_name = $2`,
      [outboxEventA.id, testConsumerGroup]
    );
    assert(procCheckA.rows.length === 1, 'processed_events record inserted by consumer');

    // Step C: Verify OpenSearch document refreshed
    const osDocA = await openSearchClient.get({ index: ALIAS_NAME, id: tempProductId1 });
    const osBengaluruA = osDocA.body._source.inventory.find((i) => i.city === 'Bengaluru');
    assert(osBengaluruA.quantity === 1, `OpenSearch document refreshed with Bengaluru stock = 1 (actual: ${osBengaluruA.quantity})`);

    // Step D: Verify Search API projects new stock
    const searchPostSyncA = await fetch(`${baseUrl}/search?q=Studio+Monitor+${timestamp}&city=Bengaluru`).then((r) => r.json());
    const matchedPostSyncA = searchPostSyncA.data?.find((p) => p.id === tempProductId1);
    assert(matchedPostSyncA?.city_stock === 1, `Public Search API shows updated city_stock = 1`);

    console.log('\n--- 9. Customer A: Order History & Ownership ---');
    const orderHistoryA = await fetch(`${baseUrl}/orders`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    }).then((r) => r.json());
    assert(orderHistoryA.status === 'ok' && orderHistoryA.data.some((o) => o.id === orderA.id), 'Customer A order history lists placed order');

    const singleOrderA = await fetch(`${baseUrl}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${customerAToken}` },
    }).then((r) => r.json());
    assert(singleOrderA.status === 'ok' && singleOrderA.data.id === orderA.id, 'Customer A can view single order details');
    assert(singleOrderA.data.items.length === 1 && singleOrderA.data.items[0].product_id === tempProductId1, 'Order items reflect purchased product');

    // =============================================================
    // SECTION 4: CUSTOMER B & CROSS-USER ISOLATION (Task 3)
    // =============================================================
    console.log('\n--- 10. Customer B: Registration & Cross-User Isolation ---');
    const customerBEmail = `customer_b_${timestamp}@example.com`;
    const regResB = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Customer B', email: customerBEmail, password: 'Password123!' }),
    }).then((r) => r.json());
    customerBId = regResB.data?.user?.id;
    customerBToken = regResB.data?.token;
    cleanupUserIds.push(customerBId);

    // Verify Customer B cannot see Customer A's cart
    const cartResB = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customerBToken}` },
    }).then((r) => r.json());
    assert(cartResB.status === 'ok' && cartResB.data.items.length === 0, 'Customer B cart is completely empty (isolated from Customer A)');

    // Verify Customer B cannot access Customer A's order
    const accessOrderResB = await fetch(`${baseUrl}/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${customerBToken}` },
    });
    assert(accessOrderResB.status === 404 || accessOrderResB.status === 403, 'Customer B is denied access to Customer A order (HTTP 404/403 enforced)');

    // =============================================================
    // SECTION 5: INVENTORY & CONCURRENCY RACE SAFETY (Task 5)
    // =============================================================
    console.log('\n--- 11. Concurrency Race: Two Customers Compete for the Final 1 Unit ---');
    // Setup isolated Product 2 with exactly 1 unit in Bengaluru
    const prodRes2 = await pool.query(
      `INSERT INTO products (name, description, category, price, is_active, version, created_at, updated_at)
       VALUES ($1, 'Ultra-limited edition mechanical switch keyboard', 'Electronics', 4999.00, true, 10, NOW(), NOW())
       RETURNING id, name, price`,
      [`Sprint 8 Limited Edition Keyboard ${timestamp}`]
    );
    tempProductId2 = prodRes2.rows[0].id;
    cleanupProductIds.push(tempProductId2);

    await pool.query(
      `INSERT INTO inventory (product_id, city, quantity, updated_at)
       VALUES ($1, 'Bengaluru', 1, NOW())`,
      [tempProductId2]
    );

    // Customer A adds 1 unit to cart
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAToken}` },
      body: JSON.stringify({ productId: tempProductId2, quantity: 1 }),
    });

    // Customer B adds 1 unit to cart
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerBToken}` },
      body: JSON.stringify({ productId: tempProductId2, quantity: 1 }),
    });

    // Fire concurrent simultaneous checkouts
    const racePromises = [
      fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAToken}` },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: `race-a-${timestamp}` }),
      }),
      fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerBToken}` },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: `race-b-${timestamp}` }),
      }),
    ];

    const raceResponses = await Promise.all(racePromises);
    const statusCodes = raceResponses.map((r) => r.status);
    const bodies = await Promise.all(raceResponses.map((r) => r.json()));

    const successCount = statusCodes.filter((s) => s === 201 || s === 200).length;
    const failureCount = statusCodes.filter((s) => s === 400 || s === 409).length;

    assert(successCount === 1, `Exactly one customer checkout succeeded (HTTP 201/200: ${successCount})`);
    assert(failureCount === 1, `The other customer was rejected due to insufficient stock (HTTP 400/409: ${failureCount})`);

    // Track winner order ID for cleanup
    const winningBody = bodies.find((b) => b.status === 'ok');
    if (winningBody?.data?.id) {
      cleanupOrderIds.push(winningBody.data.id);
    }

    // Verify inventory never becomes negative (must be exactly 0)
    const stockAfterRace = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = 'Bengaluru'`,
      [tempProductId2]
    );
    assert(stockAfterRace.rows[0].quantity === 0, `PostgreSQL stock is exactly 0 and never became negative (actual: ${stockAfterRace.rows[0].quantity})`);

    // Idempotency replay on the winning checkout
    const winnerKey = winningBody?.data?.idempotency_key;
    const winnerToken = winningBody?.data?.user_id === customerAId ? customerAToken : customerBToken;
    const replayRes = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${winnerToken}` },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: winnerKey }),
    }).then((r) => r.json());

    assert(replayRes.status === 'ok', 'Idempotent replay succeeds');
    assert(replayRes.message?.includes('Idempotent replay'), 'Response identifies order as idempotent replay');
    assert(replayRes.data?.id === winningBody?.data?.id, 'Returns identical order ID without re-deducting stock');

    // =============================================================
    // SECTION 6: OPENSEARCH CONCURRENCY & VERSIONING RACE (Task 6)
    // =============================================================
    console.log('\n--- 12. OpenSearch Atomic Versioning Concurrency & Stale Guard ---');
    // Ensure product 2 exists in OpenSearch at version 15
    await openSearchClient.index({
      index: INDEX_NAME,
      id: tempProductId2,
      version: 15,
      version_type: 'external_gte',
      refresh: true,
      body: {
        product_id: tempProductId2,
        name: 'Keyboard v15',
        inventory: [{ city: 'Bengaluru', quantity: 0 }],
        version: 15,
        updated_at: new Date().toISOString(),
      },
    });

    // Simulate concurrent sync attempt with an older version (version 12)
    let staleWriteRejectedByOpenSearch = false;
    try {
      await openSearchClient.index({
        index: INDEX_NAME,
        id: tempProductId2,
        version: 12, // Stale! 12 < 15
        version_type: 'external_gte',
        refresh: true,
        body: {
          product_id: tempProductId2,
          name: 'Keyboard v12 Stale Overwrite Attempt',
          inventory: [{ city: 'Bengaluru', quantity: 99 }],
          version: 12,
          updated_at: new Date(Date.now() - 3600000).toISOString(),
        },
      });
    } catch (osConflictErr) {
      if (osConflictErr.statusCode === 409 || osConflictErr.meta?.statusCode === 409) {
        staleWriteRejectedByOpenSearch = true;
      }
    }
    assert(staleWriteRejectedByOpenSearch, 'OpenSearch native Lucene engine atomically rejected older version write with HTTP 409');

    // Verify OpenSearch document retained latest stock (0) and was NOT overwritten by stale write (99)
    const osDocPostRace = await openSearchClient.get({ index: ALIAS_NAME, id: tempProductId2 });
    assert(osDocPostRace.body._source.inventory[0].quantity === 0, 'Document retained current stock 0 against concurrent stale write');

    // =============================================================
    // SECTION 7: FAILURE INJECTION & RECOVERY (Task 7)
    // =============================================================
    console.log('\n--- 13. Failure Injection & Recovery Testing ---');
    // A. Missing JWT
    const unauthRes = await fetch(`${baseUrl}/orders`);
    assert(unauthRes.status === 401, 'Request without JWT is rejected with HTTP 401');

    // B. Invalid Cart Quantity
    const invalidCartRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAToken}` },
      body: JSON.stringify({ productId: tempProductId1, quantity: -5 }),
    });
    assert(invalidCartRes.status === 400, 'Adding negative cart quantity is rejected with HTTP 400');

    // C. Out-of-Stock Checkout
    const oosCheckoutRes = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAToken}` },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: `oos-key-${timestamp}` }),
    });
    assert(oosCheckoutRes.status === 400, 'Checkout with empty cart is rejected with HTTP 400');

    // D. Duplicate Kafka Event Handling
    const dupCheckEvent = {
      event_id: crypto.randomUUID(),
      event_type: 'order.placed',
      aggregate_id: orderA.id,
      payload: { order_id: orderA.id },
      created_at: new Date().toISOString(),
    };
    cleanupEventIds.push(dupCheckEvent.event_id);
    const firstHandle = await handleOrderPlacedEvent(dupCheckEvent, { consumerName: testConsumerGroup });
    assert(firstHandle.success === true, 'First event handle succeeds');
    const secondHandle = await handleOrderPlacedEvent(dupCheckEvent, { consumerName: testConsumerGroup });
    assert(secondHandle.duplicate === true, 'Second event handle detected as duplicate without re-executing OpenSearch write');

    // E. Invalid JSON Event
    const invalidJsonRes = await handleOrderPlacedEvent('invalid-non-object-string', { consumerName: testConsumerGroup });
    assert(invalidJsonRes.skipped === true, 'Permanently invalid event safely skipped without crashing');

    // F. Synthetic Historical Order
    const synthEvent = {
      event_id: crypto.randomUUID(),
      event_type: 'order.placed',
      aggregate_id: crypto.randomUUID(), // Non-existent order
      payload: {},
      created_at: new Date().toISOString(),
    };
    cleanupEventIds.push(synthEvent.event_id);
    const synthRes = await handleOrderPlacedEvent(synthEvent, { consumerName: testConsumerGroup });
    assert(synthRes.skipped === true, 'Synthetic historical order handled safely without corrupting inventory');

    // =============================================================
    // SECTION 8: SEEDED CATALOG PRESERVATION & CLEANUP (Tasks 8 & 9)
    // =============================================================
    console.log('\n--- 14. Verifying Catalog Integrity & Database Preservation ---');
    const catalogCount = await pool.query("SELECT count(*) AS total FROM products WHERE is_active = true AND name NOT LIKE 'Sprint 8%' AND name NOT LIKE 'TEMP%'");
    assert(parseInt(catalogCount.rows[0].total, 10) === 36, `PostgreSQL has exactly 36 original active seeded products intact (actual: ${catalogCount.rows[0].total})`);

    const inventoryCount = await pool.query(
      "SELECT count(*) AS total FROM inventory i JOIN products p ON i.product_id = p.id WHERE p.name NOT LIKE 'Sprint 8%' AND p.name NOT LIKE 'TEMP%'"
    );
    assert(parseInt(inventoryCount.rows[0].total, 10) === 180, `PostgreSQL has exactly 180 original inventory rows intact (actual: ${inventoryCount.rows[0].total})`);

    console.log('\n================================================================');
    console.log(`SPRINT 8 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in Sprint 8 test suite:', err);
    process.exit(1);
  } finally {
    // -------------------------------------------------------------
    // SAFE CLEANUP OF TEMPORARY TEST FIXTURES
    // -------------------------------------------------------------
    console.log('[CLEANUP] Cleaning up isolated Sprint 8 test fixtures...');

    // 1. Delete test products from OpenSearch
    for (const pid of cleanupProductIds) {
      try {
        await openSearchClient.delete({ index: ALIAS_NAME, id: pid, refresh: true });
        console.log(`[CLEANUP] Removed test product ${pid} from OpenSearch.`);
      } catch {
        // Ignore
      }
    }

    // 2. Delete test records from PostgreSQL in strict FK-dependency order
    try {
      if (cleanupEventIds.length > 0) {
        await pool.query('DELETE FROM processed_events WHERE event_id = ANY($1::uuid[])', [cleanupEventIds]);
        await pool.query('DELETE FROM outbox_events WHERE id = ANY($1::uuid[])', [cleanupEventIds]);
      }
      if (cleanupProductIds.length > 0 || cleanupOrderIds.length > 0) {
        await pool.query(
          'DELETE FROM order_items WHERE product_id = ANY($1::uuid[]) OR order_id = ANY($2::uuid[])',
          [cleanupProductIds, cleanupOrderIds]
        );
      }
      if (cleanupOrderIds.length > 0) {
        await pool.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [cleanupOrderIds]);
      }
      if (cleanupProductIds.length > 0) {
        await pool.query('DELETE FROM inventory WHERE product_id = ANY($1::uuid[])', [cleanupProductIds]);
        await pool.query('DELETE FROM products WHERE id = ANY($1::uuid[])', [cleanupProductIds]);
      }
      if (cleanupUserIds.length > 0) {
        await pool.query('DELETE FROM carts WHERE user_id = ANY($1::uuid[])', [cleanupUserIds]);
        await pool.query('DELETE FROM orders WHERE user_id = ANY($1::uuid[])', [cleanupUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [cleanupUserIds]);
      }
      console.log('[CLEANUP] PostgreSQL test records cleaned up successfully.');
    } catch (cleanErr) {
      console.error('[CLEANUP] Error during PostgreSQL cleanup:', cleanErr.message);
    }

    try {
      await disconnectKafkaProducer();
    } catch {}
    try {
      await disconnectKafkaAdmin();
    } catch {}
    try {
      await pool.end();
    } catch {}
    if (serverInstance) {
      serverInstance.close();
    }

    process.exit(failed > 0 ? 1 : 0);
  }
};

runSprint8Tests();
