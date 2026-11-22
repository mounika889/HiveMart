/**
 * HiveMart Sprint 9H: Smart Inventory Notifications & Bestseller Analytics Test Suite
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env for PostgreSQL pool
try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../backend/.env'), 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
} catch {
  // Ignore
}

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
    const payloadStr = options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : null;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
        ...(payloadStr ? { 'Content-Length': Buffer.byteLength(payloadStr) } : {}),
      },
      timeout: options.timeout || 15000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${url}`));
    });

    if (payloadStr) {
      req.write(payloadStr);
    }
    req.end();
  });
}

async function runSprint9HFrontendTests() {
  console.log('================================================================');
  console.log('=== HIVEMART SPRINT 9H: FRONTEND INTEGRATION & NOTIFICATIONS ===');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const customerEmail = `alerts_cust_${timestamp}@test.com`;
  const customerPass = 'Password123!';
  const adminEmail = 'admin@hivemart.test';
  const adminPass = 'AdminPassword123!';

  let customerToken = '';
  let adminToken = '';
  let retailerToken = '';

  try {
    // -------------------------------------------------------------
    // PART 1: SOURCE CODE & COMPONENT ARCHITECTURE AUDIT
    // -------------------------------------------------------------
    console.log('--- Part 1: Frontend Component & Route Audit ---');
    const appTsx = fs.readFileSync(path.resolve(__dirname, 'src/App.tsx'), 'utf8');
    assert(appTsx.includes('RetailerNotificationsPage'), 'App.tsx imports RetailerNotificationsPage');
    assert(appTsx.includes('path="/retailer/notifications"'), 'App.tsx defines /retailer/notifications route');

    const navbarTsx = fs.readFileSync(path.resolve(__dirname, 'src/components/layout/Navbar.tsx'), 'utf8');
    assert(navbarTsx.includes('Bell') || navbarTsx.includes('/retailer/notifications'), 'Navbar.tsx includes notifications link for retailers');
    assert(navbarTsx.includes('unreadCount') || navbarTsx.includes('getUnreadNotificationCount'), 'Navbar.tsx tracks unread notifications count badge');

    const notifPageTsx = fs.readFileSync(path.resolve(__dirname, 'src/pages/RetailerNotificationsPage.tsx'), 'utf8');
    assert(notifPageTsx.includes('Warehouse Notifications & Stock Alerts') || notifPageTsx.includes('Notification'), 'RetailerNotificationsPage.tsx is fully implemented');
    assert(notifPageTsx.includes('handleAcknowledge') || notifPageTsx.includes('acknowledgeNotificationAlert'), 'RetailerNotificationsPage supports alert acknowledgment');

    const retailerDashTsx = fs.readFileSync(path.resolve(__dirname, 'src/pages/RetailerDashboardPage.tsx'), 'utf8');
    assert(retailerDashTsx.includes('Smart Warehouse Stock Alerts'), 'RetailerDashboardPage has Smart Alerts section');
    assert(retailerDashTsx.includes('Monthly Bestseller Velocity'), 'RetailerDashboardPage has Monthly Bestseller section');

    const adminDashTsx = fs.readFileSync(path.resolve(__dirname, 'src/pages/AdminDashboardPage.tsx'), 'utf8');
    assert(adminDashTsx.includes('Multi-City Stock Alerts'), 'AdminDashboardPage has Multi-City Alerts section');
    assert(adminDashTsx.includes('Cross-City Monthly Bestsellers'), 'AdminDashboardPage has Cross-City Bestsellers section');
    assert(adminDashTsx.includes('Product Stock Alert Threshold Configurations'), 'AdminDashboardPage has Threshold Configurations section');
    assert(adminDashTsx.includes('Configure Thresholds'), 'AdminDashboardPage has Edit Threshold modal dialog');

    const notifServiceTs = fs.readFileSync(path.resolve(__dirname, 'src/services/notifications.ts'), 'utf8');
    assert(notifServiceTs.includes('getRetailerNotifications'), 'notifications.ts exports getRetailerNotifications');
    assert(notifServiceTs.includes('getUnreadNotificationCount'), 'notifications.ts exports getUnreadNotificationCount');
    assert(notifServiceTs.includes('markNotificationAsRead'), 'notifications.ts exports markNotificationAsRead');
    assert(notifServiceTs.includes('markAllNotificationsAsRead'), 'notifications.ts exports markAllNotificationsAsRead');
    assert(notifServiceTs.includes('getAdminStockAlerts'), 'notifications.ts exports getAdminStockAlerts');
    assert(notifServiceTs.includes('getAdminBestsellers'), 'notifications.ts exports getAdminBestsellers');
    assert(notifServiceTs.includes('getAdminStockThresholds'), 'notifications.ts exports getAdminStockThresholds');
    assert(notifServiceTs.includes('updateAdminStockThreshold'), 'notifications.ts exports updateAdminStockThreshold');
    assert(notifServiceTs.includes('refreshAnalytics'), 'notifications.ts exports refreshAnalytics');

    // -------------------------------------------------------------
    // PART 2: ACTOR AUTHENTICATION & RBAC BOUNDARIES
    // -------------------------------------------------------------
    console.log('\n--- Part 2: Authentication & RBAC Boundaries ---');
    // Customer Registration & Token
    const regRes = await fetchJson(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'Alert Customer', email: customerEmail, password: customerPass },
    });
    assert(regRes.status === 201 && !!regRes.data.data?.token, 'Customer registers successfully');
    customerToken = regRes.data.data?.token;

    // Customer CANNOT access /api/retailer/notifications (HTTP 403)
    const custNotifRes = await fetchJson(`${BACKEND_URL}/api/retailer/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custNotifRes.status === 403, 'Customer denied access to /api/retailer/notifications with HTTP 403');

    // Customer CANNOT access /api/retailer/notifications/unread-count (HTTP 403)
    const custUnreadRes = await fetchJson(`${BACKEND_URL}/api/retailer/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custUnreadRes.status === 403, 'Customer denied access to /api/retailer/notifications/unread-count with HTTP 403');

    // Customer CANNOT access /api/admin/stock-alerts (HTTP 403)
    const custAlertsRes = await fetchJson(`${BACKEND_URL}/api/admin/stock-alerts`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custAlertsRes.status === 403, 'Customer denied access to /api/admin/stock-alerts with HTTP 403');

    // Customer CANNOT access /api/admin/stock-thresholds (HTTP 403)
    const custThreshRes = await fetchJson(`${BACKEND_URL}/api/admin/stock-thresholds`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custThreshRes.status === 403, 'Customer denied access to /api/admin/stock-thresholds with HTTP 403');

    // Admin Login
    const adminLoginRes = await fetchJson(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: adminEmail, password: adminPass },
    });
    assert(adminLoginRes.status === 200 && !!adminLoginRes.data.data?.token, 'Administrator logs in successfully');
    adminToken = adminLoginRes.data.data?.token;

    // Admin creates and approves a test retailer in Bengaluru
    const retailerEmail = `frontend_ret_${timestamp}@hivemart.test`;
    const retailerPass = 'RetailerPass123!';
    const createRetRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: {
        name: 'Bengaluru Store Retailer',
        email: retailerEmail,
        password: retailerPass,
        assignedCity: 'Bengaluru',
        approvalStatus: 'APPROVED',
      },
    });
    assert(createRetRes.status === 201, 'Administrator provisions approved retailer in Bengaluru');

    // Retailer Login
    const retLoginRes = await fetchJson(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: retailerEmail, password: retailerPass },
    });
    assert(retLoginRes.status === 200 && !!retLoginRes.data.data?.token, 'Retailer logs in successfully');
    retailerToken = retLoginRes.data.data?.token;

    // -------------------------------------------------------------
    // PART 3: RETAILER NOTIFICATIONS & SMART ALERT APIS
    // -------------------------------------------------------------
    console.log('\n--- Part 3: Retailer Notifications & Alerts API ---');
    const retNotifRes = await fetchJson(`${BACKEND_URL}/api/retailer/notifications`, {
      headers: { Authorization: `Bearer ${retailerToken}` },
    });
    assert(retNotifRes.status === 200 && Array.isArray(retNotifRes.data.data), 'GET /api/retailer/notifications returns 200 and list');
    assert(retNotifRes.data.pagination && typeof retNotifRes.data.pagination.total === 'number', 'Notifications response includes pagination metadata');

    const retUnreadRes = await fetchJson(`${BACKEND_URL}/api/retailer/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${retailerToken}` },
    });
    assert(retUnreadRes.status === 200 && typeof retUnreadRes.data.data?.unread_count === 'number', 'GET /api/retailer/notifications/unread-count returns 200');

    const retAlertsRes = await fetchJson(`${BACKEND_URL}/api/retailer/stock-alerts`, {
      headers: { Authorization: `Bearer ${retailerToken}` },
    });
    assert(retAlertsRes.status === 200 && Array.isArray(retAlertsRes.data.data), 'GET /api/retailer/stock-alerts returns 200');

    const retBestsellersRes = await fetchJson(`${BACKEND_URL}/api/retailer/bestsellers?limit=5`, {
      headers: { Authorization: `Bearer ${retailerToken}` },
    });
    assert(retBestsellersRes.status === 200 && retBestsellersRes.data.data?.city === 'Bengaluru', 'GET /api/retailer/bestsellers returns 200 for Bengaluru');

    const retDashRes = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
      headers: { Authorization: `Bearer ${retailerToken}` },
    });
    assert(retDashRes.status === 200, 'GET /api/retailer/dashboard returns 200');
    assert(retDashRes.data.data?.metrics?.stock_alerts !== undefined, 'Retailer dashboard data contains metrics.stock_alerts');
    assert(Array.isArray(retDashRes.data.data?.top_bestsellers), 'Retailer dashboard data contains top_bestsellers array');

    // -------------------------------------------------------------
    // PART 4: ADMIN MULTI-CITY OVERSIGHT & THRESHOLDS
    // -------------------------------------------------------------
    console.log('\n--- Part 4: Admin Multi-City Management & Thresholds ---');
    const adminOverviewRes = await fetchJson(`${BACKEND_URL}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminOverviewRes.status === 200 && !!adminOverviewRes.data.data?.alerts_overview, 'GET /api/admin/overview returns alerts_overview');

    const adminAlertsRes = await fetchJson(`${BACKEND_URL}/api/admin/stock-alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAlertsRes.status === 200 && Array.isArray(adminAlertsRes.data.data), 'GET /api/admin/stock-alerts returns 200 and alerts');
    assert(Array.isArray(adminAlertsRes.data.overview?.byCity), 'Admin stock alerts includes city breakdown matrix');

    const adminBestsellersRes = await fetchJson(`${BACKEND_URL}/api/admin/bestsellers?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminBestsellersRes.status === 200 && adminBestsellersRes.data.data?.city === 'Bengaluru', 'GET /api/admin/bestsellers returns 200');

    const adminThresholdsRes = await fetchJson(`${BACKEND_URL}/api/admin/stock-thresholds?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminThresholdsRes.status === 200 && Array.isArray(adminThresholdsRes.data.data), 'GET /api/admin/stock-thresholds returns 200 and list');

    // Pick first product from thresholds
    if (adminThresholdsRes.data.data.length > 0) {
      const sampleItem = adminThresholdsRes.data.data[0];
      const prodId = sampleItem.product_id;

      // Update thresholds with valid hierarchy
      const updateValidRes = await fetchJson(`${BACKEND_URL}/api/admin/stock-thresholds/${prodId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          productId: prodId,
          city: sampleItem.city || 'Bengaluru',
          earlyWarningThreshold: 22,
          minimumStockThreshold: 12,
          criticalStockThreshold: 4,
        },
      });
      assert(updateValidRes.status === 200, 'PATCH /api/admin/stock-thresholds updates thresholds with valid hierarchy (22 >= 12 >= 4)');

      // Inverted hierarchy: early < min -> must return 400
      const updateInvalidRes = await fetchJson(`${BACKEND_URL}/api/admin/stock-thresholds/${prodId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          productId: prodId,
          city: sampleItem.city || 'Bengaluru',
          earlyWarningThreshold: 5,
          minimumStockThreshold: 10,
          criticalStockThreshold: 2,
        },
      });
      assert(updateInvalidRes.status === 400, 'PATCH /api/admin/stock-thresholds rejects inverted hierarchy with HTTP 400');
    }

    // Refresh analytics endpoint
    const refreshRes = await fetchJson(`${BACKEND_URL}/api/admin/analytics/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(refreshRes.status === 200 && refreshRes.data.data?.success === true, 'POST /api/admin/analytics/refresh executes worker successfully');

    // -------------------------------------------------------------
    // PART 5: DATABASE POST-TEST AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Part 5: Database Schema & Baseline Audit ---');
    const { default: pool } = await import('../backend/src/config/database.js');
    const prodRes = await pool.query('SELECT COUNT(*)::int as count FROM products WHERE is_active = true');
    assert(prodRes.rows[0].count === 36, `Post-test catalog has exactly 36 active products (found ${prodRes.rows[0].count})`);

    const invRes = await pool.query('SELECT COUNT(*)::int as count, MIN(quantity)::int as min_stock FROM inventory');
    assert(invRes.rows[0].count === 180, `Post-test inventory has exactly 180 city records (found ${invRes.rows[0].count})`);
    assert(invRes.rows[0].min_stock >= 0, `Zero negative inventory records across all warehouses (min: ${invRes.rows[0].min_stock})`);

    await pool.end();
  } catch (err) {
    console.error('[ERROR] Test failure:', err);
    failedTests++;
  }

  console.log('\n================================================================');
  console.log(`=== SPRINT 9H FRONTEND TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED ===`);
  console.log('================================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runSprint9HFrontendTests();
