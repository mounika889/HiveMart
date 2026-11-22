import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = 'http://127.0.0.1:3000';
const BACKEND_URL = 'http://127.0.0.1:5000/api';

async function runSprint9dTests() {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9D CART, CHECKOUT & ORDERS TEST SUITE ===');
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

  try {
    // -------------------------------------------------------------------------
    // 1. Frontend Routes & HTML Delivery for Shopping Flows
    // -------------------------------------------------------------------------
    console.log('--- 1. Frontend Route Delivery ---');
    const cartHtmlRes = await fetch(`${FRONTEND_URL}/cart`);
    assert(cartHtmlRes.status === 200, 'Route /cart returns HTTP 200 from frontend server');
    const cartHtmlText = await cartHtmlRes.text();
    assert(cartHtmlText.includes('<div id="root"></div>'), 'Cart page contains React root (#root)');

    const checkoutHtmlRes = await fetch(`${FRONTEND_URL}/checkout`);
    assert(checkoutHtmlRes.status === 200, 'Route /checkout returns HTTP 200');

    const ordersHtmlRes = await fetch(`${FRONTEND_URL}/orders`);
    assert(ordersHtmlRes.status === 200, 'Route /orders returns HTTP 200');

    // -------------------------------------------------------------------------
    // 2. Vite Module Resolution & Architecture Files
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Vite Module Resolution & Source Verification ---');
    const cartServiceRes = await fetch(`${FRONTEND_URL}/src/services/cart.ts`);
    assert(cartServiceRes.status === 200, 'Vite successfully transforms /src/services/cart.ts');

    const orderServiceRes = await fetch(`${FRONTEND_URL}/src/services/order.ts`);
    assert(orderServiceRes.status === 200, 'Vite successfully transforms /src/services/order.ts');

    const cartContextRes = await fetch(`${FRONTEND_URL}/src/context/CartContext.tsx`);
    assert(cartContextRes.status === 200, 'Vite successfully transforms /src/context/CartContext.tsx');

    const appRes = await fetch(`${FRONTEND_URL}/src/App.tsx`);
    assert(appRes.status === 200, 'Vite successfully transforms /src/App.tsx');
    const appSrc = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
    assert(appSrc.includes('CartProvider'), 'App wraps application tree with CartProvider');
    assert(appSrc.includes('ProtectedRoute'), 'App uses ProtectedRoute for checkout and orders');
    assert(appSrc.includes('/orders/:id'), 'App mounts /orders/:id route for order details and confirmation');

    // -------------------------------------------------------------------------
    // 3. User Setup for Isolated Testing
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Setting Up Isolated Test Customers ---');
    const uidA = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_a`;
    const userA = {
      name: `Shopper A ${uidA}`,
      email: `shopper_a_${uidA}@example.com`,
      password: `PassA#${uidA}`,
    };

    const regARes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA),
    });
    assert(regARes.status === 201, 'Customer A registered successfully');
    const userAData = await regARes.json();
    const tokenA = userAData.data.token;
    const profileA = userAData.data.user;

    const uidB = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_b`;
    const userB = {
      name: `Shopper B ${uidB}`,
      email: `shopper_b_${uidB}@example.com`,
      password: `PassB#${uidB}`,
    };

    const regBRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userB),
    });
    assert(regBRes.status === 201, 'Customer B registered successfully');
    const userBData = await regBRes.json();
    const tokenB = userBData.data.token;

    // Fetch real active products that have ample stock in Bengaluru
    const productsRes = await fetch(`${FRONTEND_URL}/api/products?city=Bengaluru&limit=20`);
    const productsJson = await productsRes.json();
    const availableProducts = (productsJson.data || []).filter((p) => typeof p.city_stock === 'number' && p.city_stock >= 5);
    assert(availableProducts.length >= 2, 'Found at least 2 in-stock active products in catalog');
    const product1 = availableProducts[0];
    const product2 = availableProducts[1];

    // -------------------------------------------------------------------------
    // 4. Cart API Authentication & Initial Empty Cart
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Cart Authentication & Empty Cart State ---');
    const unauthCartRes = await fetch(`${FRONTEND_URL}/api/cart`);
    assert(unauthCartRes.status === 401, 'GET /api/cart without token returns HTTP 401 Unauthorized');

    const authCartRes = await fetch(`${FRONTEND_URL}/api/cart?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(authCartRes.status === 200, 'GET /api/cart with valid token returns HTTP 200');
    const initialCart = await authCartRes.json();
    assert(initialCart.status === 'ok', 'Cart response status is "ok"');
    assert(Array.isArray(initialCart.data.items), 'Cart items is an array');
    assert(initialCart.data.total_items === 0, 'New customer cart starts with 0 items');
    assert(parseFloat(initialCart.data.total_amount) === 0, 'New customer cart total amount is 0.00');

    // -------------------------------------------------------------------------
    // 5. Add Items to Persistent Cart (POST /api/cart/items)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Adding Items to Cart ---');
    // Add product 1 with quantity 2
    const add1Res = await fetch(`${FRONTEND_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product1.id,
        quantity: 2,
        city: 'Bengaluru',
      }),
    });
    assert(add1Res.status === 201, 'POST /api/cart/items returns HTTP 201 Created');
    const add1Data = await add1Res.json();
    assert(add1Data.data.items.length === 1, 'Cart now contains 1 distinct product line');
    assert(add1Data.data.total_items === 2, 'Cart total_items equals 2');
    assert(add1Data.data.items[0].product_id === product1.id, 'Cart item product_id matches product 1');
    assert(add1Data.data.items[0].quantity === 2, 'Cart item quantity equals 2');
    assert(typeof add1Data.data.items[0].city_stock === 'number', 'Cart item includes numeric city_stock');
    assert(typeof add1Data.data.items[0].is_available_in_city === 'boolean', 'Cart item includes is_available_in_city boolean');

    // Add product 2 with quantity 3
    const add2Res = await fetch(`${FRONTEND_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product2.id,
        quantity: 3,
        city: 'Bengaluru',
      }),
    });
    assert(add2Res.status === 201, 'Adding second product returns HTTP 201 Created');
    const add2Data = await add2Res.json();
    assert(add2Data.data.items.length === 2, 'Cart now contains 2 distinct product lines');
    assert(add2Data.data.total_items === 5, 'Cart total_items cumulative across lines equals 5');

    // -------------------------------------------------------------------------
    // 6. Duplicate Add Rejection by Backend
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Duplicate Add Handling ---');
    const duplicateAddRes = await fetch(`${FRONTEND_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product1.id,
        quantity: 1,
      }),
    });
    assert(duplicateAddRes.status === 409, 'Direct duplicate POST returns HTTP 409 Conflict');
    const dupJson = await duplicateAddRes.json();
    assert(dupJson.message.includes('already in cart'), 'Returns clear message suggesting quantity update');

    // -------------------------------------------------------------------------
    // 7. Update Item Quantity (PATCH /api/cart/items/:productId)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Updating Cart Item Quantity ---');
    const updateRes = await fetch(`${FRONTEND_URL}/api/cart/items/${product1.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quantity: 4,
        city: 'Bengaluru',
      }),
    });
    assert(updateRes.status === 200, 'PATCH /api/cart/items/:id returns HTTP 200 OK');
    const updateData = await updateRes.json();
    const updatedP1 = updateData.data.items.find((i) => i.product_id === product1.id);
    assert(updatedP1 && updatedP1.quantity === 4, 'Product 1 quantity updated to 4');
    assert(updateData.data.total_items === 7, 'Cart total_items reflects new total (4 + 3 = 7)');

    // -------------------------------------------------------------------------
    // 8. Cart Persistence Across Independent Queries
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Cart Persistence in PostgreSQL ---');
    const reloadCartRes = await fetch(`${FRONTEND_URL}/api/cart?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(reloadCartRes.status === 200, 'GET /api/cart reload succeeds');
    const reloadCart = await reloadCartRes.json();
    assert(reloadCart.data.items.length === 2, 'Reloaded cart retains 2 items');
    assert(reloadCart.data.total_items === 7, 'Reloaded cart retains total_items 7');

    // -------------------------------------------------------------------------
    // 9. Customer Cart Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Customer Cart Isolation ---');
    const userBCartRes = await fetch(`${FRONTEND_URL}/api/cart?city=Bengaluru`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(userBCartRes.status === 200, 'Customer B retrieves cart');
    const userBCart = await userBCartRes.json();
    assert(userBCart.data.items.length === 0, 'Customer B cart is completely empty (User A items isolated)');
    assert(userBCart.data.user_id !== profileA.id, 'Customer B cart has different user_id');

    // -------------------------------------------------------------------------
    // 10. City-Specific Stock Projection in Cart
    // -------------------------------------------------------------------------
    console.log('\n--- 10. City Inventory Projection in Cart ---');
    const mumbaiCartRes = await fetch(`${FRONTEND_URL}/api/cart?city=Mumbai`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const mumbaiCart = await mumbaiCartRes.json();
    assert(mumbaiCart.data.city === 'Mumbai', 'Cart confirms active projection city is Mumbai');
    assert(
      typeof mumbaiCart.data.items[0].city_stock === 'number',
      'Cart item displays Mumbai inventory quantity'
    );

    // -------------------------------------------------------------------------
    // 11. Remove Single Item (DELETE /api/cart/items/:productId)
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Remove Item from Cart ---');
    const removeRes = await fetch(`${FRONTEND_URL}/api/cart/items/${product2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(removeRes.status === 200, 'DELETE /api/cart/items/:id returns HTTP 200');

    const afterRemoveCartRes = await fetch(`${FRONTEND_URL}/api/cart`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const afterRemoveCart = await afterRemoveCartRes.json();
    assert(afterRemoveCart.data.items.length === 1, 'Cart now has only 1 remaining item');
    assert(afterRemoveCart.data.items[0].product_id === product1.id, 'Remaining item is product 1');

    // -------------------------------------------------------------------------
    // 12. Clear Cart (DELETE /api/cart)
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Clear Entire Cart ---');
    const clearRes = await fetch(`${FRONTEND_URL}/api/cart`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(clearRes.status === 200, 'DELETE /api/cart returns HTTP 200');

    const emptyCartRes = await fetch(`${FRONTEND_URL}/api/cart`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const emptyCartData = await emptyCartRes.json();
    assert(emptyCartData.data.items.length === 0, 'Cart items array is empty after clear');
    assert(emptyCartData.data.total_items === 0, 'Total items count is 0 after clear');

    // -------------------------------------------------------------------------
    // 13. Empty Cart Checkout Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Empty Cart Checkout Protection ---');
    const emptyCheckoutRes = await fetch(`${FRONTEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city: 'Bengaluru',
        idempotencyKey: `empty_chk_${Date.now()}`,
      }),
    });
    assert(emptyCheckoutRes.status === 400, 'Checkout on empty cart is rejected with HTTP 400');
    const emptyChkData = await emptyCheckoutRes.json();
    assert(emptyChkData.message.includes('empty'), 'Returns descriptive empty cart error message');

    // -------------------------------------------------------------------------
    // 14. Real Atomic Checkout (POST /api/checkout)
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Real Atomic Checkout Execution ---');
    // Add product 1 with quantity 1 for checkout
    await fetch(`${FRONTEND_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product1.id,
        quantity: 1,
        city: 'Bengaluru',
      }),
    });

    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const checkoutRes = await fetch(`${FRONTEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city: 'Bengaluru',
        idempotencyKey,
      }),
    });
    assert(checkoutRes.status === 201, 'POST /api/checkout returns HTTP 201 Created');
    const checkoutData = await checkoutRes.json();
    assert(checkoutData.status === 'ok', 'Checkout response status is "ok"');
    assert(checkoutData.data && checkoutData.data.id, 'Checkout returns generated Order UUID');
    assert(checkoutData.data.status === 'CONFIRMED', 'Order status is "CONFIRMED"');
    assert(checkoutData.data.city === 'Bengaluru', 'Order city matches Bengaluru');
    assert(checkoutData.data.idempotency_key === idempotencyKey, 'Order records idempotency_key');
    assert(Array.isArray(checkoutData.data.items), 'Order includes items snapshot');
    assert(checkoutData.data.items.length === 1, 'Order has 1 purchased item');

    const createdOrderId = checkoutData.data.id;

    // Verify User A's cart is now empty after checkout commit
    const postCheckoutCartRes = await fetch(`${FRONTEND_URL}/api/cart`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const postCheckoutCart = await postCheckoutCartRes.json();
    assert(postCheckoutCart.data.items.length === 0, 'PostgreSQL atomic checkout clears user cart');

    // -------------------------------------------------------------------------
    // 15. Idempotent Checkout Replay Safety
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Idempotent Checkout Replay Verification ---');
    const replayRes = await fetch(`${FRONTEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city: 'Bengaluru',
        idempotencyKey, // EXACT SAME KEY
      }),
    });
    assert(replayRes.status === 200, 'Replaying checkout with same idempotencyKey returns HTTP 200');
    const replayData = await replayRes.json();
    assert(replayData.data.id === createdOrderId, 'Replay returns original order ID without duplication');
    assert(replayData.message.includes('Idempotent replay'), 'Response indicates idempotent replay');

    // -------------------------------------------------------------------------
    // 16. Order Detail Retrieval (GET /api/orders/:id)
    // -------------------------------------------------------------------------
    console.log('\n--- 16. Order Detail Verification ---');
    const orderDetailRes = await fetch(`${FRONTEND_URL}/api/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(orderDetailRes.status === 200, 'GET /api/orders/:id returns HTTP 200');
    const orderDetail = await orderDetailRes.json();
    assert(orderDetail.data.id === createdOrderId, 'Order detail ID matches');
    assert(orderDetail.data.user_id === profileA.id, 'Order belongs to Customer A');
    assert(orderDetail.data.status === 'CONFIRMED', 'Order status verified as CONFIRMED');
    assert(orderDetail.data.items.length === 1, 'Order contains itemized product snapshot');

    // -------------------------------------------------------------------------
    // 17. Customer Order Isolation (Cross-User Protection)
    // -------------------------------------------------------------------------
    console.log('\n--- 17. Customer Order Isolation Verification ---');
    const crossOrderRes = await fetch(`${FRONTEND_URL}/api/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossOrderRes.status === 404, 'Customer B cannot access Customer A order (HTTP 404 Not Found)');

    // -------------------------------------------------------------------------
    // 18. Order History Retrieval (GET /api/orders)
    // -------------------------------------------------------------------------
    console.log('\n--- 18. Customer Order History ---');
    const ordersListRes = await fetch(`${FRONTEND_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(ordersListRes.status === 200, 'GET /api/orders returns HTTP 200');
    const ordersList = await ordersListRes.json();
    assert(Array.isArray(ordersList.data), 'Order history is an array');
    assert(ordersList.data.length >= 1, 'Order history contains at least 1 order');
    const foundOrder = ordersList.data.find((o) => o.id === createdOrderId);
    assert(foundOrder !== undefined, 'Confirmed order appears in customer order history');

    // -------------------------------------------------------------------------
    // 19. Insufficient Stock Checkout Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 19. Insufficient Stock Safety ---');
    // Add an impossible quantity to cart directly via PATCH or database test
    // To safely test without altering catalog: request 999999 units
    await fetch(`${FRONTEND_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product1.id,
        quantity: 999999,
        city: 'Bengaluru',
      }),
    });

    const excessiveCheckoutRes = await fetch(`${FRONTEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city: 'Bengaluru',
        idempotencyKey: `excessive_${Date.now()}`,
      }),
    });
    assert(excessiveCheckoutRes.status === 409, 'Excessive quantity checkout rejected with HTTP 409 Conflict');
    const excessiveData = await excessiveCheckoutRes.json();
    assert(excessiveData.message.includes('Insufficient stock'), 'Message explicitly reports insufficient stock');

    // -------------------------------------------------------------------------
    // 20. Component & UI Code Integrity Checks
    // -------------------------------------------------------------------------
    console.log('\n--- 20. Component & UI Architecture Checks ---');
    const cartPageSrc = fs.readFileSync(path.join(__dirname, 'src/pages/CartPage.tsx'), 'utf8');
    assert(cartPageSrc.includes('Your Shopping Cart'), 'CartPage renders heading "Your Shopping Cart"');
    assert(cartPageSrc.includes('Review your picks before checkout'), 'CartPage renders required subtitle');
    assert(cartPageSrc.includes('Clear Cart'), 'CartPage provides Clear Cart action with confirmation');
    assert(cartPageSrc.includes('Proceed to Checkout'), 'CartPage includes Proceed to Checkout button');

    const checkoutPageSrc = fs.readFileSync(path.join(__dirname, 'src/pages/CheckoutPage.tsx'), 'utf8');
    assert(checkoutPageSrc.includes('Secure Checkout'), 'CheckoutPage renders heading "Secure Checkout"');
    assert(checkoutPageSrc.includes('idempotencyKey'), 'CheckoutPage implements idempotencyKey generation');
    assert(checkoutPageSrc.includes('placeOrder'), 'CheckoutPage calls placeOrder service');

    const navbarSrc = fs.readFileSync(path.join(__dirname, 'src/components/layout/Navbar.tsx'), 'utf8');
    assert(navbarSrc.includes('totalItems'), 'Navbar binds cart item counter to totalItems');
    assert(navbarSrc.includes('navbar-cart-badge'), 'Navbar contains navbar-cart-badge test id');

    const productDetailSrc = fs.readFileSync(path.join(__dirname, 'src/pages/ProductDetailPage.tsx'), 'utf8');
    assert(productDetailSrc.includes('add-to-cart-btn'), 'ProductDetailPage contains real Add to Cart button');
    assert(productDetailSrc.includes('Out of Stock'), 'ProductDetailPage handles Out of Stock city status');

    console.log('\n================================================================');
    console.log(`SPRINT 9D TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Sprint 9D test execution:', err);
    process.exit(1);
  }
}

runSprint9dTests();

