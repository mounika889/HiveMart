import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/database.js';
import config from '../config/index.js';
import * as essentialsService from '../services/monthly-essentials.service.js';
import { generateCycleReminders } from '../services/monthly-essentials.service.js';

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

const runSprint9ITests = async () => {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9I: MONTHLY ESSENTIALS & SMART REMINDERS ===');
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
  const cleanupUserIds = [];
  const cleanupListIds = [];

  try {
    // Setup 1: Fetch active products from catalog
    const { rows: prods } = await pool.query(
      'SELECT id, name, price FROM products WHERE is_active = true ORDER BY name ASC LIMIT 5'
    );
    assert(prods.length >= 3, `Available active products for testing: ${prods.length}`);
    const productA = prods[0];
    const productB = prods[1];
    const productC = prods[2];

    // Setup 2: Create test users
    // Customer 1
    const cust1Res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer') RETURNING id`,
      [`Test Cust1 ${timestamp}`, `cust1_${timestamp}@hivemart.test`, 'hash123']
    );
    const cust1Id = cust1Res.rows[0].id;
    cleanupUserIds.push(cust1Id);
    const cust1Token = jwt.sign({ id: cust1Id, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' });

    // Customer 2
    const cust2Res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer') RETURNING id`,
      [`Test Cust2 ${timestamp}`, `cust2_${timestamp}@hivemart.test`, 'hash123']
    );
    const cust2Id = cust2Res.rows[0].id;
    cleanupUserIds.push(cust2Id);
    const cust2Token = jwt.sign({ id: cust2Id, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' });

    // Retailer
    const retRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'retailer') RETURNING id`,
      [`Test Retailer ${timestamp}`, `ret_${timestamp}@hivemart.test`, 'hash123']
    );
    const retId = retRes.rows[0].id;
    cleanupUserIds.push(retId);
    await pool.query(
      `INSERT INTO retailer_profiles (user_id, assigned_city, approval_status)
       VALUES ($1, 'Bengaluru', 'APPROVED')`,
      [retId]
    );
    const retToken = jwt.sign({ id: retId, role: 'retailer' }, config.jwt.secret, { expiresIn: '1h' });

    // Admin
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin') RETURNING id`,
      [`Test Admin ${timestamp}`, `admin_${timestamp}@hivemart.test`, 'hash123']
    );
    const adminId = adminRes.rows[0].id;
    cleanupUserIds.push(adminId);
    const adminToken = jwt.sign({ id: adminId, role: 'admin' }, config.jwt.secret, { expiresIn: '1h' });

    console.log('\n--- AREA 1: Customer Creates Monthly Essentials List ---');
    const createRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({
        name: 'Pantry Recurring Staples',
        shopping_day: 28,
        reminder_days_before: 3,
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, `List created successfully with status 201 (got ${createRes.status})`);
    assert(createData.data && createData.data.name === 'Pantry Recurring Staples', 'List name is accurate');
    assert(createData.data.shopping_day === 28, 'Shopping day set to 28');
    assert(createData.data.reminder_days_before === 3, 'Reminder days before set to 3');
    assert(createData.data.is_active === true, 'List is initially active');

    const list1Id = createData.data.id;
    cleanupListIds.push(list1Id);

    console.log('\n--- AREA 2: Add, Edit, and Remove Items ---');
    // Add Item A
    const addItemARes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        quantity: 2,
      }),
    });
    const addItemAData = await addItemARes.json();
    assert(addItemARes.status === 201, `Added Item A with status 201`);
    assert(addItemAData.data.product_id === productA.id, 'Item A product_id matches');
    assert(addItemAData.data.quantity === 2, 'Item A quantity is 2');
    const itemAId = addItemAData.data.id;

    // Add Item B
    const addItemBRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({
        productId: productB.id,
        quantity: 4,
      }),
    });
    const addItemBData = await addItemBRes.json();
    assert(addItemBRes.status === 201, `Added Item B with status 201`);
    const itemBId = addItemBData.data.id;

    // Edit Item A quantity from 2 to 5
    const editItemARes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/items/${itemAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({ quantity: 5 }),
    });
    const editItemAData = await editItemARes.json();
    assert(editItemARes.status === 200, `Updated Item A quantity to 5 (status 200)`);
    assert(editItemAData.data.quantity === 5, 'Item A updated quantity is 5');

    // Remove Item B
    const removeItemBRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/items/${itemBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(removeItemBRes.status === 200, `Removed Item B with status 200`);

    // Verify list contents
    const getListRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    const getListData = await getListRes.json();
    assert(getListData.data.items.length === 1, `List now contains exactly 1 item (Item A)`);
    assert(getListData.data.items[0].product_id === productA.id, 'Item in list is Product A');

    console.log('\n--- AREA 3: Change Monthly Shopping Date & Settings ---');
    const updateDateRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({
        name: 'Updated Staples Basket',
        shopping_day: 15,
        reminder_days_before: 5,
      }),
    });
    const updateDateData = await updateDateRes.json();
    assert(updateDateRes.status === 200, `Updated list settings with status 200`);
    assert(updateDateData.data.shopping_day === 15, 'Shopping day updated to 15');
    assert(updateDateData.data.reminder_days_before === 5, 'Reminder days updated to 5');
    assert(updateDateData.data.name === 'Updated Staples Basket', 'Name updated');

    console.log('\n--- AREA 4: Pause and Resume List ---');
    // Pause
    const pauseRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({ is_active: false }),
    });
    const pauseData = await pauseRes.json();
    assert(pauseRes.status === 200, 'Paused list successfully (status 200)');
    assert(pauseData.data.is_active === false, 'List is_active is false');

    // Resume
    const resumeRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({ is_active: true }),
    });
    const resumeData = await resumeRes.json();
    assert(resumeRes.status === 200, 'Resumed list successfully (status 200)');
    assert(resumeData.data.is_active === true, 'List is_active is true');

    console.log('\n--- AREA 5: Customer Ownership Protection & IDOR Prevention ---');
    // Customer 2 tries to GET Customer 1's list -> 403 Forbidden
    const c2GetRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}`, {
      headers: { Authorization: `Bearer ${cust2Token}` },
    });
    assert(c2GetRes.status === 403, `Customer 2 GET Customer 1 list rejected with 403 Forbidden (got ${c2GetRes.status})`);

    // Customer 2 tries to UPDATE Customer 1's list -> 403 Forbidden
    const c2UpdateRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust2Token}`,
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert(c2UpdateRes.status === 403, `Customer 2 PUT Customer 1 list rejected with 403 Forbidden`);

    // Customer 2 tries to ADD ITEM to Customer 1's list -> 403 Forbidden
    const c2AddRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust2Token}`,
      },
      body: JSON.stringify({ productId: productC.id, quantity: 1 }),
    });
    assert(c2AddRes.status === 403, `Customer 2 POST item to Customer 1 list rejected with 403 Forbidden`);

    // Customer 2 tries to DELETE Customer 1's list -> 403 Forbidden
    const c2DelRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust2Token}` },
    });
    assert(c2DelRes.status === 403, `Customer 2 DELETE Customer 1 list rejected with 403 Forbidden`);

    console.log('\n--- AREA 6 & 7: Reminder Generation & Deduplication Engine ---');
    // Set list1 shopping day to 25 with 5 days before, and simulate today as 2026-11-22 (in window: 2026-11-20 to 2026-11-25)
    await pool.query(
      'UPDATE monthly_essentials SET shopping_day = 25, reminder_days_before = 5, is_active = true WHERE id = $1',
      [list1Id]
    );

    // Run reminder engine with simulated date '2026-11-22'
    const reminderRun1 = await generateCycleReminders('2026-11-22');
    assert(reminderRun1.status === 'success', `Reminder engine executed successfully`);
    assert(reminderRun1.generated_count >= 1, `Generated at least 1 reminder for Customer 1 (got ${reminderRun1.generated_count})`);

    // Fetch reminder from API
    const remindersRes = await fetch(`${baseUrl}/customer/monthly-essentials/reminders`, {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    const remindersData = await remindersRes.json();
    assert(remindersRes.status === 200, 'Customer retrieved reminders');
    assert(remindersData.data.length >= 1, `Customer has due reminder in list`);
    const reminderId = remindersData.data[0].reminder_id;

    // Test Deduplication: Run reminder engine again on the same day for same cycle
    const reminderRun2 = await generateCycleReminders('2026-11-22');
    assert(reminderRun2.status === 'success', 'Second run of reminder engine succeeded');
    const checkDupes = await pool.query(
      'SELECT count(*)::int as c FROM monthly_reminders WHERE list_id = $1 AND due_date = $2',
      [list1Id, '2026-11-25']
    );
    assert(checkDupes.rows[0].c === 1, `Deduplication verified: exactly 1 reminder for this cycle (got ${checkDupes.rows[0].c})`);

    // Mark reminder as read
    const readRes = await fetch(`${baseUrl}/customer/monthly-essentials/reminders/${reminderId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    const readData = await readRes.json();
    assert(readRes.status === 200, 'Reminder marked as read successfully');
    assert(readData.data.status === 'READ', 'Reminder status updated to READ');

    console.log('\n--- AREA 8: Month-End and Leap-Year Date Calculations ---');
    // Test clamping day 31 in shorter months
    const novTarget = essentialsService.calculateNextShoppingDate(31, '2026-11-01');
    assert(novTarget.targetDateStr === '2026-11-30', `Day 31 clamped to Nov 30 in November (got ${novTarget.targetDateStr})`);

    // Test leap year: February 2024 has 29 days
    const febLeapTarget = essentialsService.calculateNextShoppingDate(31, '2024-02-01');
    assert(febLeapTarget.targetDateStr === '2024-02-29', `Day 31 clamped to Feb 29 in leap year 2024 (got ${febLeapTarget.targetDateStr})`);

    // Test non-leap year: February 2025 has 28 days
    const febNonLeapTarget = essentialsService.calculateNextShoppingDate(31, '2025-02-01');
    assert(febNonLeapTarget.targetDateStr === '2025-02-28', `Day 31 clamped to Feb 28 in non-leap year 2025 (got ${febNonLeapTarget.targetDateStr})`);

    console.log('\n--- AREA 9: Worker Restart & Recovery ---');
    // Simulate multiple concurrent / restarted worker calls
    const [w1, w2] = await Promise.all([
      generateCycleReminders('2026-11-22'),
      generateCycleReminders('2026-11-22'),
    ]);
    assert(w1.status === 'success' || w1.skipped, 'Worker 1 finished cleanly');
    assert(w2.status === 'success' || w2.skipped, 'Worker 2 cleanly handled lock or finished');

    console.log('\n--- AREA 10, 11, 12, 13, 14: Add All to Cart & Cart Integration ---');
    // Set up list1 with 2 items: Product A (qty: 3) and Product C (qty: 2)
    await pool.query('DELETE FROM monthly_essential_items WHERE list_id = $1', [list1Id]);
    await essentialsService.addItemToList(cust1Id, list1Id, { productId: productA.id, quantity: 3 });
    await essentialsService.addItemToList(cust1Id, list1Id, { productId: productC.id, quantity: 2 });

    // Pre-populate cart with 1 unit of Product A to test existing cart preservation
    const user1CartRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({ productId: productA.id, quantity: 1, city: 'Bengaluru' }),
    });
    assert(user1CartRes.status === 201 || user1CartRes.status === 200, 'Pre-existing item added to customer cart');

    // Execute Add All to Cart
    const addCartRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/add-to-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({ city: 'Bengaluru' }),
    });
    const addCartData = await addCartRes.json();
    assert(addCartRes.status === 200, `Add All to Cart succeeded with status 200`);
    assert(addCartData.status === 'success', 'Cart response status is success');
    assert(addCartData.summary.added_count >= 1, `Items added/merged into cart: ${addCartData.summary.added_count}`);

    // Verify current price was used
    const prodAInCart = addCartData.cart.items.find((i) => i.product_id === productA.id);
    assert(prodAInCart !== undefined, 'Product A is in customer cart');
    assert(parseFloat(prodAInCart.unit_price) === parseFloat(productA.price), `Live catalog price used: ₹${prodAInCart.unit_price}`);

    // Verify existing cart was preserved and merged: 1 pre-existing + 3 essentials = 4 in cart
    assert(prodAInCart.quantity === 4, `Quantities merged without overwriting: 1 existing + 3 essentials = 4 (got ${prodAInCart.quantity})`);

    // Double-click / retry protection: Calling again does not fail
    const retryAddCartRes = await fetch(`${baseUrl}/customer/monthly-essentials/${list1Id}/add-to-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({ city: 'Bengaluru' }),
    });
    assert(retryAddCartRes.status === 200, 'Retry Add All to Cart succeeded gracefully');

    console.log('\n--- AREA 15: Existing Customer Checkout Regression ---');
    // Verify that atomic checkout still works as expected for this cart
    const checkoutKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const checkoutRes = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`,
      },
      body: JSON.stringify({
        city: 'Bengaluru',
        idempotencyKey: checkoutKey,
      }),
    });
    const checkoutData = await checkoutRes.json();
    assert(checkoutRes.status === 201 || checkoutRes.status === 200, `Customer completed atomic checkout with status ${checkoutRes.status}`);
    assert(checkoutData.data && (checkoutData.data.id || checkoutData.data.order_id), 'Order created with valid order ID');

    console.log('\n--- AREA 16: Admin / Retailer Access Restrictions ---');
    // Retailer trying to access customer monthly essentials -> 403 Forbidden
    const retAccessRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(retAccessRes.status === 403, `Retailer access to customer monthly essentials rejected with 403 (got ${retAccessRes.status})`);

    // Admin trying to access customer monthly essentials -> 403 Forbidden
    const adminAccessRes = await fetch(`${baseUrl}/customer/monthly-essentials`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAccessRes.status === 403, `Admin access to customer monthly essentials rejected with 403 (got ${adminAccessRes.status})`);

    console.log('\n--- AREA 17: Original Catalog & Inventory Preservation ---');
    const { rows: prodsCount } = await pool.query('SELECT count(*)::int as c FROM products WHERE is_active = true');
    const { rows: invCount } = await pool.query('SELECT count(*)::int as c, min(quantity)::int as min_qty FROM inventory');
    assert(prodsCount[0].c === 36, `Active catalog products preserved: 36 (got ${prodsCount[0].c})`);
    assert(invCount[0].c === 180, `City warehouse inventory records preserved: 180 (got ${invCount[0].c})`);
    assert(invCount[0].min_qty >= 0, `Minimum inventory quantity is non-negative: ${invCount[0].min_qty}`);

  } finally {
    // Teardown: Clean up isolated test users, lists, and temporary fixtures
    console.log('\n--- TEARDOWN: Cleaning up test fixtures ---');
    for (const listId of cleanupListIds) {
      await pool.query('DELETE FROM monthly_essentials WHERE id = $1', [listId]).catch(() => {});
    }
    for (const userId of cleanupUserIds) {
      await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [userId]).catch(() => {});
      await pool.query('DELETE FROM carts WHERE user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]).catch(() => {});
      await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM notifications WHERE recipient_user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM retailer_profiles WHERE user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
    }

    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  console.log('\n================================================================');
  console.log(`=== SPRINT 9I TEST COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

(async () => {
  try {
    await setupServer();
    await runSprint9ITests();
  } catch (err) {
    console.error('[FATAL] Sprint 9I test suite failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
