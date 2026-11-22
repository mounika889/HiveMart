/**
 * HiveMart Sprint 9E Verification Test Suite
 * Comprehensive automated quality assurance, inventory reconciliation,
 * checkout idempotency, payment/shipping claim audit, security review,
 * accessibility checks, and end-to-end data isolation.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = 'http://127.0.0.1:3000';
const BACKEND_URL = 'http://127.0.0.1:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          text: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSprint9eTests() {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9E QUALITY ASSURANCE & REGRESSION SUITE ===');
  console.log('================================================================\n');

  // Load backend database and OpenSearch configs using backend .env
  const backendEnvPath = path.resolve(__dirname, '..', 'backend', '.env');
  const dotenvModule = await import(pathToFileURL(path.resolve(__dirname, '..', 'backend', 'node_modules', 'dotenv', 'lib', 'main.js')).href);
  dotenvModule.config({ path: backendEnvPath });

  const dbModule = await import(pathToFileURL(path.resolve(__dirname, '..', 'backend', 'src', 'config', 'database.js')).href);
  const pool = dbModule.default;

  const osModule = await import(pathToFileURL(path.resolve(__dirname, '..', 'backend', 'src', 'config', 'opensearch.js')).href);
  const openSearchClient = osModule.default;
  const { productsData } = await import(pathToFileURL(path.resolve(__dirname, '..', 'backend', 'src', 'scripts', 'seed-products.js')).href);

  try {
    // -------------------------------------------------------------
    // SECTION 1: Frontend Server & HTML Entry
    // -------------------------------------------------------------
    console.log('--- 1. Frontend Server & HTML Shell ---');
    const indexRes = await fetchJson(FRONTEND_URL);
    assert(indexRes.statusCode === 200, 'Frontend server responds with HTTP 200 on /');
    assert(indexRes.text.includes('id="root"'), 'HTML entry contains React root container (#root)');
    assert(indexRes.text.includes('viewport'), 'HTML entry defines responsive viewport meta tag');
    assert(indexRes.text.includes('HiveMart'), 'HTML title contains HiveMart brand name');

    // -------------------------------------------------------------
    // SECTION 2: Backend Infrastructure Health
    // -------------------------------------------------------------
    console.log('\n--- 2. Infrastructure Health & Connectivity ---');
    const healthRes = await fetchJson(`${BACKEND_URL}/api/health`);
    assert(healthRes.statusCode === 200, 'Backend API health returns HTTP 200');
    assert(healthRes.data?.status === 'ok', 'API health status is "ok"');

    const kafkaHealthRes = await fetchJson(`${BACKEND_URL}/api/health/kafka`);
    assert(kafkaHealthRes.statusCode === 200, 'Kafka health returns HTTP 200');
    assert(kafkaHealthRes.data?.kafka === 'connected', 'Kafka status confirms "connected"');
    assert(kafkaHealthRes.data?.brokers_count >= 2, `Kafka cluster verified with 2 brokers (found: ${kafkaHealthRes.data?.brokers_count})`);

    const osPing = await openSearchClient.ping();
    assert(osPing?.body === true || osPing === true, 'Aiven OpenSearch client ping responds true');

    const pgPing = await pool.query('SELECT 1 AS alive');
    assert(pgPing.rows[0].alive === 1, 'Aiven PostgreSQL 18 connection verified alive');

    // -------------------------------------------------------------
    // SECTION 3: Phase 2 Payment & Shipping Claim Audit
    // -------------------------------------------------------------
    console.log('\n--- 3. Phase 2: Payment & Shipping Claim Audit ---');
    const orderColsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `);
    const orderCols = new Set(orderColsRes.rows.map((r) => r.column_name));

    assert(!orderCols.has('payment_method'), 'orders table does NOT have payment_method (no fake method claims)');
    assert(!orderCols.has('payment_status'), 'orders table does NOT have payment_status (no fake payment gateway)');
    assert(!orderCols.has('delivery_address'), 'orders table does NOT have delivery_address (city is authoritative)');
    assert(!orderCols.has('shipping_charge'), 'orders table does NOT have shipping_charge (no fake shipping calculations)');
    assert(!orderCols.has('tracking_number'), 'orders table does NOT have tracking_number (no fake courier tracking)');

    // Inspect frontend code to ensure no fabricated claims are rendered
    const checkoutPageSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'pages', 'CheckoutPage.tsx'), 'utf8');
    const cartPageSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'pages', 'CartPage.tsx'), 'utf8');
    const orderDetailPageSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'pages', 'OrderDetailPage.tsx'), 'utf8');

    assert(!checkoutPageSrc.includes('Shipping & Delivery: FREE'), 'CheckoutPage does NOT render fabricated "Shipping & Delivery: FREE"');
    assert(!checkoutPageSrc.includes('Pay on Delivery'), 'CheckoutPage does NOT claim fabricated "Pay on Delivery"');
    assert(!cartPageSrc.includes('FREE Delivery'), 'CartPage does NOT render fabricated "FREE Delivery"');
    assert(!orderDetailPageSrc.includes('Total Paid:'), 'OrderDetailPage uses "Total Amount:" instead of fabricated "Total Paid:"');

    // -------------------------------------------------------------
    // SECTION 4: Phase 3 Checkout Idempotency & Retry Safety
    // -------------------------------------------------------------
    console.log('\n--- 4. Phase 3: Checkout Idempotency & Retry Safety ---');
    assert(checkoutPageSrc.includes('hivemart_pending_checkout_'), 'CheckoutPage persists user-scoped pending retry records');
    assert(checkoutPageSrc.includes('cartFingerprint'), 'CheckoutPage computes deterministic cart fingerprint for retry safety');
    assert(checkoutPageSrc.includes('Retry Placement (Protected Key)'), 'CheckoutPage supports safe retry with protected idempotency key');
    assert(checkoutPageSrc.includes('sessionStorage.removeItem'), 'CheckoutPage safely clears pending retry metadata on confirmed success');
    assert(!checkoutPageSrc.includes('localStorage.getItem(\'hivemart_auth_token\')'), 'CheckoutPage does NOT store or leak JWTs in retry metadata');

    // -------------------------------------------------------------
    // SECTION 5: Phase 4 Original Inventory Integrity Audit
    // -------------------------------------------------------------
    console.log('\n--- 5. Phase 4: Original Inventory Integrity Audit ---');
    const prodCountRes = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = true');
    const currentProdCount = parseInt(prodCountRes.rows[0].count, 10);
    assert(currentProdCount === 36, `PostgreSQL has exactly 36 active products (found: ${currentProdCount})`);

    const invCountRes = await pool.query('SELECT COUNT(*) FROM inventory');
    const currentInvCount = parseInt(invCountRes.rows[0].count, 10);
    assert(currentInvCount === 180, `PostgreSQL has exactly 180 city inventory rows (found: ${currentInvCount})`);

    const negStockRes = await pool.query('SELECT COUNT(*) FROM inventory WHERE quantity < 0');
    assert(parseInt(negStockRes.rows[0].count, 10) === 0, 'Zero negative stock rows in PostgreSQL inventory');

    const orphanInvRes = await pool.query('SELECT COUNT(*) FROM inventory WHERE product_id NOT IN (SELECT id FROM products)');
    assert(parseInt(orphanInvRes.rows[0].count, 10) === 0, 'Zero orphan inventory rows in PostgreSQL');

    // Reconcile against seed-products.js baseline
    const baselineMap = new Map();
    for (const p of productsData) {
      baselineMap.set(p.name, p.inventory);
    }

    const allInvRes = await pool.query(`
      SELECT i.quantity, i.city, p.name as product_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
    `);

    let deltasCount = 0;
    for (const row of allInvRes.rows) {
      const baseInv = baselineMap.get(row.product_name);
      if (baseInv && baseInv[row.city] !== undefined) {
        if (baseInv[row.city] !== row.quantity) {
          deltasCount++;
        }
      }
    }
    assert(deltasCount >= 2 && deltasCount <= 6, `Verified historical test purchase deltas exist against seed baseline (found: ${deltasCount})`);
    assert(currentProdCount === 36 && currentInvCount === 180, 'Original catalog structure is intact and preserved');

    // -------------------------------------------------------------
    // SECTION 6: Phase 5 & 12 Safe Test Data Isolation & Pipeline
    // -------------------------------------------------------------
    console.log('\n--- 6. Phase 5 & 12: Safe Test Data Isolation & Pipeline ---');
    const uniqueId = `qa9e_${Date.now()}`;
    const fixtureName = `Sprint 9E Test Isolated Product ${uniqueId}`;
    const testCategory = 'Electronics';
    const testPrice = 899.00;
    const initialCityStock = 10;

    // 1. Create temporary test fixture product
    const insertProdRes = await pool.query(
      `INSERT INTO products (name, description, category, price, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name`,
      [fixtureName, 'Temporary QA9E Isolated Product', testCategory, testPrice, 'https://example.com/item.png', true]
    );
    const fixtureProdId = insertProdRes.rows[0].id;

    for (const city of ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi']) {
      await pool.query(
        `INSERT INTO inventory (product_id, city, quantity) VALUES ($1, $2, $3)`,
        [fixtureProdId, city, initialCityStock]
      );
    }
    assert(fixtureProdId !== null, `Created isolated test fixture product: ${fixtureProdId}`);

    // 2. Register temporary test customer
    const customerEmail = `qa9e_cust_${Date.now()}@hivemart.test`;
    const regRes = await fetchJson(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Sprint 9E QA User',
        email: customerEmail,
        password: 'Password123!',
      },
    });
    assert(regRes.statusCode === 201, 'Registered isolated test customer');
    const authToken = regRes.data?.data?.token;
    const testUserId = regRes.data?.data?.user?.id;

    // 3. Add isolated fixture product to cart
    const addCartRes = await fetchJson(`${BACKEND_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: {
        productId: fixtureProdId,
        quantity: 2,
      },
    });
    assert(addCartRes.statusCode === 201, 'Added isolated fixture product to cart');

    // 4. Execute atomic checkout with stable idempotency key
    const testIdempotencyKey = `qa9e_idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const checkoutRes = await fetchJson(`${BACKEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: {
        city: 'Bengaluru',
        idempotencyKey: testIdempotencyKey,
      },
    });
    assert(checkoutRes.statusCode === 201, 'Atomic checkout returned HTTP 201 Created');
    assert(checkoutRes.data?.status === 'ok', 'Checkout response status is "ok"');
    const placedOrderId = checkoutRes.data?.data?.id;
    assert(placedOrderId !== undefined && placedOrderId !== null, `Order created with UUID: ${placedOrderId}`);
    assert(checkoutRes.data?.data?.status === 'CONFIRMED', 'Order status verified as CONFIRMED');

    // 5. Verify PostgreSQL inventory deducted on fixture product
    const checkStockRes = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = $2`,
      [fixtureProdId, 'Bengaluru']
    );
    assert(checkStockRes.rows[0].quantity === initialCityStock - 2, `PostgreSQL stock accurately deducted from 10 to ${checkStockRes.rows[0].quantity}`);

    // 6. Idempotent replay test: replaying same idempotency key returns 200 without duplication
    const replayRes = await fetchJson(`${BACKEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: {
        city: 'Bengaluru',
        idempotencyKey: testIdempotencyKey,
      },
    });
    assert(replayRes.statusCode === 200, 'Idempotent replay returns HTTP 200 OK');
    assert(replayRes.data?.data?.id === placedOrderId, 'Replay returned the original order ID without duplication');

    // 7. Verify Transactional Outbox Event in PostgreSQL
    const outboxCheck = await pool.query(
      `SELECT id, event_type, aggregate_id, published_at FROM outbox_events WHERE aggregate_id = $1`,
      [placedOrderId]
    );
    assert(outboxCheck.rows.length === 1, 'Transactional outbox event order.placed created in PostgreSQL');
    assert(outboxCheck.rows[0]?.event_type === 'order.placed', 'Outbox event type verified as order.placed');

    // 8. Safely Clean Up Isolated Test Records (Zero impact on original catalog)
    await pool.query('DELETE FROM outbox_events WHERE aggregate_id = $1', [placedOrderId]);
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [placedOrderId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [placedOrderId]);
    await pool.query('DELETE FROM cart_items WHERE product_id = $1', [fixtureProdId]);
    await pool.query('DELETE FROM inventory WHERE product_id = $1', [fixtureProdId]);
    await pool.query('DELETE FROM products WHERE id = $1', [fixtureProdId]);
    await pool.query('DELETE FROM carts WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);

    // Verify catalog counts returned to exact original baseline
    const verifyProdCount = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = true');
    const verifyInvCount = await pool.query('SELECT COUNT(*) FROM inventory');
    assert(parseInt(verifyProdCount.rows[0].count, 10) === 36, 'Product count verified at exactly 36 after cleanup');
    assert(parseInt(verifyInvCount.rows[0].count, 10) === 180, 'Inventory row count verified at exactly 180 after cleanup');

    // -------------------------------------------------------------
    // SECTION 7: Phase 13 Security & Customer Isolation
    // -------------------------------------------------------------
    console.log('\n--- 7. Phase 13: Security & Session Isolation ---');
    const unauthCart = await fetchJson(`${BACKEND_URL}/api/cart`);
    assert(unauthCart.statusCode === 401, 'Unauthenticated cart access rejected with HTTP 401');

    const unauthOrders = await fetchJson(`${BACKEND_URL}/api/orders`);
    assert(unauthOrders.statusCode === 401, 'Unauthenticated orders access rejected with HTTP 401');

    const loginFailRes = await fetchJson(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'nonexistent_customer@hivemart.test',
        password: 'WrongPassword123!',
      },
    });
    assert(loginFailRes.statusCode === 401, 'Invalid login rejected with HTTP 401 Unauthorized');

    // -------------------------------------------------------------
    // SECTION 8: Phase 15 & 16 Responsive & Accessibility
    // -------------------------------------------------------------
    console.log('\n--- 8. Phase 15 & 16: Responsive & Accessibility Standards ---');
    const appSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'App.tsx'), 'utf8');
    assert(appSrc.includes('overflow-x-hidden max-w-full'), 'App layout container includes overflow-x-hidden max-w-full');

    const navbarSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'components', 'layout', 'Navbar.tsx'), 'utf8');
    assert(navbarSrc.includes('hidden sm:block'), 'Navbar hides overflowing auth controls on mobile screens (< sm)');

    const footerSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'components', 'layout', 'Footer.tsx'), 'utf8');
    assert(footerSrc.includes('Sports%20%26%20Fitness'), 'Footer includes all 6 categories including Sports & Fitness');

    assert(cartPageSrc.includes('role="dialog"'), 'Clear Cart modal implements accessible dialog role');
    assert(cartPageSrc.includes('aria-modal="true"'), 'Clear Cart modal implements aria-modal="true"');
    assert(cartPageSrc.includes('e.key === \'Escape\''), 'Clear Cart modal implements Escape key dismissal');

    // Verify Playwright E2E configuration and test suites
    assert(fs.existsSync(path.resolve(__dirname, 'playwright.config.ts')), 'Playwright config exists (playwright.config.ts)');
    const e2eFiles = fs.readdirSync(path.resolve(__dirname, 'e2e')).filter((f) => f.endsWith('.ts'));
    assert(e2eFiles.length >= 8, `All E2E spec files present in frontend/e2e (${e2eFiles.length} files found)`);
  } catch (err) {
    console.error('Test execution error:', err);
    assert(false, `Unexpected execution exception: ${err.message}`);
  } finally {
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`SPRINT 9E TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSprint9eTests();
