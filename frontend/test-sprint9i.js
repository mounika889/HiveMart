/**
 * HiveMart Sprint 9I: Monthly Essentials & Smart Reminders Frontend Integration Test Suite
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
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (payloadStr) {
      req.write(payloadStr);
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('=== HIVEMART SPRINT 9I: MONTHLY ESSENTIALS INTEGRATION TESTS ===');
  console.log('================================================================\n');

  let cust1Token = null;
  let cust2Token = null;
  let retailerToken = null;
  let testCust1Id = null;
  let testCust2Id = null;
  let testListId = null;
  let productA = null;
  let productB = null;

  try {
    // Step 0: Ensure backend is running
    const health = await fetchJson(`${BACKEND_URL}/api/health`);
    assert(health.status === 200, 'Backend is healthy on http://127.0.0.1:5000');

    // Fetch active catalog products
    const prodsRes = await fetchJson(`${BACKEND_URL}/api/products?city=Bengaluru&limit=5`);
    const prods = Array.isArray(prodsRes.data.data) ? prodsRes.data.data : (prodsRes.data.data?.products || []);
    assert(prodsRes.status === 200 && prods.length >= 2, 'Retrieved catalog products for testing');
    productA = prods[0];
    productB = prods[1];

    // Step 1: Register Customer 1
    const ts = Date.now();
    const cust1Email = `ess_cust1_${ts}@hivemart.test`;
    const regCust1 = await fetchJson(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Essentials Customer 1',
        email: cust1Email,
        password: 'Password123!',
      },
    });
    assert(regCust1.status === 201, 'Customer 1 registered successfully (HTTP 201)');
    cust1Token = regCust1.data.data.token;
    testCust1Id = regCust1.data.data.user.id;

    // Register Customer 2 (for ownership tests)
    const cust2Email = `ess_cust2_${ts}@hivemart.test`;
    const regCust2 = await fetchJson(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Essentials Customer 2',
        email: cust2Email,
        password: 'Password123!',
      },
    });
    assert(regCust2.status === 201, 'Customer 2 registered successfully');
    cust2Token = regCust2.data.data.token;
    testCust2Id = regCust2.data.data.user.id;

    // Step 2: Unauthenticated access guard
    const unauthRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials`);
    assert(unauthRes.status === 401, 'Unauthenticated request to monthly essentials rejected (HTTP 401)');

    // Step 3: Create Monthly Essentials List
    const createListRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: {
        name: 'Household Recurring Essentials',
        shopping_day: 28,
        reminder_days_before: 3,
      },
    });
    assert(createListRes.status === 201, 'Monthly essentials list created with HTTP 201');
    assert(createListRes.data.data.name === 'Household Recurring Essentials', 'List name saved correctly');
    assert(createListRes.data.data.shopping_day === 28, 'Shopping day is 28');
    assert(createListRes.data.data.reminder_days_before === 3, 'Reminder days before is 3');
    testListId = createListRes.data.data.id;

    // Step 4: Get Customer's Lists
    const getListsRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials`, {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(getListsRes.status === 200, 'Customer retrieved monthly lists (HTTP 200)');
    assert(getListsRes.data.data.length >= 1, 'Customer has at least 1 list returned');
    assert(getListsRes.data.data[0].next_shopping_date !== undefined, 'Next shopping date computed for Asia/Kolkata');

    // Step 5: Add Items to List
    const addItem1 = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: {
        productId: productA.id,
        quantity: 2,
      },
    });
    assert(addItem1.status === 201, `Added product "${productA.name}" (qty: 2) to list (HTTP 201)`);
    const item1Id = addItem1.data.data.id;

    const addItem2 = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: {
        productId: productB.id,
        quantity: 3,
      },
    });
    assert(addItem2.status === 201, `Added product "${productB.name}" (qty: 3) to list`);

    // Step 6: Fetch List Details with City Stock
    const getDetailRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(getDetailRes.status === 200, 'Retrieved list details with Bengaluru city stock');
    assert(getDetailRes.data.data.items.length === 2, 'List details contain 2 items');
    assert(parseFloat(getDetailRes.data.data.total_amount) > 0, `Total estimated monthly amount computed: ₹${getDetailRes.data.data.total_amount}`);

    // Step 7: Update Item Quantity
    const updateQtyRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/items/${item1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: { quantity: 4 },
    });
    assert(updateQtyRes.status === 200, 'Updated item quantity to 4 (HTTP 200)');
    assert(updateQtyRes.data.data.quantity === 4, 'Updated quantity reflected in response');

    // Step 8: Update List Settings (Shopping Day & Reminder Window)
    const updateListRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: {
        name: 'Custom Staples Basket',
        shopping_day: 15,
        reminder_days_before: 4,
      },
    });
    assert(updateListRes.status === 200, 'Updated list schedule settings (HTTP 200)');
    assert(updateListRes.data.data.shopping_day === 15, 'Shopping day updated to 15');
    assert(updateListRes.data.data.reminder_days_before === 4, 'Reminder days updated to 4');

    // Step 9: Toggle Pause / Resume
    const pauseRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: { is_active: false },
    });
    assert(pauseRes.status === 200 && pauseRes.data.data.is_active === false, 'Paused list successfully (HTTP 200)');

    const resumeRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: { is_active: true },
    });
    assert(resumeRes.status === 200 && resumeRes.data.data.is_active === true, 'Resumed list successfully (HTTP 200)');

    // Step 10: Strict Ownership / IDOR Protection
    const c2Access = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}`, {
      headers: { Authorization: `Bearer ${cust2Token}` },
    });
    assert(c2Access.status === 403, 'Cross-customer access rejected with HTTP 403 Forbidden');

    // Step 11: Add All to Cart API
    const addToCartRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/add-to-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: { city: 'Bengaluru' },
    });
    assert(addToCartRes.status === 200, 'Add All to Cart succeeded with HTTP 200');
    assert(addToCartRes.data.status === 'success', 'Cart response status is success');
    assert(addToCartRes.data.summary.added_count >= 1, `Items added/merged into cart: ${addToCartRes.data.summary.added_count}`);

    // Verify cart contains the items with live catalog price
    const cartRes = await fetchJson(`${BACKEND_URL}/api/cart?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(cartRes.status === 200, 'Customer cart retrieved successfully');
    const inCartProdA = cartRes.data.data.items.find((i) => i.product_id === productA.id);
    assert(inCartProdA !== undefined, 'Product A is verified in cart');
    assert(parseFloat(inCartProdA.unit_price) === parseFloat(productA.price), `Catalog price matched: ₹${inCartProdA.unit_price}`);

    // Step 12: Delete Item and List Cleanup
    const deleteItemRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}/items/${item1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(deleteItemRes.status === 200, 'Item removed from monthly essentials list');

    const deleteListRes = await fetchJson(`${BACKEND_URL}/api/customer/monthly-essentials/${testListId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(deleteListRes.status === 200, 'Monthly essentials list deleted successfully');

  } catch (err) {
    console.error('[TEST SUITE ERROR]', err);
    failedTests++;
  }

  console.log('\n================================================================');
  console.log(`=== SPRINT 9I INTEGRATION TEST COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED ===`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run();
