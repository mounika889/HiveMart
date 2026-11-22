import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

async function runSprint9aVerification() {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9A FRONTEND & API INTEGRATION TEST SUITE ===');
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
    // 1. Verify Vite dev server serves index.html
    console.log('--- 1. Testing Frontend Dev Server & HTML Entry ---');
    const htmlRes = await fetch(`${BASE_URL}/`);
    assert(htmlRes.status === 200, 'Frontend server returns HTTP 200 on /');
    const htmlText = await htmlRes.text();
    assert(htmlText.includes('<div id="root"></div>'), 'HTML entry contains React root container (#root)');
    assert(htmlText.includes('HiveMart — Your City. Your Cart. Your Hive.'), 'HTML title contains brand name and tagline');
    assert(htmlText.includes('/src/main.tsx'), 'HTML entry imports /src/main.tsx module');
    assert(htmlText.includes('hive-icon.svg'), 'HTML entry links brand favicon');

    // 2. Verify Vite module resolution
    console.log('\n--- 2. Testing React & TypeScript Module Resolution ---');
    const mainModuleRes = await fetch(`${BASE_URL}/src/main.tsx`);
    assert(mainModuleRes.status === 200, 'Vite successfully transforms and serves /src/main.tsx');
    const mainText = await mainModuleRes.text();
    assert(mainText.includes('ReactDOM.createRoot'), 'React root renderer initialized');

    const appModuleRes = await fetch(`${BASE_URL}/src/App.tsx`);
    assert(appModuleRes.status === 200, 'Vite successfully transforms and serves /src/App.tsx');
    const appText = await appModuleRes.text();
    assert(appText.includes('CityProvider'), 'App wraps application in CityProvider context');
    assert(appText.includes('Navbar') && appText.includes('Footer'), 'App renders responsive Navbar and Footer');

    // 3. Verify Backend API Proxying via Vite
    console.log('\n--- 3. Testing Backend Health through Frontend API Proxy ---');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, 'Vite reverse proxy forwards /api/health to Express backend');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok' && healthData.service === 'HiveMart API', 'Backend API reports status ok');

    // 4. Verify Categories Loading
    console.log('\n--- 4. Testing Category Integration (/api/categories) ---');
    const categoriesRes = await fetch(`${BASE_URL}/api/categories`);
    assert(categoriesRes.status === 200, 'GET /api/categories returns HTTP 200');
    const categoriesData = await categoriesRes.json();
    assert(categoriesData.status === 'ok' && Array.isArray(categoriesData.data), 'Categories data is an array');
    assert(categoriesData.data.length >= 6, `Categories count >= 6 (found ${categoriesData.data.length})`);
    const categoryNames = categoriesData.data.map((c) => c.category);
    assert(categoryNames.includes('Electronics') && categoryNames.includes('Fashion'), 'Contains expected Indian retail categories');

    // 5. Verify Products Loading with City Stock (Bengaluru)
    console.log('\n--- 5. Testing Featured Products with City Context (Bengaluru) ---');
    const prodBlrRes = await fetch(`${BASE_URL}/api/products?city=Bengaluru&limit=8`);
    assert(prodBlrRes.status === 200, 'GET /api/products?city=Bengaluru returns HTTP 200');
    const prodBlrData = await prodBlrRes.json();
    assert(prodBlrData.status === 'ok' && Array.isArray(prodBlrData.data), 'Products data is an array');
    assert(prodBlrData.data.length === 8, `Returns 8 featured products (found ${prodBlrData.data.length})`);

    const sampleBlr = prodBlrData.data[0];
    assert(!!sampleBlr.name && !!sampleBlr.category, 'Product has valid name and category');
    assert(typeof sampleBlr.city_stock === 'number', `Product has numeric city_stock for Bengaluru (stock: ${sampleBlr.city_stock})`);
    assert(sampleBlr.city === 'Bengaluru', 'Product confirms city context matches Bengaluru');
    assert(parseFloat(sampleBlr.price) > 0, `Product price formatted in positive INR (price: ₹${sampleBlr.price})`);

    // 6. Verify Dynamic City Context Switching (Mumbai)
    console.log('\n--- 6. Testing Dynamic City Switching (Mumbai) ---');
    const prodBomRes = await fetch(`${BASE_URL}/api/products?city=Mumbai&limit=8`);
    assert(prodBomRes.status === 200, 'GET /api/products?city=Mumbai returns HTTP 200');
    const prodBomData = await prodBomRes.json();
    assert(prodBomData.status === 'ok' && prodBomData.data.length === 8, 'Returns 8 featured products for Mumbai');
    const sampleBom = prodBomData.data[0];
    assert(sampleBom.city === 'Mumbai', 'Product confirms city context dynamically switched to Mumbai');
    assert(typeof sampleBom.city_stock === 'number', `Product has valid city_stock for Mumbai (stock: ${sampleBom.city_stock})`);

    // 7. Verify Single Product Details & 5-City Breakdown
    console.log('\n--- 7. Testing Product Details Page Data (/api/products/:id) ---');
    const singleProdRes = await fetch(`${BASE_URL}/api/products/${sampleBlr.id}`);
    assert(singleProdRes.status === 200, `GET /api/products/${sampleBlr.id} returns HTTP 200`);
    const singleProdData = await singleProdRes.json();
    assert(singleProdData.status === 'ok' && singleProdData.data.id === sampleBlr.id, 'Product details match requested ID');
    assert(Array.isArray(singleProdData.data.inventory) && singleProdData.data.inventory.length === 5, 'Inventory breakdown includes all 5 metro cities');
    const inventoryCities = singleProdData.data.inventory.map((i) => i.city);
    assert(
      ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi'].every((c) => inventoryCities.includes(c)),
      'Inventory covers Bengaluru, Hyderabad, Chennai, Mumbai, and Delhi'
    );

    // 8. Verify Supported Cities Configuration
    console.log('\n--- 8. Testing Supported Cities Configuration ---');
    const cityContextRes = await fetch(`${BASE_URL}/src/types/index.ts`);
    assert(cityContextRes.status === 200, 'Types module accessible');
    const typesText = await cityContextRes.text();
    assert(
      typesText.includes('Bengaluru') &&
      typesText.includes('Hyderabad') &&
      typesText.includes('Chennai') &&
      typesText.includes('Mumbai') &&
      typesText.includes('Delhi'),
      'SUPPORTED_CITIES contains all 5 required cities'
    );

    // 9. Summary
    console.log('\n================================================================');
    console.log(`SPRINT 9A TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  }
}

runSprint9aVerification();

