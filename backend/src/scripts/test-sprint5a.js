const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('=== STARTING SPRINT 5A HEALTH & OPENSEARCH VERIFICATION ===\n');
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
    // 1. Base Health Endpoint
    console.log('--- 1. Testing GET /api/health ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
    const healthBody = await healthRes.json();
    assert(healthBody.status === 'ok' && healthBody.service === 'HiveMart API', 'Returns expected API health payload');
    console.log('  Response:', JSON.stringify(healthBody));

    // 2. Database Health Endpoint
    console.log('\n--- 2. Testing GET /api/health/db ---');
    const dbHealthRes = await fetch(`${BASE_URL}/health/db`);
    assert(dbHealthRes.status === 200, 'GET /api/health/db returns HTTP 200');
    const dbHealthBody = await dbHealthRes.json();
    assert(dbHealthBody.status === 'ok' && dbHealthBody.database === 'connected', 'Returns expected DB health payload');
    assert(!!dbHealthBody.timestamp, `Database timestamp present: ${dbHealthBody.timestamp}`);
    console.log('  Response:', JSON.stringify(dbHealthBody));

    // 3. OpenSearch Health Endpoint
    console.log('\n--- 3. Testing GET /api/health/search ---');
    const searchHealthRes = await fetch(`${BASE_URL}/health/search`);
    assert(searchHealthRes.status === 200, 'GET /api/health/search returns HTTP 200');
    const searchHealthBody = await searchHealthRes.json();
    assert(searchHealthBody.status === 'ok' && searchHealthBody.search === 'connected', 'Returns expected OpenSearch health payload');
    assert(searchHealthBody.service === 'HiveMart OpenSearch', 'Service name matches HiveMart OpenSearch');
    assert(!!searchHealthBody.version, `OpenSearch cluster version verified: ${searchHealthBody.version}`);
    assert(!!searchHealthBody.cluster_name, `OpenSearch cluster name present: ${searchHealthBody.cluster_name}`);
    assert(searchHealthBody.distribution === 'opensearch', 'Distribution verified as opensearch');
    console.log('  Response:', JSON.stringify(searchHealthBody));

    // 4. Verify Existing Routes Still Functional
    console.log('\n--- 4. Verifying Existing Product & Category Routes ---');
    const catRes = await fetch(`${BASE_URL}/categories`);
    assert(catRes.status === 200, 'GET /api/categories returns HTTP 200');
    const prodRes = await fetch(`${BASE_URL}/products?limit=1`);
    assert(prodRes.status === 200, 'GET /api/products returns HTTP 200');

    console.log(`\n========================================`);
    console.log(`SPRINT 5A TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification failed with error:', err);
    process.exit(1);
  }
};

runTests();

