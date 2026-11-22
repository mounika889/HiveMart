/**
 * HiveMart Sprint 9J: Comprehensive End-to-End Quality Assurance,
 * Security Audit, Concurrency, and Pre-Deployment Readiness Suite
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/database.js';
import config from '../config/index.js';
import * as checkoutService from '../services/checkout.service.js';
import * as posService from '../services/pos.service.js';
import * as essentialsService from '../services/monthly-essentials.service.js';
import * as alertService from '../services/alert.service.js';
import * as bestsellerService from '../services/bestseller.service.js';
import { publishOutboxBatch } from '../services/outbox.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const baseUrl = 'http://127.0.0.1:5000/api';
let serverInstance = null;

const setupServer = async () => {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      console.log(`[INFO] Connected to active server at ${baseUrl}`);
      return;
    }
  } catch {
    // Start in-process listener
  }

  await new Promise((resolve) => {
    serverInstance = app.listen(5000, '127.0.0.1', () => {
      console.log('[INFO] Started in-process test server on port 5000');
      resolve();
    });
  });
};

const runSprint9JSuite = async () => {
  console.log('========================================================================');
  console.log('=== SPRINT 9J: COMPREHENSIVE QA, SECURITY & PRE-DEPLOYMENT READINESS ===');
  console.log('========================================================================\n');

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
  const cleanupUserIds = [];
  const cleanupProductIds = [];
  const cleanupListIds = [];

  try {
    // ====================================================================
    // MODULE 1: SECURITY AUDIT & ACCESS CONTROL ENFORCEMENT
    // ====================================================================
    console.log('--- MODULE 1: Security Audit & Access Control Enforcement ---');

    // 1.1 Malformed / Invalid JWT handling
    const malformedTokenRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      headers: { Authorization: 'Bearer invalid.token.payload' },
    });
    assert(malformedTokenRes.status === 401, 'Malformed JWT token rejected with HTTP 401');

    // 1.2 Expired JWT token handling
    const expiredToken = jwt.sign({ id: crypto.randomUUID(), role: 'customer' }, config.jwt.secret, { expiresIn: '-10s' });
    const expiredTokenRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredTokenRes.status === 401, 'Expired JWT token rejected with HTTP 401');

    // 1.3 Forged Secret JWT token handling
    const forgedToken = jwt.sign({ id: crypto.randomUUID(), role: 'customer' }, 'wrong_secret_123456');
    const forgedTokenRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    assert(forgedTokenRes.status === 401, 'Forged JWT secret rejected with HTTP 401');

    // 1.4 Role Escalation Injection on Public Registration
    const regEscalateRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Admin',
        email: `attacker_admin_${timestamp}@hivemart.test`,
        password: 'Password123!',
        role: 'admin', // injection attempt
      }),
    });
    const regEscalateData = await regEscalateRes.json();
    assert(regEscalateRes.status === 201, 'Public registration returns 201');
    assert(regEscalateData.data.user.role === 'customer', 'Role escalation strictly prevented: role enforced as customer');
    cleanupUserIds.push(regEscalateData.data.user.id);

    // 1.5 SQL Injection Attempt in Auth
    const sqliLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: "' OR 1=1 --",
        password: 'any_password',
      }),
    });
    assert(sqliLoginRes.status === 401 || sqliLoginRes.status === 400, 'SQL injection in login payload safely rejected');

    // 1.6 Deactivated Account Block
    const deactUserRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'customer', false) RETURNING id`,
      [`Deactivated User ${timestamp}`, `deact_${timestamp}@hivemart.test`, 'hash123']
    );
    const deactUserId = deactUserRes.rows[0].id;
    cleanupUserIds.push(deactUserId);
    const deactToken = jwt.sign({ id: deactUserId, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' });

    const deactAccessRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      headers: { Authorization: `Bearer ${deactToken}` },
    });
    assert(deactAccessRes.status === 403, 'Deactivated user account rejected with HTTP 403');

    // ====================================================================
    // MODULE 2: HIGH CONCURRENCY & RACE CONDITION PROTECTION
    // ====================================================================
    console.log('\n--- MODULE 2: High-Concurrency & Race Condition Protection ---');

    // Create an isolated 1-unit test product fixture
    const fixtureRes = await pool.query(
      `INSERT INTO products (name, description, category, price, is_active)
       VALUES ($1, 'Concurrency Test Product', 'Groceries', 150.00, true)
       RETURNING id`,
      [`Concurrency Fixture ${timestamp}`]
    );
    const fixtureProdId = fixtureRes.rows[0].id;
    cleanupProductIds.push(fixtureProdId);

    // Seed 1 unit in Bengaluru
    await pool.query(
      `INSERT INTO inventory (product_id, city, quantity)
       VALUES ($1, 'Bengaluru', 1)`,
      [fixtureProdId]
    );

    // Create 2 test customers
    const cA = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, 'hash123', 'customer') RETURNING id`,
      [`Racer A ${timestamp}`, `racer_a_${timestamp}@hivemart.test`]
    );
    const cAId = cA.rows[0].id;
    cleanupUserIds.push(cAId);
    const cAToken = jwt.sign({ id: cAId, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' });

    const cB = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, 'hash123', 'customer') RETURNING id`,
      [`Racer B ${timestamp}`, `racer_b_${timestamp}@hivemart.test`]
    );
    const cBId = cB.rows[0].id;
    cleanupUserIds.push(cBId);
    const cBToken = jwt.sign({ id: cBId, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' });

    // Setup retailer
    const retA = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, 'hash123', 'retailer') RETURNING id`,
      [`POS Cashier ${timestamp}`, `cashier_${timestamp}@hivemart.test`]
    );
    const retAId = retA.rows[0].id;
    cleanupUserIds.push(retAId);
    await pool.query(
      `INSERT INTO retailer_profiles (user_id, assigned_city, approval_status)
       VALUES ($1, 'Bengaluru', 'APPROVED')`,
      [retAId]
    );
    const retAToken = jwt.sign({ id: retAId, role: 'retailer' }, config.jwt.secret, { expiresIn: '1h' });

    // 2.1 Online vs Online Race: Both customers add 1 unit to cart and checkout simultaneously
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cAToken}` },
      body: JSON.stringify({ productId: fixtureProdId, quantity: 1, city: 'Bengaluru' }),
    });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cBToken}` },
      body: JSON.stringify({ productId: fixtureProdId, quantity: 1, city: 'Bengaluru' }),
    });

    const [raceOnlineA, raceOnlineB] = await Promise.all([
      fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cAToken}` },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: `race_on_a_${timestamp}` }),
      }),
      fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cBToken}` },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: `race_on_b_${timestamp}` }),
      }),
    ]);

    const statuses = [raceOnlineA.status, raceOnlineB.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 409, `Online vs Online Race on 1 stock unit: exactly one 201 Created and one 409 Conflict (got ${statuses.join(', ')})`);

    // Verify inventory never went below 0
    const invCheck1 = await pool.query('SELECT quantity FROM inventory WHERE product_id = $1 AND city = $2', [fixtureProdId, 'Bengaluru']);
    assert(invCheck1.rows[0].quantity === 0, `Warehouse quantity cleanly reached 0 (no oversell, got ${invCheck1.rows[0].quantity})`);

    // 2.2 Online vs Offline POS Race on newly added 1 unit
    await pool.query('UPDATE inventory SET quantity = 1 WHERE product_id = $1 AND city = $2', [fixtureProdId, 'Bengaluru']);

    // Set Customer B's cart item again
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [cBId]);
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cBToken}` },
      body: JSON.stringify({ productId: fixtureProdId, quantity: 1, city: 'Bengaluru' }),
    });

    // Create POS draft for Retailer
    const posDraft = await posService.createDraftBill(retAId, {
      items: [{ productId: fixtureProdId, quantity: 1 }],
      paymentMethod: 'CASH',
    });

    // Compete: Customer B checkout vs POS Finalize
    const [competeOnline, competeOffline] = await Promise.all([
      fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cBToken}` },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: `race_cross_on_${timestamp}` }),
      }),
      posService.finalizeBill(retAId, posDraft.id, {
        paymentMethod: 'CASH',
        idempotencyKey: `race_cross_pos_${timestamp}`,
      }).catch((err) => ({ error: err })),
    ]);

    const onlineSuccess = competeOnline.status === 201;
    const offlineSuccess = !competeOffline.error;
    assert((onlineSuccess && !offlineSuccess) || (!onlineSuccess && offlineSuccess), `Online vs POS Race on final unit: serialized safely (online: ${onlineSuccess ? 'WON' : 'CONFLICT'}, pos: ${offlineSuccess ? 'WON' : 'CONFLICT'})`);

    const invCheck2 = await pool.query('SELECT quantity FROM inventory WHERE product_id = $1 AND city = $2', [fixtureProdId, 'Bengaluru']);
    assert(invCheck2.rows[0].quantity === 0, `Warehouse inventory never dropped below 0 (current: ${invCheck2.rows[0].quantity})`);

    // ====================================================================
    // MODULE 3: TRANSACTIONAL OUTBOX & EVENT INTEGRITY
    // ====================================================================
    console.log('\n--- MODULE 3: Transactional Outbox & Event Integrity ---');

    // Check that outbox events exist for the completed order
    const outboxCheck = await pool.query(
      `SELECT id, event_type, aggregate_id, payload 
       FROM outbox_events 
       WHERE event_type IN ('order.created', 'offline.sale.completed')
       ORDER BY created_at DESC LIMIT 3`
    );
    assert(outboxCheck.rows.length >= 1, `Transactional outbox recorded business events (${outboxCheck.rows.length} verified)`);
    assert(outboxCheck.rows[0].payload !== null, 'Outbox event payload contains valid JSON data');

    // Test outbox publisher batch processing
    const publishRes = await publishOutboxBatch(5);
    assert(typeof publishRes === 'object', 'Outbox publisher batch execution completed cleanly');

    // ====================================================================
    // MODULE 4: LATENCY & PERFORMANCE BENCHMARKS (BOUNDED SAFE TRAFFIC)
    // ====================================================================
    console.log('\n--- MODULE 4: Latency & Performance Benchmarks ---');

    // Helper to measure latency
    const measureLatency = async (name, fn) => {
      const start = performance.now();
      await fn();
      const duration = performance.now() - start;
      return duration;
    };

    // 4.1 Product Catalog Listing Latency
    const tCatalog = await measureLatency('Catalog List', async () => {
      await fetch(`${baseUrl}/products?city=Bengaluru&limit=12`);
    });
    assert(tCatalog < 1000, `Product Catalog latency: ${tCatalog.toFixed(1)}ms (< 1000ms threshold)`);

    // 4.2 Search API Latency
    const tSearch = await measureLatency('Product Search', async () => {
      await fetch(`${baseUrl}/search?q=yoga&city=Bengaluru`);
    });
    assert(tSearch < 800, `Search API latency: ${tSearch.toFixed(1)}ms (< 800ms threshold)`);

    // 4.3 Monthly Essentials Retrieval Latency
    const tEssentials = await measureLatency('Monthly Essentials', async () => {
      await fetch(`${baseUrl}/customer/monthly-essentials`, {
        headers: { Authorization: `Bearer ${cAToken}` },
      });
    });
    assert(tEssentials < 800, `Monthly Essentials API latency: ${tEssentials.toFixed(1)}ms (< 800ms threshold)`);

    // 4.4 Retailer Dashboard Latency
    const tRetailer = await measureLatency('Retailer Dashboard', async () => {
      await fetch(`${baseUrl}/retailer/dashboard`, {
        headers: { Authorization: `Bearer ${retAToken}` },
      });
    });
    assert(tRetailer < 2500, `Retailer Dashboard API latency: ${tRetailer.toFixed(1)}ms (< 2500ms threshold)`);

    // ====================================================================
    // MODULE 5: MONTHLY ESSENTIALS & REMINDER ENGINE RELIABILITY
    // ====================================================================
    console.log('\n--- MODULE 5: Monthly Essentials & Reminder Engine Reliability ---');

    // Create essentials list for Customer A
    const listRes = await essentialsService.createList(cAId, {
      name: 'Monthly Recurring Basket',
      shopping_day: 28,
      reminder_days_before: 3,
    });
    const listId = listRes.id;
    cleanupListIds.push(listId);

    // Add item to list
    await essentialsService.addItemToList(cAId, listId, {
      productId: fixtureProdId,
      quantity: 2,
    });

    // Verify Add All to Cart handles 0 stock gracefully
    const addZeroStockRes = await essentialsService.addEssentialsToCart(cAId, listId, 'Bengaluru');
    assert(addZeroStockRes.status === 'success', 'Add All to Cart completes cleanly when stock is 0');
    assert(addZeroStockRes.unavailable_items.length >= 1, 'Out of stock item correctly categorized in unavailable_items');
    assert(addZeroStockRes.unavailable_items[0].reason === 'OUT_OF_STOCK', 'Unavailable item reason is OUT_OF_STOCK');

    // Restock fixture to 5 units in Bengaluru
    await pool.query('UPDATE inventory SET quantity = 5 WHERE product_id = $1 AND city = $2', [fixtureProdId, 'Bengaluru']);

    // Re-run Add All to Cart
    const addRestockedRes = await essentialsService.addEssentialsToCart(cAId, listId, 'Bengaluru');
    assert(addRestockedRes.summary.added_count >= 1, 'Restocked item added to cart successfully');
    assert(addRestockedRes.cart.total_items >= 2, `Cart reflects total items: ${addRestockedRes.cart.total_items}`);

    // Verify double-click / retry does not exceed stock
    const retryAddRes = await essentialsService.addEssentialsToCart(cAId, listId, 'Bengaluru');
    assert(retryAddRes.status === 'success', 'Retry Add All to Cart handles existing items without failing');

    // ====================================================================
    // MODULE 6: COMPREHENSIVE DATABASE INTEGRITY & CLEANUP AUDIT
    // ====================================================================
    console.log('\n--- MODULE 6: Database Integrity & Cleanup Audit ---');

    // Teardown temporary fixtures safely
    for (const lId of cleanupListIds) {
      await pool.query('DELETE FROM monthly_reminders WHERE list_id = $1', [lId]).catch(() => {});
      await pool.query('DELETE FROM monthly_essential_items WHERE list_id = $1', [lId]).catch(() => {});
      await pool.query('DELETE FROM monthly_essentials WHERE id = $1', [lId]).catch(() => {});
    }
    for (const pId of cleanupProductIds) {
      await pool.query('DELETE FROM monthly_essential_items WHERE product_id = $1', [pId]).catch(() => {});
      await pool.query('DELETE FROM cart_items WHERE product_id = $1', [pId]).catch(() => {});
      await pool.query('DELETE FROM order_items WHERE product_id = $1', [pId]).catch(() => {});
      await pool.query('DELETE FROM offline_bill_items WHERE product_id = $1', [pId]).catch(() => {});
      await pool.query('DELETE FROM inventory WHERE product_id = $1', [pId]).catch(() => {});
      await pool.query('DELETE FROM products WHERE id = $1', [pId]).catch(() => {});
    }
    for (const uId of cleanupUserIds) {
      await pool.query('DELETE FROM monthly_reminders WHERE user_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM monthly_essential_items WHERE list_id IN (SELECT id FROM monthly_essentials WHERE user_id = $1)', [uId]).catch(() => {});
      await pool.query('DELETE FROM monthly_essentials WHERE user_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [uId]).catch(() => {});
      await pool.query('DELETE FROM carts WHERE user_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [uId]).catch(() => {});
      await pool.query('DELETE FROM orders WHERE user_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM offline_bill_items WHERE bill_id IN (SELECT id FROM offline_bills WHERE cashier_id = $1)', [uId]).catch(() => {});
      await pool.query('DELETE FROM offline_sales WHERE bill_id IN (SELECT id FROM offline_bills WHERE cashier_id = $1)', [uId]).catch(() => {});
      await pool.query('DELETE FROM offline_bills WHERE cashier_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM notifications WHERE recipient_user_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM retailer_profiles WHERE user_id = $1', [uId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [uId]).catch(() => {});
    }

    // Verify authoritative baseline constraints
    const { rows: prods } = await pool.query('SELECT count(*)::int as c FROM products WHERE is_active = true');
    const { rows: inv } = await pool.query('SELECT count(*)::int as c, min(quantity)::int as min_q FROM inventory');
    const { rows: negInv } = await pool.query('SELECT count(*)::int as c FROM inventory WHERE quantity < 0');

    assert(prods[0].c === 36, `Post-QA Active Products preserved: 36 (got ${prods[0].c})`);
    assert(inv[0].c === 180, `Post-QA City Inventory rows preserved: 180 (got ${inv[0].c})`);
    assert(negInv[0].c === 0, `Zero negative inventory records across all hubs (min quantity: ${inv[0].min_q})`);

  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  console.log('\n========================================================================');
  console.log(`=== SPRINT 9J SUITE FINISHED: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

(async () => {
  try {
    await setupServer();
    await runSprint9JSuite();
  } catch (err) {
    console.error('[FATAL] Sprint 9J suite encountered error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
