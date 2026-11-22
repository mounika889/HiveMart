import http from 'http';

const FRONTEND_URL = 'http://127.0.0.1:3000';
const BACKEND_URL = 'http://127.0.0.1:5000/api';

async function runSprint9bTests() {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9B CATALOG & SMART SEARCH TEST SUITE ===');
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
    // 1. Catalog route loads & components exist
    // -------------------------------------------------------------------------
    console.log('--- 1. Catalog Route & Client Entry ---');
    const catalogHtmlRes = await fetch(`${FRONTEND_URL}/products`);
    assert(catalogHtmlRes.status === 200, 'Catalog route /products returns HTTP 200 from frontend server');
    const htmlText = await catalogHtmlRes.text();
    assert(htmlText.includes('<div id="root"></div>'), 'HTML entry contains React root container');

    // -------------------------------------------------------------------------
    // 2. Real products render from OpenSearch API
    // -------------------------------------------------------------------------
    console.log('\n--- 2. OpenSearch Search API (/api/search) ---');
    const defaultSearchRes = await fetch(`${FRONTEND_URL}/api/search?limit=12&city=Bengaluru`);
    assert(defaultSearchRes.status === 200, 'GET /api/search returns HTTP 200');
    const defaultSearchData = await defaultSearchRes.json();
    assert(defaultSearchData.status === 'ok' && Array.isArray(defaultSearchData.data), 'Returns ok status and array of products');
    assert(defaultSearchData.data.length === 12, `Returns requested limit of 12 products (found ${defaultSearchData.data.length})`);
    assert(defaultSearchData.pagination.total === 36, `Total catalog products equals 36 (found ${defaultSearchData.pagination.total})`);

    // -------------------------------------------------------------------------
    // 3. Categories load from backend
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Category Integration (/api/categories) ---');
    const categoriesRes = await fetch(`${FRONTEND_URL}/api/categories`);
    assert(categoriesRes.status === 200, 'GET /api/categories returns HTTP 200');
    const categoriesData = await categoriesRes.json();
    assert(categoriesData.data.length === 6, `Returns all 6 distinct retail categories (found ${categoriesData.data.length})`);
    const categoryNames = categoriesData.data.map((c) => c.category);
    assert(
      categoryNames.includes('Electronics') &&
      categoryNames.includes('Fashion') &&
      categoryNames.includes('Groceries') &&
      categoryNames.includes('Beauty & Personal Care') &&
      categoryNames.includes('Home & Kitchen') &&
      categoryNames.includes('Sports & Fitness'),
      'Matches all 6 backend categories'
    );

    // -------------------------------------------------------------------------
    // 4. Keyword search works
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Full-Text Keyword Search ---');
    const keywordRes = await fetch(`${FRONTEND_URL}/api/search?q=coffee&city=Bengaluru`);
    assert(keywordRes.status === 200, 'GET /api/search?q=coffee returns HTTP 200');
    const keywordData = await keywordRes.json();
    assert(keywordData.data.length > 0, `Found matching products for "coffee" (found ${keywordData.data.length})`);
    assert(
      keywordData.data.some((p) => p.name.toLowerCase().includes('coffee') || p.description.toLowerCase().includes('coffee')),
      'Top products match keyword "coffee"'
    );

    // -------------------------------------------------------------------------
    // 5. Typo-tolerant search works (OpenSearch fuzzy)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Typo-Tolerant Fuzzy Search (Aiven OpenSearch) ---');
    const typoRes1 = await fetch(`${FRONTEND_URL}/api/search?q=headfones&city=Bengaluru`);
    assert(typoRes1.status === 200, 'GET /api/search?q=headfones (typo) returns HTTP 200');
    const typoData1 = await typoRes1.json();
    assert(typoData1.data.length > 0, `Typo "headfones" resolved fuzzy matches (found ${typoData1.data.length})`);
    assert(
      typoData1.data[0].name.toLowerCase().includes('headphones'),
      `Fuzzy match correctly resolved to: "${typoData1.data[0].name}"`
    );

    const typoRes2 = await fetch(`${FRONTEND_URL}/api/search?q=shampo&city=Bengaluru`);
    assert(typoRes2.status === 200, 'GET /api/search?q=shampo (typo) returns HTTP 200');
    const typoData2 = await typoRes2.json();
    assert(
      typoData2.data.some((p) => p.name.toLowerCase().includes('shampoo')),
      `Typo "shampo" correctly resolved to shampoo products`
    );

    // -------------------------------------------------------------------------
    // 6. Category filtering works
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Category Filtering ---');
    const catFilterRes = await fetch(`${FRONTEND_URL}/api/search?category=Electronics&city=Bengaluru`);
    assert(catFilterRes.status === 200, 'GET /api/search?category=Electronics returns HTTP 200');
    const catFilterData = await catFilterRes.json();
    assert(catFilterData.data.length === 6, `Electronics category has 6 products (found ${catFilterData.data.length})`);
    assert(
      catFilterData.data.every((p) => p.category === 'Electronics'),
      'All filtered products strictly belong to "Electronics"'
    );

    // -------------------------------------------------------------------------
    // 7. City filtering works
    // -------------------------------------------------------------------------
    console.log('\n--- 7. City-Specific Inventory Projections ---');
    const cityBlrRes = await fetch(`${FRONTEND_URL}/api/search?city=Bengaluru&limit=5`);
    const cityBlrData = await cityBlrRes.json();
    assert(cityBlrData.data[0].city === 'Bengaluru', 'Product confirms city is Bengaluru');
    assert(typeof cityBlrData.data[0].city_stock === 'number', `Product has numeric city_stock (stock: ${cityBlrData.data[0].city_stock})`);

    const cityHydRes = await fetch(`${FRONTEND_URL}/api/search?city=Hyderabad&limit=5`);
    const cityHydData = await cityHydRes.json();
    assert(cityHydData.data[0].city === 'Hyderabad', 'Product confirms city is Hyderabad');

    // -------------------------------------------------------------------------
    // 8. City selection persistence
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Supported Cities Configuration ---');
    const supportedCities = ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi'];
    for (const city of supportedCities) {
      const probeRes = await fetch(`${FRONTEND_URL}/api/search?city=${city}&limit=1`);
      const probeData = await probeRes.json();
      assert(probeData.data[0]?.city === city, `Live inventory projected correctly for ${city}`);
    }

    // -------------------------------------------------------------------------
    // 9. Minimum price filter works
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Minimum Price Filtering ---');
    const minPriceRes = await fetch(`${FRONTEND_URL}/api/search?minPrice=1500&city=Bengaluru`);
    assert(minPriceRes.status === 200, 'GET /api/search?minPrice=1500 returns HTTP 200');
    const minPriceData = await minPriceRes.json();
    assert(
      minPriceData.data.every((p) => Number(p.price) >= 1500),
      'All returned products have price >= 1500 INR'
    );

    // -------------------------------------------------------------------------
    // 10. Maximum price filter works
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Maximum Price Filtering ---');
    const maxPriceRes = await fetch(`${FRONTEND_URL}/api/search?maxPrice=500&city=Bengaluru`);
    assert(maxPriceRes.status === 200, 'GET /api/search?maxPrice=500 returns HTTP 200');
    const maxPriceData = await maxPriceRes.json();
    assert(
      maxPriceData.data.every((p) => Number(p.price) <= 500),
      'All returned products have price <= 500 INR'
    );

    // -------------------------------------------------------------------------
    // 11. Invalid price range handled
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Invalid Price Range Validation ---');
    const invalidPriceRes = await fetch(`${FRONTEND_URL}/api/search?minPrice=2000&maxPrice=500`);
    assert(invalidPriceRes.status === 400, 'minPrice > maxPrice rejected with HTTP 400 Bad Request');
    const invalidPriceData = await invalidPriceRes.json();
    assert(invalidPriceData.message.includes('minPrice cannot be greater than maxPrice'), 'Clean validation message returned');

    // -------------------------------------------------------------------------
    // 12. In-stock filter works
    // -------------------------------------------------------------------------
    console.log('\n--- 12. In-Stock Filter (Positive Stock) ---');
    const inStockRes = await fetch(`${FRONTEND_URL}/api/search?city=Bengaluru&inStock=true`);
    assert(inStockRes.status === 200, 'GET /api/search?city=Bengaluru&inStock=true returns HTTP 200');
    const inStockData = await inStockRes.json();
    assert(
      inStockData.data.every((p) => p.city_stock > 0),
      'Every returned product has positive city_stock (>0)'
    );

    // -------------------------------------------------------------------------
    // 13. Out-of-stock city filtering edge cases
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Out-of-Stock City Filtering Edge Cases ---');
    // In our seed data, "Noise ColorFit Pulse 2 Max 1.85" Smart Watch" has exactly 0 stock in Bengaluru
    const outOfStockRes = await fetch(`${FRONTEND_URL}/api/search?city=Bengaluru&inStock=false`);
    assert(outOfStockRes.status === 200, 'GET /api/search?city=Bengaluru&inStock=false returns HTTP 200');
    const outOfStockData = await outOfStockRes.json();
    assert(outOfStockData.data.length === 1, 'Exactly 1 seeded product is out of stock in Bengaluru');
    assert(outOfStockData.data[0].city_stock === 0, 'Isolated out-of-stock product has city_stock = 0');
    assert(outOfStockData.data[0].name.includes('Noise ColorFit'), 'Identified correct 0-stock seeded product');

    // -------------------------------------------------------------------------
    // 14. Sorting works
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Sorting Options Verification ---');
    // Price Ascending
    const sortAscRes = await fetch(`${FRONTEND_URL}/api/search?sort=price_asc&limit=6`);
    const sortAscData = await sortAscRes.json();
    const pricesAsc = sortAscData.data.map((p) => Number(p.price));
    for (let i = 0; i < pricesAsc.length - 1; i++) {
      assert(pricesAsc[i] <= pricesAsc[i + 1], `Price ascending sort verified: ${pricesAsc[i]} <= ${pricesAsc[i + 1]}`);
    }

    // Price Descending
    const sortDescRes = await fetch(`${FRONTEND_URL}/api/search?sort=price_desc&limit=6`);
    const sortDescData = await sortDescRes.json();
    const pricesDesc = sortDescData.data.map((p) => Number(p.price));
    for (let i = 0; i < pricesDesc.length - 1; i++) {
      assert(pricesDesc[i] >= pricesDesc[i + 1], `Price descending sort verified: ${pricesDesc[i]} >= ${pricesDesc[i + 1]}`);
    }

    // Name Ascending
    const sortNameRes = await fetch(`${FRONTEND_URL}/api/search?sort=name_asc&limit=5`);
    const sortNameData = await sortNameRes.json();
    const names = sortNameData.data.map((p) => p.name);
    for (let i = 0; i < names.length - 1; i++) {
      assert(names[i].localeCompare(names[i + 1]) <= 0, `Name A-Z sort verified: "${names[i]}" <= "${names[i + 1]}"`);
    }

    // -------------------------------------------------------------------------
    // 15. Pagination works
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Backend Pagination ---');
    const page1Res = await fetch(`${FRONTEND_URL}/api/search?page=1&limit=12&city=Bengaluru`);
    const page1Data = await page1Res.json();
    assert(page1Data.pagination.page === 1, 'Page 1 pagination metadata page = 1');
    assert(page1Data.pagination.totalPages === 3, 'Total pages for 36 items at limit 12 = 3');

    const page2Res = await fetch(`${FRONTEND_URL}/api/search?page=2&limit=12&city=Bengaluru`);
    const page2Data = await page2Res.json();
    assert(page2Data.pagination.page === 2, 'Page 2 pagination metadata page = 2');
    assert(page2Data.data.length === 12, 'Page 2 returns 12 items');
    assert(page1Data.data[0].id !== page2Data.data[0].id, 'Page 2 items are distinct from Page 1 items');

    // -------------------------------------------------------------------------
    // 16. URL query parameters synchronization check
    // -------------------------------------------------------------------------
    console.log('\n--- 16. URL Query Parameters & Route Synchronization ---');
    const appModule = await fetch(`${FRONTEND_URL}/src/pages/ProductsPage.tsx`);
    assert(appModule.status === 200, 'ProductsPage source file accessible and served by Vite');
    const pageSrc = await appModule.text();
    assert(pageSrc.includes('useSearchParams'), 'ProductsPage uses React Router useSearchParams');
    assert(pageSrc.includes('q') && pageSrc.includes('category') && pageSrc.includes('inStock'), 'Syncs q, category, and inStock with URL');

    // -------------------------------------------------------------------------
    // 17. Browser navigation behavior
    // -------------------------------------------------------------------------
    console.log('\n--- 17. Search Debounce & Stale Response Safety ---');
    assert(pageSrc.includes('AbortController'), 'ProductsPage implements AbortController for stale request cancellation');
    assert(pageSrc.includes('setTimeout') && pageSrc.includes('350'), 'Search input has 350ms debounce');

    // -------------------------------------------------------------------------
    // 18. Product details page load
    // -------------------------------------------------------------------------
    console.log('\n--- 18. Product Details (/api/products/:id) ---');
    const firstProduct = defaultSearchData.data[0];
    const detailRes = await fetch(`${FRONTEND_URL}/api/products/${firstProduct.id}`);
    assert(detailRes.status === 200, `GET /api/products/${firstProduct.id} returns HTTP 200`);
    const detailData = await detailRes.json();
    assert(detailData.status === 'ok' && detailData.data.id === firstProduct.id, 'Product details returned for matching ID');
    assert(Array.isArray(detailData.data.inventory) && detailData.data.inventory.length === 5, 'Inventory includes 5 metro cities');

    // -------------------------------------------------------------------------
    // 19. Invalid product ID handled
    // -------------------------------------------------------------------------
    console.log('\n--- 19. Invalid Product ID & 404 Handling ---');
    const invalidIdRes = await fetch(`${FRONTEND_URL}/api/products/not-a-uuid`);
    assert(invalidIdRes.status === 400, 'Invalid UUID rejected with HTTP 400');

    const notFoundIdRes = await fetch(`${FRONTEND_URL}/api/products/00000000-0000-0000-0000-000000000000`);
    assert(notFoundIdRes.status === 404, 'Non-existent UUID returns HTTP 404 Not Found');

    // -------------------------------------------------------------------------
    // 20. Network errors & retry handling
    // -------------------------------------------------------------------------
    console.log('\n--- 20. Error State & Fallback Handling ---');
    const errorStateModule = await fetch(`${FRONTEND_URL}/src/components/common/ErrorState.tsx`);
    assert(errorStateModule.status === 200, 'ErrorState component is available and served');
    const errorStateText = await errorStateModule.text();
    assert(errorStateText.includes('onRetry'), 'ErrorState supports onRetry callback for network errors');

    // -------------------------------------------------------------------------
    // 21. Loading state indicators
    // -------------------------------------------------------------------------
    console.log('\n--- 21. Loading Spinner & Skeleton States ---');
    const loadingModule = await fetch(`${FRONTEND_URL}/src/components/common/LoadingSpinner.tsx`);
    assert(loadingModule.status === 200, 'LoadingSpinner component is available and served');

    // -------------------------------------------------------------------------
    // 22. Mobile filter drawer & responsiveness
    // -------------------------------------------------------------------------
    console.log('\n--- 22. Mobile Filter Controls ---');
    assert(pageSrc.includes('mobileFiltersOpen') && pageSrc.includes('lg:hidden'), 'ProductsPage includes mobile slide-over filter drawer');

    // -------------------------------------------------------------------------
    // 23. Product image fallbacks
    // -------------------------------------------------------------------------
    console.log('\n--- 23. Image Fallback Handling ---');
    const cardModule = await fetch(`${FRONTEND_URL}/src/components/common/ProductCard.tsx`);
    assert(cardModule.status === 200, 'ProductCard component is available and served');
    const cardText = await cardModule.text();
    assert(cardText.includes('image-fallback') && cardText.includes('onError'), 'ProductCard implements onError image fallback handler');

    // -------------------------------------------------------------------------
    // 24. Related products query verification
    // -------------------------------------------------------------------------
    console.log('\n--- 24. Related Products Query ---');
    const apiModule = await fetch(`${FRONTEND_URL}/src/services/api.ts`);
    assert(apiModule.status === 200, 'api.ts is available and served');
    const apiText = await apiModule.text();
    assert(apiText.includes('getRelatedProducts'), 'api.ts exports getRelatedProducts function');

    // -------------------------------------------------------------------------
    // 25. Sprint 9A Regression Check
    // -------------------------------------------------------------------------
    console.log('\n--- 25. Sprint 9A Regression Verification ---');
    const homeRes = await fetch(`${FRONTEND_URL}/`);
    assert(homeRes.status === 200, 'Homepage / route returns HTTP 200');
    const featuredRes = await fetch(`${FRONTEND_URL}/api/products?city=Bengaluru&limit=8`);
    const featuredData = await featuredRes.json();
    assert(featuredData.data.length === 8, 'Homepage featured products endpoint continues to return 8 products');
    assert(featuredData.data[0].city === 'Bengaluru', 'Bengaluru city context verified on homepage products');

    console.log('\n================================================================');
    console.log(`SPRINT 9B TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error during Sprint 9B test execution:', err);
    process.exit(1);
  }
}

runSprint9bTests();

