import pool from '../config/database.js';

const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('=== STARTING SPRINT 4 INTEGRATION TEST SUITE ===\n');
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

  const testUserAEmail = `test_user_a_${Date.now()}@example.com`;
  const testUserBEmail = `test_user_b_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';

  let sampleProduct1 = null;
  let sampleProduct2 = null;

  try {
    // 1. Health Checks & Preservation
    console.log('--- 1. Health & DB Check Preservation ---');
    const healthRes = await fetch(`${BASE_URL}/health`).then(r => r.json());
    assert(healthRes.status === 'ok' && healthRes.service === 'HiveMart API', 'GET /api/health returns 200 ok');

    const dbHealthRes = await fetch(`${BASE_URL}/health/db`).then(r => r.json());
    assert(dbHealthRes.status === 'ok' && dbHealthRes.database === 'connected', 'GET /api/health/db returns 200 connected');

    // 2. Existing Catalog Preservation
    console.log('\n--- 2. Product Catalog Preservation ---');
    const productsRes = await fetch(`${BASE_URL}/products?limit=5`).then(r => r.json());
    assert(productsRes.status === 'ok' && productsRes.pagination.total >= 30, `Products catalog preserved (Total: ${productsRes.pagination.total})`);
    sampleProduct1 = productsRes.data[0];
    sampleProduct2 = productsRes.data[1];
    console.log(`  Sample Product 1: "${sampleProduct1.name}" (Price: ${sampleProduct1.price})`);
    console.log(`  Sample Product 2: "${sampleProduct2.name}" (Price: ${sampleProduct2.price})`);

    // 3. User Registration
    console.log('\n--- 3. User Registration ---');
    // Invalid inputs
    const shortNameRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'valid@example.com', password: 'password123' }),
    });
    assert(shortNameRes.status === 400, 'Registration with short name rejected with 400');

    const invalidEmailRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name', email: 'invalid-email-format', password: 'password123' }),
    });
    assert(invalidEmailRes.status === 400, 'Registration with invalid email rejected with 400');

    const shortPassRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name', email: 'valid2@example.com', password: '123' }),
    });
    assert(shortPassRes.status === 400, 'Registration with short password rejected with 400');

    // Successful registration User A
    const regResA = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User A', email: testUserAEmail, password: testPassword }),
    });
    assert(regResA.status === 201, 'User A registered successfully with 201 Created');
    const regDataA = await regResA.json();
    assert(regDataA.data.user.role === 'customer', 'User role is strictly customer');
    assert(regDataA.data.user.password_hash === undefined, 'password_hash is NOT exposed in response');
    assert(!!regDataA.data.token, 'Signed JWT token returned');
    userAToken = regDataA.data.token;
    userAId = regDataA.data.user.id;

    // Duplicate email registration
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate User', email: testUserAEmail.toUpperCase(), password: testPassword }),
    });
    assert(dupRes.status === 409, 'Duplicate email registration rejected with 409 Conflict');

    // Successful registration User B (for cross-user isolation tests)
    const regResB = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User B', email: testUserBEmail, password: testPassword }),
    });
    assert(regResB.status === 201, 'User B registered successfully');
    const regDataB = await regResB.json();
    userBToken = regDataB.data.token;
    userBId = regDataB.data.user.id;

    // 4. User Login
    console.log('\n--- 4. User Login ---');
    const wrongPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAEmail, password: 'WrongPassword!' }),
    });
    assert(wrongPassRes.status === 401, 'Login with incorrect password returns 401 Unauthorized');

    const wrongUserRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_user@example.com', password: testPassword }),
    });
    assert(wrongUserRes.status === 401, 'Login with non-existent email returns 401 Unauthorized');

    const correctLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAEmail.toUpperCase(), password: testPassword }), // Test case-insensitivity
    });
    assert(correctLoginRes.status === 200, 'Login with normalized email and password returns 200 OK');
    const loginData = await correctLoginRes.json();
    assert(loginData.data.user.email === testUserAEmail.toLowerCase(), 'Returned normalized email');
    assert(loginData.data.user.password_hash === undefined, 'No password hash in login response');
    assert(!!loginData.data.token, 'New valid JWT token issued on login');
    userAToken = loginData.data.token;

    // 5. Protected Profile (/api/auth/me)
    console.log('\n--- 5. Protected Profile (/api/auth/me) ---');
    const noTokenRes = await fetch(`${BASE_URL}/auth/me`);
    assert(noTokenRes.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized');

    const invalidTokenRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    assert(invalidTokenRes.status === 401, 'GET /api/auth/me with invalid token returns 401 Unauthorized');

    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(meRes.status === 200, 'GET /api/auth/me with valid Bearer token returns 200 OK');
    const meData = await meRes.json();
    assert(meData.data.user.id === userAId, 'Returned profile matches authenticated User A ID');

    // 6. Persistent Cart Operations (User A)
    console.log('\n--- 6. Persistent Cart Operations ---');
    // Initial empty cart
    const emptyCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then(r => r.json());
    assert(emptyCartRes.status === 'ok' && emptyCartRes.data.items.length === 0, 'Initial cart is empty');
    assert(emptyCartRes.data.total_items === 0 && emptyCartRes.data.total_amount === '0.00', 'Initial cart totals are 0');

    // Capture stock before adding to cart
    const stockBeforeQuery = await pool.query(
      'SELECT city, quantity FROM inventory WHERE product_id = $1 ORDER BY city',
      [sampleProduct1.id]
    );
    const stockBefore = stockBeforeQuery.rows;

    // Add item with invalid inputs
    const invalidProdIdRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'invalid-uuid', quantity: 2 }),
    });
    assert(invalidProdIdRes.status === 400, 'Add to cart with invalid UUID returns 400 Bad Request');

    const nonExistentProdRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }),
    });
    assert(nonExistentProdRes.status === 404, 'Add to cart with non-existent product returns 404 Not Found');

    const negativeQtyRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: sampleProduct1.id, quantity: 0 }),
    });
    assert(negativeQtyRes.status === 400, 'Add to cart with quantity 0 returns 400 Bad Request');

    // Add valid item 1 (quantity: 2)
    const addRes1 = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: sampleProduct1.id, quantity: 2 }),
    });
    assert(addRes1.status === 201, 'Product 1 added to cart successfully with 201 Created');
    const addData1 = await addRes1.json();
    assert(addData1.data.items.length === 1, 'Cart now contains 1 product item');
    assert(addData1.data.total_items === 2, 'Cart total_items equals 2');

    const expectedSubtotal1 = (2 * parseFloat(sampleProduct1.price)).toFixed(2);
    assert(addData1.data.items[0].subtotal === expectedSubtotal1, `Subtotal calculated server-side: ${expectedSubtotal1}`);
    assert(addData1.data.total_amount === expectedSubtotal1, `Total amount equals ${expectedSubtotal1}`);

    // Verify stock in database was NOT deducted!
    const stockAfterQuery = await pool.query(
      'SELECT city, quantity FROM inventory WHERE product_id = $1 ORDER BY city',
      [sampleProduct1.id]
    );
    const stockAfter = stockAfterQuery.rows;
    let stockUnchanged = true;
    for (let i = 0; i < stockBefore.length; i++) {
      if (stockBefore[i].quantity !== stockAfter[i].quantity) stockUnchanged = false;
    }
    assert(stockUnchanged, 'Confirmed: Adding to cart did NOT deduct or mutate inventory stock');

    // Test duplicate add prevention
    const duplicateAddRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: sampleProduct1.id, quantity: 1 }),
    });
    assert(duplicateAddRes.status === 409, 'Duplicate product addition rejected with 409 Conflict');

    // Update quantity via PATCH (update qty from 2 to 5)
    const patchRes = await fetch(`${BASE_URL}/cart/items/${sampleProduct1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 5 }),
    });
    assert(patchRes.status === 200, 'PATCH /api/cart/items/:productId updated quantity to 5');
    const patchData = await patchRes.json();
    assert(patchData.data.total_items === 5, 'Cart total_items updated to 5');
    const expectedSubtotalUpdated = (5 * parseFloat(sampleProduct1.price)).toFixed(2);
    assert(patchData.data.total_amount === expectedSubtotalUpdated, `Updated total amount matches ${expectedSubtotalUpdated}`);

    // Add Product 2 (quantity: 3)
    const addRes2 = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: sampleProduct2.id, quantity: 3 }),
    });
    assert(addRes2.status === 201, 'Product 2 added to cart');
    const addData2 = await addRes2.json();
    assert(addData2.data.items.length === 2, 'Cart has 2 distinct items');
    assert(addData2.data.total_items === 8, 'Total items: 5 + 3 = 8');
    const combinedTotal = (5 * parseFloat(sampleProduct1.price) + 3 * parseFloat(sampleProduct2.price)).toFixed(2);
    assert(addData2.data.total_amount === combinedTotal, `Combined total amount equals ${combinedTotal}`);

    // City stock availability check on Cart
    const cityCartRes = await fetch(`${BASE_URL}/cart?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then(r => r.json());
    assert(cityCartRes.status === 'ok' && cityCartRes.data.city === 'Bengaluru', 'Cart returns city inventory context');
    assert(cityCartRes.data.items[0].city_stock !== undefined, 'Item includes city_stock');
    assert(typeof cityCartRes.data.items[0].is_available_in_city === 'boolean', 'Item includes is_available_in_city boolean');

    // 7. Cart Persistence Across Login
    console.log('\n--- 7. Cart Persistence Across Login ---');
    // User A logs in again, receiving a brand new token
    const reLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAEmail, password: testPassword }),
    }).then(r => r.json());
    const freshToken = reLoginRes.data.token;

    const persistedCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    }).then(r => r.json());
    assert(persistedCartRes.data.items.length === 2, 'Cart persisted across new login session (2 items intact)');
    assert(persistedCartRes.data.total_items === 8, 'Cart total_items preserved across login');
    assert(persistedCartRes.data.total_amount === combinedTotal, 'Cart total_amount preserved across login');

    // 8. Cross-User Isolation
    console.log('\n--- 8. Cross-User Isolation ---');
    // User B checks cart (must be empty)
    const userBCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    }).then(r => r.json());
    assert(userBCartRes.data.items.length === 0, "User B's cart is empty and completely isolated from User A");

    // User B attempts to modify User A's cart item
    const crossPatchRes = await fetch(`${BASE_URL}/cart/items/${sampleProduct1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 10 }),
    });
    assert(crossPatchRes.status === 404, "User B cannot patch User A's cart item (Returns 404 Not Found)");

    // User B attempts to delete User A's cart item
    const crossDeleteRes = await fetch(`${BASE_URL}/cart/items/${sampleProduct1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(crossDeleteRes.status === 404, "User B cannot delete User A's cart item (Returns 404 Not Found)");

    // 9. Remove Item & Clear Cart
    console.log('\n--- 9. Remove Item & Clear Cart ---');
    // Remove Product 2 from User A's cart
    const removeRes = await fetch(`${BASE_URL}/cart/items/${sampleProduct2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(removeRes.status === 200, 'DELETE /api/cart/items/:productId returned 200 OK');

    const cartAfterRemove = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then(r => r.json());
    assert(cartAfterRemove.data.items.length === 1, 'Only Product 1 remains in cart');
    assert(cartAfterRemove.data.total_items === 5, 'Total items updated to 5');

    // Clear whole cart
    const clearRes = await fetch(`${BASE_URL}/cart`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(clearRes.status === 200, 'DELETE /api/cart returns 200 OK');

    const cartAfterClear = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    }).then(r => r.json());
    assert(cartAfterClear.data.items.length === 0 && cartAfterClear.data.total_items === 0, 'Cart is completely cleared');

    console.log(`\n========================================`);
    console.log(`SPRINT 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Integration test failed with error:', err);
    process.exit(1);
  } finally {
    // Clean up temporary test users (CASCADE automatically cleans up user carts & cart_items)
    try {
      await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [testUserAEmail.toLowerCase(), testUserBEmail.toLowerCase()]);
      console.log('[CLEANUP] Successfully cleaned up temporary test user accounts.');
    } catch (cleanupErr) {
      console.error('[CLEANUP ERROR]:', cleanupErr.message);
    }
    await pool.end();
  }
};

runTests();

