import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/database.js';
import config from '../config/index.js';
import * as alertService from '../services/alert.service.js';
import * as bestsellerService from '../services/bestseller.service.js';
import { runDailyAnalyticsWorker } from '../services/bestseller.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const baseUrl = 'http://127.0.0.1:5000/api';
let serverInstance = null;

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

const runSprint9HTests = async () => {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9H: SMART INVENTORY ALERTS & ANALYTICS ===');
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

  // Cleanup tracking lists
  const cleanupUserIds = [];
  const cleanupProductIds = [];
  const cleanupBillIds = [];

  try {
    await setupServer();

    // Initial cleanup of any previous failed test debris
    await pool.query(`DELETE FROM notifications WHERE alert_id IN (SELECT id FROM inventory_alerts WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Alert Test%'))`);
    await pool.query(`DELETE FROM inventory_alerts WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Alert Test%')`);
    await pool.query(`DELETE FROM stock_alert_settings WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Alert Test%')`);
    await pool.query(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Alert Test%')`);
    await pool.query(`DELETE FROM products WHERE name LIKE 'Alert Test%'`);

    // =============================================================
    // SECTION 1: BASELINE & DATABASE INTEGRITY AUDIT
    // =============================================================
    console.log('--- 1. Baseline Inventory & Schema Audit ---');
    const prodCountRes = await pool.query('SELECT COUNT(*)::int as count FROM products WHERE is_active = true');
    assert(prodCountRes.rows[0].count === 36, `Catalog contains exactly 36 active baseline products (found ${prodCountRes.rows[0].count})`);

    const invCountRes = await pool.query('SELECT COUNT(*)::int as count, MIN(quantity)::int as min_stock FROM inventory');
    assert(invCountRes.rows[0].count === 180, `Inventory contains exactly 180 city inventory rows (found ${invCountRes.rows[0].count})`);
    assert(invCountRes.rows[0].min_stock >= 0, `Zero negative inventory records exist across all warehouses (min: ${invCountRes.rows[0].min_stock})`);

    // Check Sprint 9H tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('stock_alert_settings', 'inventory_alerts', 'notifications', 'sales_analytics_daily')
    `);
    assert(tablesCheck.rows.length === 4, 'All 4 Sprint 9H tables present in PostgreSQL schema');

    // =============================================================
    // SECTION 2: AUTHENTICATION FIXTURES
    // =============================================================
    console.log('\n--- 2. Setting Up Test Actors (Admin, BLR Retailer, CHN Retailer) ---');
    // Admin user
    let adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE LOWER(role) = 'admin' AND is_active = true LIMIT 1");
    let adminUser = adminUserRes.rows[0];
    if (!adminUser) {
      const newAdminId = crypto.randomUUID();
      const insertAdmin = await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role, is_active)
         VALUES ($1, 'Test Admin', $2, 'hash', 'admin', true) RETURNING id, email, role`,
        [newAdminId, `admin_test_${timestamp}@hivemart.test`]
      );
      adminUser = insertAdmin.rows[0];
      cleanupUserIds.push(adminUser.id);
    }
    const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: 'admin' }, config.jwt.secret, { expiresIn: '1h' });
    assert(!!adminToken, 'Admin JWT token generated successfully');

    // BLR Retailer
    const blrRetailerId = crypto.randomUUID();
    const blrProfileId = crypto.randomUUID();
    const blrEmail = `retailer_blr_${timestamp}@hivemart.test`;
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active)
       VALUES ($1, 'BLR Retailer Test', $2, 'hash', 'retailer', true)`,
      [blrRetailerId, blrEmail]
    );
    await pool.query(
      `INSERT INTO retailer_profiles (id, user_id, assigned_city, approval_status)
       VALUES ($1, $2, 'Bengaluru', 'APPROVED')`,
      [blrProfileId, blrRetailerId]
    );
    cleanupUserIds.push(blrRetailerId);
    const blrToken = jwt.sign({ id: blrRetailerId, email: blrEmail, role: 'retailer' }, config.jwt.secret, { expiresIn: '1h' });

    // CHN Retailer
    const chnRetailerId = crypto.randomUUID();
    const chnProfileId = crypto.randomUUID();
    const chnEmail = `retailer_chn_${timestamp}@hivemart.test`;
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active)
       VALUES ($1, 'CHN Retailer Test', $2, 'hash', 'retailer', true)`,
      [chnRetailerId, chnEmail]
    );
    await pool.query(
      `INSERT INTO retailer_profiles (id, user_id, assigned_city, approval_status)
       VALUES ($1, $2, 'Chennai', 'APPROVED')`,
      [chnProfileId, chnRetailerId]
    );
    cleanupUserIds.push(chnRetailerId);
    const chnToken = jwt.sign({ id: chnRetailerId, email: chnEmail, role: 'retailer' }, config.jwt.secret, { expiresIn: '1h' });
    assert(!!blrToken && !!chnToken, 'Bengaluru and Chennai test retailer credentials created');

    // =============================================================
    // SECTION 3: STOCK THRESHOLD ENGINE UNIT & TRANSITION TESTS
    // =============================================================
    console.log('\n--- 3. Stock Threshold Classification & State Transitions ---');
    // Test product
    const testProdId = crypto.randomUUID();
    cleanupProductIds.push(testProdId);
    await pool.query(
      `INSERT INTO products (id, name, description, category, price, is_active)
       VALUES ($1, 'Alert Test Product', 'Testing alert state transitions', 'Electronics', 999.00, true)`,
      [testProdId]
    );
    await pool.query(
      `INSERT INTO inventory (id, product_id, city, quantity)
       VALUES ($1, $2, 'Bengaluru', 25)`,
      [crypto.randomUUID(), testProdId]
    );

    // 3.1 Healthy stock test (> 20 default)
    const healthyEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 25);
    assert(healthyEval.severity === 'HEALTHY' && healthyEval.action === 'NONE', 'Stock = 25 classified as HEALTHY (action = NONE)');

    // 3.2 Drop to 15 (<= 20) -> REORDER_SOON (INFO)
    await pool.query('UPDATE inventory SET quantity = 15 WHERE product_id = $1 AND city = $2', [testProdId, 'Bengaluru']);
    const reorderEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 15);
    assert(reorderEval.action === 'CREATED_NEW_ALERT', 'Drop to 15 creates new alert');
    assert(reorderEval.alertType === 'REORDER_SOON', 'Alert type is REORDER_SOON');
    assert(reorderEval.severity === 'INFO', 'Alert severity is INFO');

    // 3.3 Drop to 8 (<= 10) -> LOW_STOCK (WARNING)
    await pool.query('UPDATE inventory SET quantity = 8 WHERE product_id = $1 AND city = $2', [testProdId, 'Bengaluru']);
    const lowEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 8);
    assert(lowEval.action === 'CREATED_NEW_ALERT' && lowEval.alertType === 'LOW_STOCK', 'Drop to 8 triggers LOW_STOCK');
    assert(lowEval.severity === 'WARNING', 'Severity escalated to WARNING');

    // 3.4 Drop to 3 (<= 5) -> CRITICAL_STOCK (CRITICAL)
    await pool.query('UPDATE inventory SET quantity = 3 WHERE product_id = $1 AND city = $2', [testProdId, 'Bengaluru']);
    const critEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 3);
    assert(critEval.action === 'CREATED_NEW_ALERT' && critEval.alertType === 'CRITICAL_STOCK', 'Drop to 3 triggers CRITICAL_STOCK');
    assert(critEval.severity === 'CRITICAL', 'Severity escalated to CRITICAL');

    // 3.5 Drop to 0 -> OUT_OF_STOCK (URGENT)
    await pool.query('UPDATE inventory SET quantity = 0 WHERE product_id = $1 AND city = $2', [testProdId, 'Bengaluru']);
    const oosEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 0);
    assert(oosEval.action === 'CREATED_NEW_ALERT' && oosEval.alertType === 'OUT_OF_STOCK', 'Drop to 0 triggers OUT_OF_STOCK');
    assert(oosEval.severity === 'URGENT', 'Severity escalated to URGENT');

    // 3.6 Deduplication: Repeated sales at 0 stock
    const oosRepeatEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 0);
    assert(oosRepeatEval.action === 'UPDATED_EXISTING_ALERT', 'Repeated transaction at stock=0 suppresses duplicate creation (UPDATED_EXISTING_ALERT)');
    assert(oosRepeatEval.duplicateSuppressed === true, 'Duplicate notification suppressed flag true');
    
    const activeOosCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM inventory_alerts
       WHERE product_id = $1 AND city = 'Bengaluru' AND alert_type = 'OUT_OF_STOCK' AND status = 'ACTIVE'`,
      [testProdId]
    );
    assert(activeOosCount.rows[0].count === 1, 'Exactly 1 ACTIVE alert exists for OUT_OF_STOCK (no duplicate alerts)');

    // 3.7 Restock resolution: Restocking to 25 units (> 20)
    await pool.query('UPDATE inventory SET quantity = 25 WHERE product_id = $1 AND city = $2', [testProdId, 'Bengaluru']);
    const restockEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 25);
    assert(restockEval.action === 'RESOLVED_EXISTING_ALERT', 'Restocking to 25 resolves active alert (RESOLVED_EXISTING_ALERT)');

    const resolvedAlertCheck = await pool.query(
      `SELECT status, resolved_at FROM inventory_alerts WHERE product_id = $1 AND city = 'Bengaluru'`,
      [testProdId]
    );
    assert(resolvedAlertCheck.rows.every((r) => r.status === 'RESOLVED' && !!r.resolved_at), 'All previous alerts marked RESOLVED with timestamp');

    // 3.8 Subsequent stock drop creates fresh new alert cycle
    await pool.query('UPDATE inventory SET quantity = 8 WHERE product_id = $1 AND city = $2', [testProdId, 'Bengaluru']);
    const newCycleEval = await alertService.evaluateProductStock(testProdId, 'Bengaluru', 8);
    assert(newCycleEval.action === 'CREATED_NEW_ALERT' && newCycleEval.severity === 'WARNING', 'Subsequent stock drop creates fresh new ACTIVE alert cycle');
    const activeAlertId = newCycleEval.alertId;
    assert(!!activeAlertId, 'New alert has valid UUID');

    // =============================================================
    // SECTION 4: RETAILER CITY ISOLATION & ACKNOWLEDGMENT
    // =============================================================
    console.log('\n--- 4. Retailer Isolation & Notification Acknowledgement ---');

    // BLR retailer sees BLR notifications
    const blrNotifRes = await fetch(`${baseUrl}/retailer/notifications`, {
      headers: { Authorization: `Bearer ${blrToken}` },
    }).then((r) => r.json());
    assert(blrNotifRes.status === 'ok' && Array.isArray(blrNotifRes.data), 'GET /api/retailer/notifications returns ok');
    const blrHasAlertNotif = blrNotifRes.data.some((n) => n.product_id === testProdId);
    assert(blrHasAlertNotif, 'Bengaluru retailer receives notification for Bengaluru alert');

    // CHN retailer CANNOT see BLR notifications
    const chnNotifRes = await fetch(`${baseUrl}/retailer/notifications`, {
      headers: { Authorization: `Bearer ${chnToken}` },
    }).then((r) => r.json());
    const chnHasBlrAlert = chnNotifRes.data?.some((n) => n.product_id === testProdId);
    assert(!chnHasBlrAlert, 'Chennai retailer cannot see Bengaluru alert notifications (isolation preserved)');

    // CHN retailer CANNOT acknowledge BLR alert (returns 403 or 404)
    const chnAckRes = await fetch(`${baseUrl}/retailer/notifications/${activeAlertId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${chnToken}` },
    });
    assert(chnAckRes.status === 403 || chnAckRes.status === 404, 'Cross-city alert acknowledgment rejected with 403/404');

    // BLR retailer acknowledges BLR alert
    const blrAckRes = await fetch(`${baseUrl}/retailer/notifications/${activeAlertId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${blrToken}` },
    }).then((r) => r.json());
    assert(blrAckRes.status === 'ok' && blrAckRes.data.status === 'ACKNOWLEDGED', 'Bengaluru retailer successfully acknowledges alert');

    // Check DB record
    const ackDb = await pool.query('SELECT status, acknowledged_by FROM inventory_alerts WHERE id = $1', [activeAlertId]);
    assert(ackDb.rows[0].status === 'ACKNOWLEDGED' && ackDb.rows[0].acknowledged_by === blrRetailerId, 'Alert in DB updated with ACKNOWLEDGED status and user ID');

    // Notification Read / Read All endpoints
    const unreadCountBefore = await fetch(`${baseUrl}/retailer/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${blrToken}` },
    }).then((r) => r.json());
    assert(unreadCountBefore.status === 'ok' && typeof unreadCountBefore.data.unread_count === 'number', 'GET /api/retailer/notifications/unread-count works');

    const markAllReadRes = await fetch(`${baseUrl}/retailer/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${blrToken}` },
    }).then((r) => r.json());
    assert(markAllReadRes.status === 'ok', 'PATCH /api/retailer/notifications/read-all succeeds');

    const unreadCountAfter = await fetch(`${baseUrl}/retailer/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${blrToken}` },
    }).then((r) => r.json());
    assert(unreadCountAfter.data.unread_count === 0, 'Unread notification count drops to 0 after read-all');

    // =============================================================
    // SECTION 5: MONTHLY BESTSELLER ANALYTICS
    // =============================================================
    console.log('\n--- 5. Monthly Bestseller Analytics & Replenishment Warnings ---');
    // Seed offline bill items for test product to simulate sales
    const testBillId = crypto.randomUUID();
    cleanupBillIds.push(testBillId);
    await pool.query(
      `INSERT INTO offline_bills (
         id, bill_number, retailer_id, city, status, payment_method, subtotal_amount, total_amount, created_at, finalized_at
       ) VALUES ($1, $2, $3, 'Bengaluru', 'FINALIZED', 'CASH', 9990.00, 9990.00, NOW(), NOW())`,
      [testBillId, `BILL-TEST-${timestamp}`, blrRetailerId]
    );
    await pool.query(
      `INSERT INTO offline_bill_items (
         id, bill_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total
       ) VALUES ($1, $2, $3, 'Alert Test Product', 999.00, 10, 9990.00)`,
      [crypto.randomUUID(), testBillId, testProdId]
    );

    // Call getCityBestsellers for Bengaluru
    const bestsellers = await bestsellerService.getCityBestsellers('Bengaluru', { limit: 10 });
    assert(bestsellers.city === 'Bengaluru', 'Bestsellers report generated for Bengaluru');
    assert(Array.isArray(bestsellers.bestsellers), 'Bestsellers contains ranked items array');

    const testItemBestseller = bestsellers.bestsellers.find((b) => b.productId === testProdId);
    assert(!!testItemBestseller, 'Test product included in city bestsellers list');
    if (testItemBestseller) {
      assert(testItemBestseller.totalUnits >= 10, `Aggregated sales velocity captured (total units: ${testItemBestseller.totalUnits})`);
      assert(testItemBestseller.avgDailySales > 0, `Daily sales velocity computed (> 0: ${testItemBestseller.avgDailySales})`);
      assert(testItemBestseller.daysOfStockRemaining !== null, `Days of stock coverage calculated (${testItemBestseller.daysOfStockRemaining} days)`);
    }

    // Evaluate Bestseller replenishment alerts
    const replEval = await bestsellerService.evaluateBestsellerReplenishmentAlerts('Bengaluru');
    assert(typeof replEval.warningsGenerated === 'number', 'evaluateBestsellerReplenishmentAlerts executed cleanly');

    // Run Daily Analytics Worker with advisory lock
    console.log('\n--- 6. Analytics Background Worker & Advisory Lock ---');
    const workerRes = await runDailyAnalyticsWorker();
    assert(workerRes.success === true, 'runDailyAnalyticsWorker runs with pg advisory lock');
    assert(workerRes.citiesRefreshed === 5, 'Worker refreshed all 5 warehouse cities');

    const analyticsDailyRows = await pool.query('SELECT COUNT(*)::int as count FROM sales_analytics_daily');
    assert(analyticsDailyRows.rows[0].count > 0, 'sales_analytics_daily table populated with aggregated rows');

    // =============================================================
    // SECTION 7: ADMIN THRESHOLD CONFIGURATION & REST API
    // =============================================================
    console.log('\n--- 7. Admin Multi-City Overview & Threshold Governance Endpoints ---');
    // Admin Overview
    const adminOverviewRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(adminOverviewRes.status === 'ok' && !!adminOverviewRes.data?.alerts_overview, 'GET /api/admin/overview returns alerts_overview');

    // Admin Stock Alerts
    const adminAlertsRes = await fetch(`${baseUrl}/admin/stock-alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(adminAlertsRes.status === 'ok' && Array.isArray(adminAlertsRes.data), 'GET /api/admin/stock-alerts returns platform alerts');
    assert(Array.isArray(adminAlertsRes.overview?.byCity), 'Admin alerts response includes city matrix');

    // Admin Bestsellers
    const adminBestsellersRes = await fetch(`${baseUrl}/admin/bestsellers?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(adminBestsellersRes.status === 'ok' && adminBestsellersRes.data.city === 'Bengaluru', 'GET /api/admin/bestsellers returns city bestsellers');

    // Admin Stock Thresholds list
    const adminThresholdsRes = await fetch(`${baseUrl}/admin/stock-thresholds`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(adminThresholdsRes.status === 'ok' && Array.isArray(adminThresholdsRes.data), 'GET /api/admin/stock-thresholds returns configuration list');

    // Admin Threshold update: Valid hierarchy
    const updateValidRes = await fetch(`${baseUrl}/admin/stock-thresholds/${testProdId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: testProdId,
        city: 'Bengaluru',
        earlyWarningThreshold: 15,
        minimumStockThreshold: 8,
        criticalStockThreshold: 3,
      }),
    });
    const updateValidJson = await updateValidRes.json();
    assert(updateValidRes.status === 200 && updateValidJson.status === 'ok', 'PATCH /api/admin/stock-thresholds updates setting with valid hierarchy');

    // Admin Threshold update: Inverted hierarchy (early < min) -> Must return 400
    const updateInvalidRes = await fetch(`${baseUrl}/admin/stock-thresholds/${testProdId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: testProdId,
        city: 'Bengaluru',
        earlyWarningThreshold: 4,
        minimumStockThreshold: 10,
        criticalStockThreshold: 2,
      }),
    });
    assert(updateInvalidRes.status === 400, 'PATCH /api/admin/stock-thresholds rejects inverted hierarchy (early < min) with 400');

    // Admin Refresh Analytics endpoint
    const refreshApiRes = await fetch(`${baseUrl}/admin/analytics/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(refreshApiRes.status === 'ok' && refreshApiRes.data.success === true, 'POST /api/admin/analytics/refresh triggers worker');

    // Retailer Dashboard metrics extension
    const retailerDashRes = await fetch(`${baseUrl}/retailer/dashboard`, {
      headers: { Authorization: `Bearer ${blrToken}` },
    }).then((r) => r.json());
    assert(retailerDashRes.status === 'ok', 'GET /api/retailer/dashboard returns 200');
    assert(retailerDashRes.data?.metrics?.stock_alerts !== undefined, 'Retailer dashboard contains metrics.stock_alerts');
    assert(Array.isArray(retailerDashRes.data?.top_bestsellers), 'Retailer dashboard contains top_bestsellers array');

  } catch (err) {
    console.error('[ERROR] Test failure:', err);
    failed++;
  } finally {
    // =============================================================
    // SECTION 8: CLEAN TEARDOWN & INTEGRITY VERIFICATION
    // =============================================================
    console.log('\n--- 8. Clean Teardown & Post-Test Catalog Audit ---');
    try {
      if (cleanupBillIds.length > 0) {
        await pool.query('DELETE FROM offline_bill_items WHERE bill_id = ANY($1)', [cleanupBillIds]);
        await pool.query('DELETE FROM offline_bills WHERE id = ANY($1)', [cleanupBillIds]);
      }

      if (cleanupProductIds.length > 0) {
        await pool.query('DELETE FROM notifications WHERE alert_id IN (SELECT id FROM inventory_alerts WHERE product_id = ANY($1))', [cleanupProductIds]);
        await pool.query('DELETE FROM inventory_alerts WHERE product_id = ANY($1)', [cleanupProductIds]);
        await pool.query('DELETE FROM stock_alert_settings WHERE product_id = ANY($1)', [cleanupProductIds]);
        await pool.query('DELETE FROM inventory WHERE product_id = ANY($1)', [cleanupProductIds]);
        await pool.query('DELETE FROM products WHERE id = ANY($1)', [cleanupProductIds]);
      }

      if (cleanupUserIds.length > 0) {
        await pool.query('DELETE FROM notifications WHERE recipient_user_id = ANY($1)', [cleanupUserIds]);
        await pool.query('DELETE FROM retailer_profiles WHERE user_id = ANY($1)', [cleanupUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [cleanupUserIds]);
      }
    } catch (cleanErr) {
      console.warn('[WARN] Error during cleanup:', cleanErr.message);
    }

    const postProdCount = await pool.query('SELECT COUNT(*)::int as count FROM products WHERE is_active = true');
    assert(postProdCount.rows[0].count === 36, `Original 36 active catalog products preserved exactly (found ${postProdCount.rows[0].count})`);

    const postInvCount = await pool.query('SELECT COUNT(*)::int as count, MIN(quantity)::int as min_stock FROM inventory');
    assert(postInvCount.rows[0].count === 180, `Original 180 city inventory rows preserved exactly (found ${postInvCount.rows[0].count})`);
    assert(postInvCount.rows[0].min_stock >= 0, `Zero negative inventory records post-test (min: ${postInvCount.rows[0].min_stock})`);

    console.log('\n================================================================');
    console.log(`=== SPRINT 9H TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
    console.log('================================================================\n');

    if (serverInstance) {
      serverInstance.close();
    }
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runSprint9HTests();
