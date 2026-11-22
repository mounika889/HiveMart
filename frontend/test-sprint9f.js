/**
 * HiveMart Sprint 9F Role-Based Access Control (RBAC) & Multi-Role Dashboard Tests
 *
 * Comprehensive automated verification covering:
 * Part 1: Public Registration Role Enforcement (Privilege escalation immunity)
 * Part 2: Customer Authorization Boundaries & Route Protection (HTTP 403)
 * Part 3: Administrator Authentication & Overview Dashboard API
 * Part 4: Retailer Provisioning & Initial State Verification
 * Part 5: Retailer Authentication & City Warehouse Inventory Access
 * Part 6: Retailer Security Boundaries (HTTP 403 on admin routes)
 * Part 7: Administrative Governance: Dynamic Approval & Suspension Enforcement
 * Part 8: Administrative Governance: Regional City Hub Reassignment
 * Part 9: Administrative Governance: Account Deactivation & Reactivation
 * Part 10: Backward Compatibility: Customer Shopping Cart & Atomic Checkout
 * Part 11: Database Schema & Row Integrity (Catalog 36 items, 180 inventory records, 0 negative stock)
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env for DB pool check
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
  // Ignore if not present
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
          json = { raw: data };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out: ${url}`));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSprint9FTests() {
  console.log('===============================================================');
  console.log('   HIVEMART SPRINT 9F — RBAC & MULTI-ROLE VERIFICATION SUITE   ');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const adminEmail = 'admin@hivemart.test';
  const adminPassword = 'AdminPassword123!';

  let customerToken = null;
  let customerId = null;
  let adminToken = null;
  let retailerToken = null;
  let retailerId = null;
  const retailerEmail = `retailer_${timestamp}@hivemart.test`;
  const retailerPassword = 'RetailerPassword123!';

  // =========================================================================
  // PART 1: Public Registration Role Enforcement (No privilege escalation)
  // =========================================================================
  console.log('--- Part 1: Public Registration Role Enforcement ---');

  const escalUserPayload = {
    name: 'Malicious Attacker',
    email: `escalation_${timestamp}@hivemart.test`,
    password: 'Password123!',
    role: 'admin', // Attempting privilege escalation
    is_active: true,
  };

  const regRes = await fetchJson(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: escalUserPayload,
  });

  assert(regRes.status === 201, 'Public registration returns HTTP 201');
  assert(regRes.data.status === 'ok', 'Public registration returns status: ok');
  assert(regRes.data.data.user.role === 'customer', 'Public registration strictly enforces role: customer');
  assert(regRes.data.data.user.role !== 'admin', 'Public registration rejected admin role injection');

  customerToken = regRes.data.data.token;
  customerId = regRes.data.data.user.id;
  assert(!!customerToken, 'Customer JWT token received');

  // Verify GET /api/auth/me returns customer
  const meRes = await fetchJson(`${BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(meRes.status === 200, 'Customer /api/auth/me returns HTTP 200');
  assert(meRes.data.data.user.role === 'customer', 'Customer role in profile is customer');
  assert(meRes.data.data.user.is_active === true, 'Customer is active by default');

  // =========================================================================
  // PART 2: Customer Authorization Boundaries & Route Protection (HTTP 403)
  // =========================================================================
  console.log('\n--- Part 2: Customer Authorization Boundaries & Route Protection ---');

  const custAdminOverview = await fetchJson(`${BACKEND_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(custAdminOverview.status === 403, 'Customer blocked from /api/admin/overview with HTTP 403');
  assert(
    custAdminOverview.data.message.includes('Insufficient permissions') ||
      custAdminOverview.data.message.includes('Access denied'),
    'Appropriate error message for forbidden admin access'
  );

  const custAdminRetailers = await fetchJson(`${BACKEND_URL}/api/admin/retailers`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(custAdminRetailers.status === 403, 'Customer blocked from /api/admin/retailers with HTTP 403');

  const custRetailerDash = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(custRetailerDash.status === 403, 'Customer blocked from /api/retailer/dashboard with HTTP 403');

  // Request without auth token
  const unauthRes = await fetchJson(`${BACKEND_URL}/api/admin/overview`);
  assert(unauthRes.status === 401, 'Unauthenticated request to /api/admin/overview returns HTTP 401');

  // =========================================================================
  // PART 3: Administrator Authentication & Overview Dashboard API
  // =========================================================================
  console.log('\n--- Part 3: Administrator Authentication & Overview Dashboard ---');

  const adminLoginRes = await fetchJson(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: adminEmail, password: adminPassword },
  });
  assert(adminLoginRes.status === 200, 'Admin login returns HTTP 200');
  assert(adminLoginRes.data.data.user.role === 'admin', 'Admin user role is admin');
  adminToken = adminLoginRes.data.data.token;
  assert(!!adminToken, 'Admin JWT received');

  const adminOverview = await fetchJson(`${BACKEND_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminOverview.status === 200, 'Admin /api/admin/overview returns HTTP 200');
  assert(typeof adminOverview.data.data.total_customers === 'number', 'Overview contains total_customers');
  assert(typeof adminOverview.data.data.total_retailers === 'number', 'Overview contains total_retailers');
  assert(adminOverview.data.data.total_products === 36, 'Overview reports exactly 36 active products');
  assert(Array.isArray(adminOverview.data.data.city_inventory), 'Overview contains city_inventory array');
  assert(adminOverview.data.data.city_inventory.length === 5, 'Overview city_inventory covers all 5 cities');
  assert(Array.isArray(adminOverview.data.data.recent_orders), 'Overview contains recent_orders array');

  // =========================================================================
  // PART 4: Retailer Provisioning & Initial State Verification
  // =========================================================================
  console.log('\n--- Part 4: Retailer Provisioning via Admin API ---');

  const createRetailerRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: {
      name: 'Bengaluru Core Store Partner',
      email: retailerEmail,
      password: retailerPassword,
      assignedCity: 'Bengaluru',
      approvalStatus: 'APPROVED',
    },
  });

  assert(createRetailerRes.status === 201, 'Admin creates retailer with HTTP 201');
  assert(createRetailerRes.data.data.role === 'retailer', 'Created user has role: retailer');
  assert(createRetailerRes.data.data.assigned_city === 'Bengaluru', 'Retailer assigned to Bengaluru hub');
  assert(createRetailerRes.data.data.approval_status === 'APPROVED', 'Retailer approval status is APPROVED');
  retailerId = createRetailerRes.data.data.id;
  assert(!!retailerId, 'Retailer ID generated');

  // List retailers
  const listRetailersRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(listRetailersRes.status === 200, 'Admin can list all retailers');
  const foundRetailer = listRetailersRes.data.data.find((r) => r.id === retailerId);
  assert(!!foundRetailer, 'Newly created retailer is listed in admin retailers view');
  assert(foundRetailer.assigned_city === 'Bengaluru', 'Retailer assigned city preserved in list view');

  // =========================================================================
  // PART 5: Retailer Authentication & City Warehouse Inventory Access
  // =========================================================================
  console.log('\n--- Part 5: Retailer Authentication & City Warehouse Inventory ---');

  const retailerLoginRes = await fetchJson(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: retailerEmail, password: retailerPassword },
  });
  assert(retailerLoginRes.status === 200, 'Retailer login returns HTTP 200');
  assert(retailerLoginRes.data.data.user.role === 'retailer', 'Retailer user role is retailer');
  assert(retailerLoginRes.data.data.user.assigned_city === 'Bengaluru', 'Retailer assigned city attached in login');
  retailerToken = retailerLoginRes.data.data.token;
  assert(!!retailerToken, 'Retailer JWT received');

  const retDashRes = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(retDashRes.status === 200, 'Retailer /api/retailer/dashboard returns HTTP 200');
  assert(retDashRes.data.data.retailer.assigned_city === 'Bengaluru', 'Retailer assigned city is Bengaluru');
  assert(retDashRes.data.data.metrics.total_products === 36, 'Retailer dashboard contains 36 products in catalog');
  assert(retDashRes.data.data.metrics.total_units > 0, 'Retailer dashboard calculates total warehouse units');
  assert(Array.isArray(retDashRes.data.data.inventory), 'Retailer dashboard contains inventory list');
  assert(retDashRes.data.data.inventory.length === 36, 'Inventory list contains all 36 active products');
  assert(
    typeof retDashRes.data.data.inventory[0].city_stock === 'number',
    'Inventory items contain city_stock number'
  );

  // =========================================================================
  // PART 6: Retailer Security Boundaries (Cannot access admin routes)
  // =========================================================================
  console.log('\n--- Part 6: Retailer Security Boundaries ---');

  const retAdminOverview = await fetchJson(`${BACKEND_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(retAdminOverview.status === 403, 'Retailer blocked from /api/admin/overview with HTTP 403');

  const retAdminRetailers = await fetchJson(`${BACKEND_URL}/api/admin/retailers`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(retAdminRetailers.status === 403, 'Retailer blocked from /api/admin/retailers with HTTP 403');

  // =========================================================================
  // PART 7: Admin Dynamic Approval & Suspension Enforcement
  // =========================================================================
  console.log('\n--- Part 7: Admin Dynamic Approval & Suspension Enforcement ---');

  // 1. Admin suspends retailer
  const suspendRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers/${retailerId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: { approvalStatus: 'SUSPENDED' },
  });
  assert(suspendRes.status === 200, 'Admin sets retailer status to SUSPENDED');
  assert(suspendRes.data.data.approval_status === 'SUSPENDED', 'Approval status updated to SUSPENDED');

  // 2. Retailer attempts access -> should be blocked immediately (dynamic DB check)
  const suspendedAccess = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(suspendedAccess.status === 403, 'Suspended retailer immediately denied access with HTTP 403');
  assert(
    suspendedAccess.data.message.includes('SUSPENDED'),
    'Error message states retailer account is SUSPENDED'
  );

  // 3. Admin re-approves retailer
  const approveRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers/${retailerId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: { approvalStatus: 'APPROVED' },
  });
  assert(approveRes.status === 200, 'Admin restores retailer status to APPROVED');

  // 4. Retailer access restored
  const restoredAccess = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(restoredAccess.status === 200, 'Approved retailer access restored to HTTP 200');

  // =========================================================================
  // PART 8: Admin Regional City Hub Reassignment
  // =========================================================================
  console.log('\n--- Part 8: Admin Regional City Hub Reassignment ---');

  const reassignRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers/${retailerId}/city`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: { assignedCity: 'Hyderabad' },
  });
  assert(reassignRes.status === 200, 'Admin reassigns retailer to Hyderabad');
  assert(reassignRes.data.data.assigned_city === 'Hyderabad', 'Retailer assigned city updated to Hyderabad');

  // Retailer dashboard now reflects Hyderabad hub
  const hyderabadDash = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(hyderabadDash.status === 200, 'Retailer dashboard accessible after hub reassignment');
  assert(
    hyderabadDash.data.data.retailer.assigned_city === 'Hyderabad',
    'Retailer dashboard now delivers Hyderabad hub inventory'
  );

  // Reset back to Bengaluru
  await fetchJson(`${BACKEND_URL}/api/admin/retailers/${retailerId}/city`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: { assignedCity: 'Bengaluru' },
  });

  // =========================================================================
  // PART 9: Admin Account Deactivation & Reactivation
  // =========================================================================
  console.log('\n--- Part 9: Admin Account Deactivation & Reactivation ---');

  const deactRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers/${retailerId}/active`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: { isActive: false },
  });
  assert(deactRes.status === 200, 'Admin deactivates retailer account');
  assert(deactRes.data.data.is_active === false, 'User is_active is false');

  // Deactivated user API access blocked
  const deactAccess = await fetchJson(`${BACKEND_URL}/api/retailer/dashboard`, {
    headers: { Authorization: `Bearer ${retailerToken}` },
  });
  assert(deactAccess.status === 403, 'Deactivated user blocked from API with HTTP 403');

  // Deactivated user login blocked
  const deactLogin = await fetchJson(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: retailerEmail, password: retailerPassword },
  });
  assert(deactLogin.status === 403, 'Deactivated user login blocked with HTTP 403');
  assert(
    deactLogin.data.message.includes('deactivated'),
    'Deactivation message indicates account deactivated'
  );

  // Reactivate user
  const reactRes = await fetchJson(`${BACKEND_URL}/api/admin/retailers/${retailerId}/active`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: { isActive: true },
  });
  assert(reactRes.status === 200, 'Admin reactivates retailer account');
  assert(reactRes.data.data.is_active === true, 'User is_active restored to true');

  // =========================================================================
  // PART 10: Backward Compatibility: Customer Shopping Cart & Atomic Checkout
  // =========================================================================
  console.log('\n--- Part 10: Customer Shopping Cart & Atomic Checkout Integrity ---');

  // 1. Get products list
  const prodRes = await fetchJson(`${BACKEND_URL}/api/products?limit=1&city=Bengaluru`);
  assert(prodRes.status === 200, 'Product catalog returns HTTP 200');
  const testProduct = prodRes.data.data[0];
  assert(!!testProduct, 'Test product available');

  // 2. Customer adds item to cart
  const cartAddRes = await fetchJson(`${BACKEND_URL}/api/cart/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'Content-Type': 'application/json',
    },
    body: { productId: testProduct.id, quantity: 1 },
  });
  assert(cartAddRes.status === 201, 'Customer successfully adds item to cart');

  // 3. Customer atomic checkout
  const checkoutRes = await fetchJson(`${BACKEND_URL}/api/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'Content-Type': 'application/json',
    },
    body: {
      city: 'Bengaluru',
      idempotencyKey: `sprint9f_checkout_${timestamp}`,
    },
  });
  assert(checkoutRes.status === 201, 'Customer atomic checkout returns HTTP 201');
  assert(checkoutRes.data.data.status === 'CONFIRMED', 'Order status is CONFIRMED');
  assert(checkoutRes.data.data.city === 'Bengaluru', 'Order city is Bengaluru');

  // 4. Customer order history
  const ordersRes = await fetchJson(`${BACKEND_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(ordersRes.status === 200, 'Customer order history returns HTTP 200');
  const ordersList = Array.isArray(ordersRes.data.data)
    ? ordersRes.data.data
    : ordersRes.data.data?.orders || [];
  assert(ordersList.length >= 1, 'Customer orders list contains newly placed order');

  // =========================================================================
  // PART 11: Database Schema & Row Integrity
  // =========================================================================
  console.log('\n--- Part 11: Database Schema & Row Integrity ---');

  const { default: pool } = await import('../backend/src/config/database.js');

  const productCountRes = await pool.query('SELECT COUNT(*)::int as count FROM products WHERE is_active = true');
  assert(productCountRes.rows[0].count === 36, 'PostgreSQL maintains exactly 36 active products');

  const invCountRes = await pool.query('SELECT COUNT(*)::int as count FROM inventory');
  assert(invCountRes.rows[0].count === 180, 'PostgreSQL maintains exactly 180 city inventory records');

  const negStockRes = await pool.query('SELECT COUNT(*)::int as count FROM inventory WHERE quantity < 0');
  assert(negStockRes.rows[0].count === 0, 'PostgreSQL contains 0 negative stock records');

  const retailerProfileCheck = await pool.query(
    'SELECT COUNT(*)::int as count FROM retailer_profiles WHERE user_id = $1',
    [retailerId]
  );
  assert(retailerProfileCheck.rows[0].count === 1, 'Retailer profile record correctly linked to user');

  await pool.end();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`   SPRINT 9F RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSprint9FTests().catch((err) => {
  console.error('Sprint 9F test execution error:', err);
  process.exit(1);
});
