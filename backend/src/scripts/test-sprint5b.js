import openSearchClient from '../config/opensearch.js';
import { INDEX_NAME } from './setup-search-index.js';

const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('=== STARTING SPRINT 5B OPENSEARCH FULL-TEXT & FILTER TEST SUITE ===\n');
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
    // 1. Health Checks
    console.log('--- 1. Health Endpoints Sanity ---');
    const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    assert(health.status === 'ok' && health.service === 'HiveMart API', 'GET /api/health returns 200 ok');

    const dbHealth = await fetch(`${BASE_URL}/health/db`).then((r) => r.json());
    assert(dbHealth.status === 'ok' && dbHealth.database === 'connected', 'GET /api/health/db returns 200 connected');

    const searchHealth = await fetch(`${BASE_URL}/health/search`).then((r) => r.json());
    assert(searchHealth.status === 'ok' && searchHealth.search === 'connected', 'GET /api/health/search returns 200 connected');
    assert(searchHealth.version === '3.6.0', `OpenSearch version confirmed: ${searchHealth.version}`);

    // 2. OpenSearch Index Count
    console.log('\n--- 2. OpenSearch Index Document Count ---');
    const countRes = await openSearchClient.count({ index: INDEX_NAME });
    const docCount = countRes.body.count;
    assert(docCount === 36, `OpenSearch index "${INDEX_NAME}" contains exactly 36 documents (found ${docCount})`);

    // 3. Search Listing & Pagination
    console.log('\n--- 3. Search Listing & Pagination ---');
    const allSearchRes = await fetch(`${BASE_URL}/search`).then((r) => r.json());
    assert(allSearchRes.status === 'ok' && Array.isArray(allSearchRes.data), 'GET /api/search returns 200 ok and array');
    assert(allSearchRes.pagination.total === 36, `Total hits: 36 (found ${allSearchRes.pagination.total})`);
    assert(allSearchRes.data.length === 10, 'Default page limit returned 10 items');
    assert(allSearchRes.pagination.page === 1 && allSearchRes.pagination.totalPages === 4, 'Default page 1, 4 total pages');

    const paginatedRes = await fetch(`${BASE_URL}/search?page=2&limit=5`).then((r) => r.json());
    assert(paginatedRes.data.length === 5, 'Page 2 with limit 5 returns 5 items');
    assert(paginatedRes.pagination.page === 2 && paginatedRes.pagination.limit === 5, 'Pagination metadata matches requested page/limit');

    // 4. Full-Text Search (Exact, Typo/Fuzzy, Phrase Boosting)
    console.log('\n--- 4. Full-Text Search (Exact, Typo, Boosting) ---');
    // Exact search
    const exactRes = await fetch(`${BASE_URL}/search?q=boAt Rockerz`).then((r) => r.json());
    assert(exactRes.data.length > 0, `Exact search "boAt Rockerz" returned ${exactRes.data.length} hit(s)`);
    assert(exactRes.data[0].name.includes('boAt Rockerz 450'), `Top hit is exact match: "${exactRes.data[0].name}"`);

    // Typo/Fuzzy search: "headfones" -> matches "headphones"
    const typoRes = await fetch(`${BASE_URL}/search?q=headfones`).then((r) => r.json());
    assert(typoRes.data.length > 0, `Typo search "headfones" returned ${typoRes.data.length} fuzzy hit(s)`);
    assert(typoRes.data[0].name.includes('Headphones'), `Fuzzy hit correctly resolved to: "${typoRes.data[0].name}"`);

    // Typo search: "shampo" -> matches "shampoo"
    const typoRes2 = await fetch(`${BASE_URL}/search?q=shampo`).then((r) => r.json());
    assert(typoRes2.data.length > 0, `Typo search "shampo" returned ${typoRes2.data.length} hit(s)`);
    assert(typoRes2.data[0].name.includes('Shampoo'), `Fuzzy hit correctly resolved to: "${typoRes2.data[0].name}"`);

    // Exact phrase boosting over individual terms
    const phraseRes = await fetch(`${BASE_URL}/search?q=Bluetooth Headphones`).then((r) => r.json());
    assert(phraseRes.data[0].name.includes('boAt Rockerz 450 Bluetooth On-Ear Headphones'), 'Exact phrase match on name ranked highest');
    assert(phraseRes.data[0].score > (phraseRes.data[1]?.score || 0), `Top hit score (${phraseRes.data[0].score}) is boosted higher`);

    // 5. Category Filter
    console.log('\n--- 5. Category Filtering ---');
    const catRes = await fetch(`${BASE_URL}/search?category=Electronics&limit=50`).then((r) => r.json());
    assert(catRes.data.length === 6, `Electronics category filter returned 6 products (found ${catRes.data.length})`);
    assert(catRes.data.every((p) => p.category === 'Electronics'), 'All products belong to Electronics category');

    const fashionRes = await fetch(`${BASE_URL}/search?category=Fashion&limit=50`).then((r) => r.json());
    assert(fashionRes.data.length === 6, `Fashion category filter returned 6 products (found ${fashionRes.data.length})`);
    assert(fashionRes.data.every((p) => p.category === 'Fashion'), 'All products belong to Fashion category');

    // 6. Price Range Filter
    console.log('\n--- 6. Price Range Filtering ---');
    const priceRes = await fetch(`${BASE_URL}/search?minPrice=500&maxPrice=1500&limit=50`).then((r) => r.json());
    assert(priceRes.data.length > 0, `Price range [500, 1500] returned ${priceRes.data.length} products`);
    assert(
      priceRes.data.every((p) => p.price >= 500 && p.price <= 1500),
      'All returned products fall within [500, 1500] INR'
    );

    // 7. City Inventory & inStock Filter (Bengaluru 0-stock and 1-stock edge cases)
    console.log('\n--- 7. City Inventory & inStock Filter Edge Cases ---');
    // Without inStock filter: all 36 products returned with city_stock
    const blrAllRes = await fetch(`${BASE_URL}/search?city=Bengaluru&limit=50`).then((r) => r.json());
    assert(blrAllRes.data.length === 36, `city=Bengaluru without inStock filter returns all 36 products (found ${blrAllRes.data.length})`);

    const boatProduct = blrAllRes.data.find((p) => p.name.includes('boAt Rockerz 450'));
    const noiseProduct = blrAllRes.data.find((p) => p.name.includes('Noise ColorFit'));

    assert(boatProduct && boatProduct.city_stock === 1, `Verified Bengaluru 1-stock product: "${boatProduct?.name}" (city_stock: ${boatProduct?.city_stock})`);
    assert(noiseProduct && noiseProduct.city_stock === 0, `Verified Bengaluru 0-stock product: "${noiseProduct?.name}" (city_stock: ${noiseProduct?.city_stock})`);

    // With inStock=true: exactly 35 products returned (1-stock included, 0-stock excluded)
    const blrInStockRes = await fetch(`${BASE_URL}/search?city=Bengaluru&inStock=true&limit=50`).then((r) => r.json());
    assert(blrInStockRes.data.length === 35, `city=Bengaluru&inStock=true returns 35 in-stock products (found ${blrInStockRes.data.length})`);
    assert(
      blrInStockRes.data.some((p) => p.name.includes('boAt Rockerz 450')),
      '1-stock product (boAt Rockerz) is correctly INCLUDED in inStock=true'
    );
    assert(
      !blrInStockRes.data.some((p) => p.name.includes('Noise ColorFit')),
      '0-stock product (Noise ColorFit) is correctly EXCLUDED from inStock=true'
    );

    // With inStock=false: exactly 1 product returned (0-stock item)
    const blrOutStockRes = await fetch(`${BASE_URL}/search?city=Bengaluru&inStock=false&limit=50`).then((r) => r.json());
    assert(blrOutStockRes.data.length === 1, `city=Bengaluru&inStock=false returns 1 out-of-stock product (found ${blrOutStockRes.data.length})`);
    assert(
      blrOutStockRes.data[0].name.includes('Noise ColorFit'),
      `Correctly identified out-of-stock product: "${blrOutStockRes.data[0].name}"`
    );

    // 8. Sorting
    console.log('\n--- 8. Sorting Verification ---');
    const sortAscRes = await fetch(`${BASE_URL}/search?sort=price_asc&limit=10`).then((r) => r.json());
    const ascPrices = sortAscRes.data.map((p) => p.price);
    let isAsc = true;
    for (let i = 1; i < ascPrices.length; i++) {
      if (ascPrices[i] < ascPrices[i - 1]) isAsc = false;
    }
    assert(isAsc, `sort=price_asc correctly sorts lowest to highest: ${ascPrices.slice(0, 5).join(' <= ')}`);

    const sortDescRes = await fetch(`${BASE_URL}/search?sort=price_desc&limit=10`).then((r) => r.json());
    const descPrices = sortDescRes.data.map((p) => p.price);
    let isDesc = true;
    for (let i = 1; i < descPrices.length; i++) {
      if (descPrices[i] > descPrices[i - 1]) isDesc = false;
    }
    assert(isDesc, `sort=price_desc correctly sorts highest to lowest: ${descPrices.slice(0, 5).join(' >= ')}`);

    // 9. Error Handling & Validation
    console.log('\n--- 9. Error Handling & Safe Validation ---');
    const invalidPriceRange = await fetch(`${BASE_URL}/search?minPrice=2000&maxPrice=500`);
    assert(invalidPriceRange.status === 400, 'minPrice > maxPrice rejected with HTTP 400 Bad Request');

    const negativePrice = await fetch(`${BASE_URL}/search?minPrice=-10`);
    assert(negativePrice.status === 400, 'Negative price rejected with HTTP 400 Bad Request');

    const negativePage = await fetch(`${BASE_URL}/search?page=-1`);
    assert(negativePage.status === 400, 'Negative page rejected with HTTP 400 Bad Request');

    const limitExceeded = await fetch(`${BASE_URL}/search?limit=150`);
    assert(limitExceeded.status === 400, 'Limit > 100 rejected with HTTP 400 Bad Request');

    const invalidInStock = await fetch(`${BASE_URL}/search?inStock=maybe`);
    assert(invalidInStock.status === 400, 'Invalid inStock value rejected with HTTP 400 Bad Request');

    const invalidSort = await fetch(`${BASE_URL}/search?sort=invalid_sort`);
    assert(invalidSort.status === 400, 'Invalid sort value rejected with HTTP 400 Bad Request');

    // 10. Regression Checks on Existing Routes
    console.log('\n--- 10. Regression Checks ---');
    const pgProdRes = await fetch(`${BASE_URL}/products?limit=1`);
    assert(pgProdRes.status === 200, 'GET /api/products returns HTTP 200 OK');

    const categoriesRes = await fetch(`${BASE_URL}/categories`);
    assert(categoriesRes.status === 200, 'GET /api/categories returns HTTP 200 OK');

    const cartProtectedRes = await fetch(`${BASE_URL}/cart`);
    assert(cartProtectedRes.status === 401, 'GET /api/cart remains protected with HTTP 401 Unauthorized');

    console.log(`\n========================================`);
    console.log(`SPRINT 5B TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite failed with error:', err);
    process.exit(1);
  }
};

runTests();

