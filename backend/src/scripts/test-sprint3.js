import pool from '../config/database.js';

const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('=== STARTING SPRINT 3 VERIFICATION TEST SUITE ===\n');
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

  try {
    // 1. Health Endpoints Preservation
    console.log('--- 1. Health Check Preservation ---');
    const healthRes = await fetch(`${BASE_URL}/health`).then(r => r.json());
    assert(healthRes.status === 'ok' && healthRes.service === 'HiveMart API', 'GET /api/health returns 200 ok');

    const dbHealthRes = await fetch(`${BASE_URL}/health/db`).then(r => r.json());
    assert(dbHealthRes.status === 'ok' && dbHealthRes.database === 'connected', 'GET /api/health/db returns 200 connected');

    // 2. Categories
    console.log('\n--- 2. Product Categories ---');
    const catRes = await fetch(`${BASE_URL}/categories`).then(r => r.json());
    assert(catRes.status === 'ok' && Array.isArray(catRes.data), 'GET /api/categories returns status ok and array');
    assert(catRes.data.length >= 6, `Categories count >= 6 (found ${catRes.data.length})`);
    const catNames = catRes.data.map(c => c.category);
    console.log('  Discovered categories:', catNames.join(', '));
    assert(catNames.includes('Electronics') && catNames.includes('Fashion') && catNames.includes('Groceries'), 'Includes Electronics, Fashion, Groceries');

    // 3. Products Listing & Default Pagination
    console.log('\n--- 3. Products Listing & Pagination ---');
    const prodRes = await fetch(`${BASE_URL}/products`).then(r => r.json());
    assert(prodRes.status === 'ok' && Array.isArray(prodRes.data), 'GET /api/products returns 200 ok and array');
    assert(prodRes.pagination.total >= 30, `Total products >= 30 (found ${prodRes.pagination.total})`);
    assert(prodRes.pagination.limit === 10 && prodRes.data.length === 10, 'Default limit = 10, returned 10 products');
    assert(prodRes.pagination.page === 1, 'Default page = 1');

    // Custom Pagination
    const page2Res = await fetch(`${BASE_URL}/products?page=2&limit=5`).then(r => r.json());
    assert(page2Res.data.length === 5 && page2Res.pagination.page === 2 && page2Res.pagination.limit === 5, 'Page 2 with limit 5 returns 5 products');

    // 4. Filtering (Category & Price)
    console.log('\n--- 4. Filtering ---');
    const electronicsRes = await fetch(`${BASE_URL}/products?category=Electronics&limit=50`).then(r => r.json());
    assert(electronicsRes.data.length === 6, `Electronics category filter returned 6 products (found ${electronicsRes.data.length})`);
    const allElectronics = electronicsRes.data.every(p => p.category === 'Electronics');
    assert(allElectronics, 'All filtered products belong to Electronics');

    const priceFilterRes = await fetch(`${BASE_URL}/products?minPrice=500&maxPrice=1500&limit=50`).then(r => r.json());
    assert(priceFilterRes.data.length > 0, `Price filter [500, 1500] returned ${priceFilterRes.data.length} products`);
    const allPriceMatches = priceFilterRes.data.every(p => Number(p.price) >= 500 && Number(p.price) <= 1500);
    assert(allPriceMatches, 'All returned products are within [500, 1500] price range');

    // 5. City Inventory Filter & Stock Checks
    console.log('\n--- 5. City Inventory & Stock Edge Cases ---');
    const blrRes = await fetch(`${BASE_URL}/products?city=Bengaluru&limit=50`).then(r => r.json());
    assert(blrRes.data.length >= 30, `City filter for Bengaluru returned ${blrRes.data.length} products with city_stock`);
    
    // Find the low stock (1 unit), out of stock (0 units), and >10 units in Bengaluru
    const stock1 = blrRes.data.find(p => Number(p.city_stock) === 1);
    const stock0 = blrRes.data.find(p => Number(p.city_stock) === 0);
    const stockAbove10 = blrRes.data.filter(p => Number(p.city_stock) > 10);

    assert(!!stock1, `Verified product with exactly 1 unit in Bengaluru: "${stock1?.name}"`);
    assert(!!stock0, `Verified product with exactly 0 units in Bengaluru: "${stock0?.name}"`);
    assert(stockAbove10.length > 5, `Verified several products have >10 units in Bengaluru (found ${stockAbove10.length})`);

    // 6. Sorting Verification
    console.log('\n--- 6. Sorting ---');
    const ascRes = await fetch(`${BASE_URL}/products?sort=price_asc&limit=10`).then(r => r.json());
    const ascPrices = ascRes.data.map(p => Number(p.price));
    let isAsc = true;
    for (let i = 1; i < ascPrices.length; i++) {
      if (ascPrices[i] < ascPrices[i - 1]) isAsc = false;
    }
    assert(isAsc, `sort=price_asc correctly sorts lowest to highest: ${ascPrices.slice(0, 5).join(' <= ')}`);

    const descRes = await fetch(`${BASE_URL}/products?sort=price_desc&limit=10`).then(r => r.json());
    const descPrices = descRes.data.map(p => Number(p.price));
    let isDesc = true;
    for (let i = 1; i < descPrices.length; i++) {
      if (descPrices[i] > descPrices[i - 1]) isDesc = false;
    }
    assert(isDesc, `sort=price_desc correctly sorts highest to lowest: ${descPrices.slice(0, 5).join(' >= ')}`);

    // 7. Product Details (GET /api/products/:id)
    console.log('\n--- 7. Product Details by ID ---');
    const firstProduct = prodRes.data[0];
    const detailRes = await fetch(`${BASE_URL}/products/${firstProduct.id}`).then(r => r.json());
    assert(detailRes.status === 'ok' && detailRes.data.id === firstProduct.id, 'GET /api/products/:id returns correct product');
    assert(Array.isArray(detailRes.data.inventory) && detailRes.data.inventory.length === 5, 'Includes inventory array across all 5 cities');
    assert(detailRes.data.total_stock > 0, `Total stock calculated: ${detailRes.data.total_stock}`);

    // 8. Inventory Endpoint (GET /api/inventory/:productId)
    console.log('\n--- 8. Product Inventory Endpoint ---');
    const invRes = await fetch(`${BASE_URL}/inventory/${firstProduct.id}`).then(r => r.json());
    assert(invRes.status === 'ok' && invRes.data.product_id === firstProduct.id, 'GET /api/inventory/:productId returns status ok');
    assert(invRes.data.cities.length === 5, `Inventory returns 5 city records (found ${invRes.data.cities.length})`);
    const citiesFound = invRes.data.cities.map(c => c.city);
    assert(
      citiesFound.includes('Bengaluru') &&
      citiesFound.includes('Hyderabad') &&
      citiesFound.includes('Chennai') &&
      citiesFound.includes('Mumbai') &&
      citiesFound.includes('Delhi'),
      'Inventory covers Bengaluru, Hyderabad, Chennai, Mumbai, Delhi'
    );

    // 9. Input Validation & Invalid IDs
    console.log('\n--- 9. Error Handling & Invalid IDs ---');
    const invalidIdRes = await fetch(`${BASE_URL}/products/not-a-uuid`);
    assert(invalidIdRes.status === 400, 'Invalid UUID on /products/:id returns 400 Bad Request');
    const invalidIdBody = await invalidIdRes.json();
    assert(invalidIdBody.message.includes('Invalid product ID format'), `Expected 400 message: "${invalidIdBody.message}"`);

    const notFoundIdRes = await fetch(`${BASE_URL}/products/00000000-0000-0000-0000-000000000000`);
    assert(notFoundIdRes.status === 404, 'Non-existent UUID on /products/:id returns 404 Not Found');

    const invalidInvIdRes = await fetch(`${BASE_URL}/inventory/invalid-uuid-format`);
    assert(invalidInvIdRes.status === 400, 'Invalid UUID on /inventory/:productId returns 400 Bad Request');

    const notFoundInvIdRes = await fetch(`${BASE_URL}/inventory/00000000-0000-0000-0000-000000000000`);
    assert(notFoundInvIdRes.status === 404, 'Non-existent UUID on /inventory/:productId returns 404 Not Found');

    const invalidPriceRange = await fetch(`${BASE_URL}/products?minPrice=2000&maxPrice=100`);
    assert(invalidPriceRange.status === 400, 'minPrice > maxPrice returns 400 Bad Request');

    const invalidPage = await fetch(`${BASE_URL}/products?page=-5`);
    assert(invalidPage.status === 400, 'Negative page number returns 400 Bad Request');

    // 10. SQL Injection Protection Verification
    console.log('\n--- 10. SQL Injection Protection Tests ---');
    const sqliCategoryRes = await fetch(`${BASE_URL}/products?category=' OR '1'='1`);
    assert(sqliCategoryRes.status === 200, 'SQL injection in category handled safely (HTTP 200)');
    const sqliCategoryBody = await sqliCategoryRes.json();
    assert(sqliCategoryBody.data.length === 0, 'No products returned for injected category string (sanitized parameter)');

    const sqliSortRes = await fetch(`${BASE_URL}/products?sort=price;DROP TABLE products;`);
    assert(sqliSortRes.status === 200, 'SQL injection in sort parameter safely discarded by whitelist');
    
    // Verify products table still intact
    const verifyTableRes = await pool.query('SELECT COUNT(*)::int AS count FROM products');
    assert(verifyTableRes.rows[0].count >= 30, `Products table intact and unaffected (Count: ${verifyTableRes.rows[0].count})`);

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runTests();

