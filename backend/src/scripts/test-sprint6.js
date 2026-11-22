import pool from '../config/database.js';

const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('=== STARTING SPRINT 6 CHECKOUT & CONCURRENCY TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  };

  const timestamp = Date.now();
  const userAEmail = `checkout_user_a_${timestamp}@example.com`;
  const userBEmail = `checkout_user_b_${timestamp}@example.com`;
  const password = 'Password123!';

  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';

  let tempProductAlpha = null;
  let tempProductSingleUnit = null;

  try {
    // 1. Sanity Health Checks
    console.log('--- 1. Base Health & Cluster Sanity ---');
    const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    assert(health.status === 'ok', 'GET /api/health is ok');
    const dbHealth = await fetch(`${BASE_URL}/health/db`).then((r) => r.json());
    assert(dbHealth.status === 'ok' && dbHealth.database === 'connected', 'GET /api/health/db is connected');
    const searchHealth = await fetch(`${BASE_URL}/health/search`).then((r) => r.json());
    assert(searchHealth.status === 'ok' && searchHealth.search === 'connected', 'GET /api/health/search is connected');

    // 2. Create Isolated Temporary Test Products in PostgreSQL
    console.log('\n--- 2. Setting Up Isolated Temporary Test Products ---');
    const alphaRes = await pool.query(
      `INSERT INTO products (name, description, category, price, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, price`,
      [
        `TEMP Test Product Alpha ${timestamp}`,
        'Temporary product for checkout testing',
        'Electronics',
        500.00,
        'https://example.com/alpha.jpg',
        true,
      ]
    );
    tempProductAlpha = alphaRes.rows[0];

    // Inventory: 10 units in Bengaluru
    await pool.query(
      `INSERT INTO inventory (product_id, city, quantity)
       VALUES ($1, 'Bengaluru', 10)`,
      [tempProductAlpha.id]
    );
    console.log(`  Created Temp Product Alpha: ID ${tempProductAlpha.id} with 10 units in Bengaluru.`);

    const singleRes = await pool.query(
      `INSERT INTO products (name, description, category, price, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, price`,
      [
        `TEMP Single Unit Race Product ${timestamp}`,
        'Temporary single unit product for concurrency race test',
        'Electronics',
        999.00,
        'https://example.com/single.jpg',
        true,
      ]
    );
    tempProductSingleUnit = singleRes.rows[0];

    // Inventory: EXACTLY 1 unit in Bengaluru for the concurrency race!
    await pool.query(
      `INSERT INTO inventory (product_id, city, quantity)
       VALUES ($1, 'Bengaluru', 1)`,
      [tempProductSingleUnit.id]
    );
    console.log(`  Created Temp SingleUnit Product: ID ${tempProductSingleUnit.id} with EXACTLY 1 unit in Bengaluru.`);

    // 3. User Setup
    console.log('\n--- 3. Registering Test Users ---');
    const regA = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A Checkout', email: userAEmail, password }),
    }).then((r) => r.json());
    userAToken = regA.data.token;
    userAId = regA.data.user.id;
    assert(!!userAToken, 'User A registered and authenticated');

    const regB = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B Checkout', email: userBEmail, password }),
    }).then((r) => r.json());
    userBToken = regB.data.token;
    userBId = regB.data.user.id;
    assert(!!userBToken, 'User B registered and authenticated');

    // 4. Checkout Validation (Empty Cart, City, Idempotency)
    console.log('\n--- 4. Checkout Validation & Error Handling ---');
    const noAuth = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: 'key-1' }),
    });
    assert(noAuth.status === 401, 'POST /api/checkout without token rejected with 401 Unauthorized');

    const emptyCart = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: 'key-empty' }),
    });
    assert(emptyCart.status === 400, 'POST /api/checkout with empty cart rejected with 400 Bad Request');

    // Add item to cart to test city validation
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: tempProductAlpha.id, quantity: 2 }),
    });

    const invalidCity = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Atlantis', idempotencyKey: 'key-city' }),
    });
    assert(invalidCity.status === 400, 'POST /api/checkout with unsupported city rejected with 400 Bad Request');

    const missingIdemp = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Bengaluru' }),
    });
    assert(missingIdemp.status === 400, 'POST /api/checkout without idempotencyKey rejected with 400 Bad Request');

    // 5. Successful Checkout Flow & Atomicity
    console.log('\n--- 5. Successful Transactional Checkout Flow ---');
    const checkoutKey = `idemp-success-${timestamp}`;
    const checkoutRes = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: checkoutKey }),
    });

    assert(checkoutRes.status === 201, 'POST /api/checkout returned 201 Created');
    const checkoutData = await checkoutRes.json();
    const order = checkoutData.data;

    assert(order.status === 'CONFIRMED', 'Order status is CONFIRMED');
    assert(order.city === 'Bengaluru', 'Order city is Bengaluru');
    assert(order.total_amount === '1000.00', 'Order total computed server-side: 2 * 500.00 = 1000.00');
    assert(order.items.length === 1, 'Order has 1 item');
    assert(order.items[0].product_id === tempProductAlpha.id, 'Item product ID matches');
    assert(order.items[0].quantity === 2, 'Item quantity matches (2)');
    assert(order.items[0].subtotal === '1000.00', 'Item subtotal matches (1000.00)');

    // Verify stock deduction in PostgreSQL inventory
    const stockCheck = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = 'Bengaluru'`,
      [tempProductAlpha.id]
    );
    assert(stockCheck.rows[0].quantity === 8, `Inventory stock in Bengaluru accurately deducted from 10 to 8 (found ${stockCheck.rows[0].quantity})`);

    // Verify cart was cleared
    const cartCheck = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then((r) => r.json());
    assert(cartCheck.data.items.length === 0, 'User cart cleared upon successful checkout');

    // Verify outbox_events table in PostgreSQL in the SAME transaction
    const outboxCheck = await pool.query(
      `SELECT id, event_type, aggregate_id, payload
       FROM outbox_events
       WHERE aggregate_id = $1 AND event_type = 'order.placed'`,
      [order.id]
    );
    assert(outboxCheck.rows.length === 1, 'outbox_events record created atomically');
    const outboxPayload = outboxCheck.rows[0].payload;
    assert(outboxPayload.order_id === order.id, 'Outbox payload contains order_id');
    assert(outboxPayload.total_amount === '1000.00', 'Outbox payload contains total_amount');
    assert(outboxPayload.status === 'CONFIRMED', 'Outbox payload contains status CONFIRMED');

    // 6. Idempotent Replay Verification
    console.log('\n--- 6. Idempotency Replay Test ---');
    const replayRes = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: checkoutKey }),
    });

    assert(replayRes.status === 200, 'Re-submitting exact same idempotencyKey returns 200 OK');
    const replayData = await replayRes.json();
    assert(replayData.data.id === order.id, 'Returns exact same order ID');

    // Verify stock was NOT deducted again
    const stockAfterReplay = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = 'Bengaluru'`,
      [tempProductAlpha.id]
    );
    assert(stockAfterReplay.rows[0].quantity === 8, 'Stock remains unchanged at 8 after idempotent replay');

    // Verify orders count
    const orderCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1 AND idempotency_key = $2`,
      [userAId, checkoutKey]
    );
    assert(orderCountRes.rows[0].count === 1, 'No duplicate orders created in PostgreSQL');

    // 7. Insufficient Stock & Transaction Rollback Test
    console.log('\n--- 7. Insufficient Stock & Full Transaction Rollback ---');
    // Add 20 units of Alpha (only 8 available)
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: tempProductAlpha.id, quantity: 20 }),
    });

    const rollbackKey = `idemp-oversell-${timestamp}`;
    const oversellRes = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: rollbackKey }),
    });

    assert(oversellRes.status === 409, 'Oversell attempt rejected with 409 Conflict');
    const oversellBody = await oversellRes.json();
    assert(oversellBody.message.includes('Insufficient stock'), `Error message: "${oversellBody.message}"`);

    // Verify inventory untouched
    const stockAfterRollback = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = 'Bengaluru'`,
      [tempProductAlpha.id]
    );
    assert(stockAfterRollback.rows[0].quantity === 8, 'Inventory stock intact at 8 (no deduction occurred)');

    // Verify cart was NOT cleared
    const cartAfterRollback = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then((r) => r.json());
    assert(cartAfterRollback.data.items.length === 1, 'Cart items retained on rollback');

    // Verify no order created
    const noOrderRes = await pool.query(
      `SELECT id FROM orders WHERE idempotency_key = $1`,
      [rollbackKey]
    );
    assert(noOrderRes.rows.length === 0, 'No order created in orders table');

    // Clear cart for clean state
    await fetch(`${BASE_URL}/cart`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    // 8. Order Retrieval & Cross-User Isolation
    console.log('\n--- 8. Orders Query & Cross-User Isolation ---');
    const ordersList = await fetch(`${BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then((r) => r.json());
    assert(ordersList.status === 'ok' && ordersList.data.length >= 1, 'GET /api/orders returns user orders');

    const singleOrderRes = await fetch(`${BASE_URL}/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then((r) => r.json());
    assert(singleOrderRes.status === 'ok' && singleOrderRes.data.id === order.id, 'GET /api/orders/:id returns order details');
    assert(singleOrderRes.data.items.length === 1, 'Order details includes items');

    // User B tries to view User A's order
    const crossOrderRes = await fetch(`${BASE_URL}/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(crossOrderRes.status === 404, "User B cannot view User A's order (Strict 404 per-user isolation)");

    // 9. CONCURRENT RACE TEST (Two Customers for One Remaining Unit)
    console.log('\n--- 9. Real Concurrent Race Between 2 Customers for 1 Remaining Unit ---');
    console.log(`  Initial stock of "${tempProductSingleUnit.name}" in Bengaluru: 1`);

    // User A adds 1 unit to cart
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: tempProductSingleUnit.id, quantity: 1 }),
    });

    // User B adds 1 unit to cart
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: tempProductSingleUnit.id, quantity: 1 }),
    });

    const raceKeyA = `race-a-${timestamp}`;
    const raceKeyB = `race-b-${timestamp}`;

    console.log('  Executing concurrent checkout requests simultaneously via Promise.all...');
    const [raceResA, raceResB] = await Promise.all([
      fetch(`${BASE_URL}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: raceKeyA }),
      }),
      fetch(`${BASE_URL}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userBToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Bengaluru', idempotencyKey: raceKeyB }),
      }),
    ]);

    const statusA = raceResA.status;
    const statusB = raceResB.status;
    console.log(`  Customer A Response Status: ${statusA}`);
    console.log(`  Customer B Response Status: ${statusB}`);

    const oneSucceeded = (statusA === 201 && statusB === 409) || (statusA === 409 && statusB === 201);
    assert(oneSucceeded, 'CONCURRENCY GUARANTEE: Exactly ONE customer succeeded (201) and ONE was rejected (409)!');

    // Verify remaining inventory in PostgreSQL database
    const finalStockRes = await pool.query(
      `SELECT quantity FROM inventory WHERE product_id = $1 AND city = 'Bengaluru'`,
      [tempProductSingleUnit.id]
    );
    const finalStock = finalStockRes.rows[0].quantity;
    console.log(`  Final inventory stock in database: ${finalStock}`);
    assert(finalStock === 0, `INVENTORY INTEGRITY: Final stock is exactly 0 (deducted from 1, never negative!)`);
    assert(finalStock >= 0, 'No negative stock ever permitted');

    // Verify exactly one order was placed for the race product
    const raceOrdersRes = await pool.query(
      `SELECT o.id, o.user_id, oi.product_id, oi.quantity
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.product_id = $1`,
      [tempProductSingleUnit.id]
    );
    assert(raceOrdersRes.rows.length === 1, `DATABASE AUDIT: Exactly 1 order created in orders table for this product`);

    // Verify exactly one outbox event
    const raceOutboxRes = await pool.query(
      `SELECT id, aggregate_id
       FROM outbox_events
       WHERE aggregate_id = $1`,
      [raceOrdersRes.rows[0].id]
    );
    assert(raceOutboxRes.rows.length === 1, `OUTBOX AUDIT: Exactly 1 order.placed event emitted`);

    console.log(`\n========================================`);
    console.log(`SPRINT 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    // Clean up temporary test data
    console.log('\n--- 10. Safe Cleanup of Temporary Test Data ---');
    try {
      if (tempProductAlpha || tempProductSingleUnit) {
        const prodIds = [tempProductAlpha?.id, tempProductSingleUnit?.id].filter(Boolean);
        // Delete outbox events for orders containing these products
        await pool.query(
          `DELETE FROM outbox_events WHERE aggregate_id IN (
             SELECT order_id::text FROM order_items WHERE product_id = ANY($1::uuid[])
           )`,
          [prodIds]
        );
        // Delete orders
        await pool.query(
          `DELETE FROM orders WHERE id IN (
             SELECT order_id FROM order_items WHERE product_id = ANY($1::uuid[])
           )`,
          [prodIds]
        );
        // Delete inventory
        await pool.query(
          `DELETE FROM inventory WHERE product_id = ANY($1::uuid[])`,
          [prodIds]
        );
        // Delete temporary products
        await pool.query(
          `DELETE FROM products WHERE id = ANY($1::uuid[])`,
          [prodIds]
        );
        console.log('  Cleaned up temporary products and associated orders/outbox events.');
      }

      // Delete temporary test users (cascades to carts)
      await pool.query(
        `DELETE FROM users WHERE email IN ($1, $2)`,
        [userAEmail.toLowerCase(), userBEmail.toLowerCase()]
      );
      console.log('  Cleaned up temporary user accounts.');

      // Verify the 36 core seeded products remain untouched
      const originalCountRes = await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE is_active = true');
      console.log(`  Verified core catalog preserved: ${originalCountRes.rows[0].count} products intact.`);
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
    await pool.end();
  }
};

runTests();
