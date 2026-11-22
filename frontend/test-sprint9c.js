import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = 'http://127.0.0.1:3000';
const BACKEND_URL = 'http://127.0.0.1:5000/api';

async function runSprint9cTests() {
  console.log('================================================================');
  console.log('=== STARTING SPRINT 9C CUSTOMER AUTH & SECURITY TEST SUITE ===');
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
    // 1. Frontend Route Accessibility & HTML Entry
    // -------------------------------------------------------------------------
    console.log('--- 1. Frontend Routes & HTML Delivery ---');
    const loginHtmlRes = await fetch(`${FRONTEND_URL}/login`);
    assert(loginHtmlRes.status === 200, 'Route /login returns HTTP 200 from frontend dev server');
    const loginHtmlText = await loginHtmlRes.text();
    assert(loginHtmlText.includes('<div id="root"></div>'), 'Login HTML entry contains React root container (#root)');

    const registerHtmlRes = await fetch(`${FRONTEND_URL}/register`);
    assert(registerHtmlRes.status === 200, 'Route /register returns HTTP 200 from frontend dev server');

    const accountHtmlRes = await fetch(`${FRONTEND_URL}/account`);
    assert(accountHtmlRes.status === 200, 'Route /account returns HTTP 200 from frontend dev server');

    // -------------------------------------------------------------------------
    // 2. Vite Module Resolution & Source Code Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Vite Module Resolution & Source Verification ---');
    const authServiceRes = await fetch(`${FRONTEND_URL}/src/services/auth.ts`);
    assert(authServiceRes.status === 200, 'Vite successfully transforms and serves /src/services/auth.ts');
    const authServiceContent = await authServiceRes.text();
    assert(authServiceContent.includes('registerUser'), 'auth.ts exports registerUser');
    assert(authServiceContent.includes('loginUser'), 'auth.ts exports loginUser');
    assert(authServiceContent.includes('getCurrentUser'), 'auth.ts exports getCurrentUser');
    assert(authServiceContent.includes('getStoredToken'), 'auth.ts provides getStoredToken storage helper');

    const authContextRes = await fetch(`${FRONTEND_URL}/src/context/AuthContext.tsx`);
    assert(authContextRes.status === 200, 'Vite successfully transforms and serves /src/context/AuthContext.tsx');
    const authContextContent = await authContextRes.text();
    assert(authContextContent.includes('AuthProvider'), 'AuthContext provides AuthProvider');
    assert(authContextContent.includes('useAuth'), 'AuthContext exports useAuth');
    assert(authContextContent.includes('isAuthenticated'), 'AuthContext tracks isAuthenticated state');

    const protectedRouteRes = await fetch(`${FRONTEND_URL}/src/components/auth/ProtectedRoute.tsx`);
    assert(protectedRouteRes.status === 200, 'Vite successfully transforms and serves ProtectedRoute.tsx');
    const protectedRouteSrc = fs.readFileSync(path.join(__dirname, 'src/components/auth/ProtectedRoute.tsx'), 'utf8');
    assert(protectedRouteSrc.includes('Navigate to="/login"'), 'ProtectedRoute redirects unauthenticated visitors to /login');
    assert(protectedRouteSrc.includes('state={{ from: location }}'), 'ProtectedRoute saves original destination in location.state');

    // -------------------------------------------------------------------------
    // 3. Registration Form & Client Validation
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Registration Form Verification ---');
    const registerPageRes = await fetch(`${FRONTEND_URL}/src/pages/RegisterPage.tsx`);
    assert(registerPageRes.status === 200, 'RegisterPage component served cleanly');
    const registerPageSrc = fs.readFileSync(path.join(__dirname, 'src/pages/RegisterPage.tsx'), 'utf8');
    assert(registerPageSrc.includes('Create Account'), 'RegisterPage displays Create Account heading');
    assert(registerPageSrc.includes('name="name"') || registerPageSrc.includes('id="reg-name"'), 'Registration form contains Full Name field');
    assert(registerPageSrc.includes('name="email"') || registerPageSrc.includes('id="reg-email"'), 'Registration form contains Email Address field');
    assert(registerPageSrc.includes('name="password"') || registerPageSrc.includes('id="reg-password"'), 'Registration form contains Password field');
    assert(registerPageSrc.includes('confirmPassword') || registerPageSrc.includes('reg-confirm-password'), 'Registration form contains Confirm Password field');
    assert(registerPageSrc.includes('showPassword') && registerPageSrc.includes('setShowPassword'), 'Registration form supports toggling password visibility');
    assert(registerPageSrc.includes('Passwords do not match'), 'Registration form implements password match confirmation validation');

    // -------------------------------------------------------------------------
    // 4. Login Form Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Login Form Verification ---');
    const loginPageRes = await fetch(`${FRONTEND_URL}/src/pages/LoginPage.tsx`);
    assert(loginPageRes.status === 200, 'LoginPage component served cleanly');
    const loginPageSrc = fs.readFileSync(path.join(__dirname, 'src/pages/LoginPage.tsx'), 'utf8');
    assert(loginPageSrc.includes('Welcome Back'), 'LoginPage displays Welcome Back heading');
    assert(loginPageSrc.includes('name="email"') || loginPageSrc.includes('id="email"'), 'Login form contains Email field');
    assert(loginPageSrc.includes('name="password"') || loginPageSrc.includes('id="password"'), 'Login form contains Password field');
    assert(loginPageSrc.includes('showPassword') && loginPageSrc.includes('setShowPassword'), 'Login form supports toggling password visibility');
    assert(loginPageSrc.includes('destination'), 'LoginPage redirects to location.state destination on login success');

    // -------------------------------------------------------------------------
    // 5. Account Profile Page Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Account Profile Page Verification ---');
    const accountPageRes = await fetch(`${FRONTEND_URL}/src/pages/AccountPage.tsx`);
    assert(accountPageRes.status === 200, 'AccountPage component served cleanly');
    const accountPageSrc = fs.readFileSync(path.join(__dirname, 'src/pages/AccountPage.tsx'), 'utf8');
    assert(accountPageSrc.includes('My Account'), 'AccountPage displays My Account title');
    assert(accountPageSrc.includes('user?.name'), 'AccountPage displays customer name');
    assert(accountPageSrc.includes('user?.email'), 'AccountPage displays customer email');
    assert(accountPageSrc.includes('user?.role'), 'AccountPage displays customer role');
    assert(accountPageSrc.includes('handleLogout') || accountPageSrc.includes('logout'), 'AccountPage provides Sign Out button');
    assert(accountPageSrc.includes('selectedCity'), 'AccountPage shows delivery city preference');

    // -------------------------------------------------------------------------
    // 6. Real Backend Registration API (POST /api/auth/register)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Live Registration API Integration ---');
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const testUserA = {
      name: `Test Customer ${uniqueId}`,
      email: `test_customer_${uniqueId}@example.com`,
      password: `SecurePass#${uniqueId}`,
    };

    // Test 6a: Validation failure on short name
    const shortNameRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: testUserA.email, password: testUserA.password }),
    });
    assert(shortNameRes.status === 400, 'Registration with <2 character name returns HTTP 400');
    const shortNameData = await shortNameRes.json();
    assert(shortNameData.message.includes('at least 2 characters'), 'Returns descriptive validation message for short name');

    // Test 6b: Validation failure on invalid email
    const invalidEmailRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testUserA.name, email: 'not-an-email', password: testUserA.password }),
    });
    assert(invalidEmailRes.status === 400, 'Registration with invalid email format returns HTTP 400');

    // Test 6c: Validation failure on short password (< 6 chars)
    const shortPassRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testUserA.name, email: testUserA.email, password: '123' }),
    });
    assert(shortPassRes.status === 400, 'Registration with <6 character password returns HTTP 400');

    // Test 6d: Successful registration
    const registerRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserA),
    });
    assert(registerRes.status === 201, 'Valid customer registration returns HTTP 201 Created');
    const registerData = await registerRes.json();
    assert(registerData.status === 'ok', 'Registration response status is "ok"');
    assert(registerData.data && registerData.data.token, 'Registration returns signed JWT token');
    assert(registerData.data.user && registerData.data.user.id, 'Registration returns created user record with UUID');
    assert(registerData.data.user.email === testUserA.email.toLowerCase(), 'Registered user email matches normalized email');
    assert(registerData.data.user.name === testUserA.name, 'Registered user name matches provided name');
    assert(registerData.data.user.role === 'customer', 'Registered user role strictly defaults to "customer"');
    assert(!registerData.data.user.password_hash, 'Password hash is strictly omitted from user payload');

    const userAToken = registerData.data.token;
    const userAProfile = registerData.data.user;

    // Test 6e: Duplicate registration rejected
    const duplicateRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserA),
    });
    assert(duplicateRes.status === 409, 'Duplicate email registration returns HTTP 409 Conflict');
    const duplicateData = await duplicateRes.json();
    assert(duplicateData.message === 'Email is already registered.', 'Returns clear duplicate email rejection message');

    // -------------------------------------------------------------------------
    // 7. Live Login API Integration (POST /api/auth/login)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Live Login API Integration ---');
    // Test 7a: Successful login with correct credentials
    const loginRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserA.email, password: testUserA.password }),
    });
    assert(loginRes.status === 200, 'Login with correct credentials returns HTTP 200 OK');
    const loginData = await loginRes.json();
    assert(loginData.status === 'ok', 'Login response status is "ok"');
    assert(loginData.data && loginData.data.token, 'Login returns valid JWT token');
    assert(loginData.data.user.id === userAProfile.id, 'Logged in user ID matches registered user ID');
    assert(loginData.data.user.email === testUserA.email.toLowerCase(), 'Logged in user email matches');
    assert(!loginData.data.user.password_hash, 'Password hash is strictly omitted from login payload');

    // Test 7b: Invalid password returns 401
    const wrongPassRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserA.email, password: 'WrongPassword123!' }),
    });
    assert(wrongPassRes.status === 401, 'Login with incorrect password returns HTTP 401 Unauthorized');
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassData.message === 'Invalid email or password.', 'Returns safe non-enumerating error message');

    // Test 7c: Non-existent email returns 401
    const nonExistentRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'non_existent_9999@example.com', password: 'SomePassword' }),
    });
    assert(nonExistentRes.status === 401, 'Login with non-existent email returns HTTP 401 Unauthorized');
    const nonExistentData = await nonExistentRes.json();
    assert(nonExistentData.message === 'Invalid email or password.', 'Returns identical generic error message preventing user enumeration');

    // -------------------------------------------------------------------------
    // 8. Session Verification & Profile Fetch (GET /api/auth/me)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Session Verification (GET /api/auth/me) ---');
    // Test 8a: Valid Bearer token retrieves profile
    const meRes = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(meRes.status === 200, 'GET /api/auth/me with valid Bearer token returns HTTP 200');
    const meData = await meRes.json();
    assert(meData.status === 'ok', 'GET /api/auth/me returns status "ok"');
    assert(meData.data.user.id === userAProfile.id, 'User profile ID matches token owner');
    assert(meData.data.user.name === testUserA.name, 'User profile name matches');
    assert(meData.data.user.role === 'customer', 'User profile role is "customer"');

    // Test 8b: Request without token returns 401
    const noTokenRes = await fetch(`${FRONTEND_URL}/api/auth/me`);
    assert(noTokenRes.status === 401, 'GET /api/auth/me without token returns HTTP 401');

    // Test 8c: Request with malformed/invalid token returns 401
    const invalidTokenRes = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.tampered.token' },
    });
    assert(invalidTokenRes.status === 401, 'GET /api/auth/me with invalid token returns HTTP 401');

    // -------------------------------------------------------------------------
    // 9. Customer Data Isolation & Cross-Session Boundary
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Customer Data Isolation Testing ---');
    const uniqueIdB = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`;
    const testUserB = {
      name: `Second Customer ${uniqueIdB}`,
      email: `second_customer_${uniqueIdB}@example.com`,
      password: `PassSecret#${uniqueIdB}`,
    };

    const registerBRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserB),
    });
    assert(registerBRes.status === 201, 'Second independent customer registered successfully');
    const userBData = await registerBRes.json();
    const userBToken = userBData.data.token;
    const userBProfile = userBData.data.user;

    assert(userBProfile.id !== userAProfile.id, 'Customer A and Customer B have distinct UUIDs');

    // Verify User B's token returns User B's profile only
    const meBRes = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const meBData = await meBRes.json();
    assert(meBData.data.user.id === userBProfile.id, 'User B token strictly returns User B profile');
    assert(meBData.data.user.id !== userAProfile.id, 'Customer A profile is completely isolated from Customer B session');

    // -------------------------------------------------------------------------
    // 10. Navbar Integration & Dynamic Session State
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Navbar Navigation State Integration ---');
    const navbarRes = await fetch(`${FRONTEND_URL}/src/components/layout/Navbar.tsx`);
    assert(navbarRes.status === 200, 'Navbar component served by Vite');
    const navbarContent = await navbarRes.text();
    assert(navbarContent.includes('useAuth'), 'Navbar integrates useAuth hook');
    assert(navbarContent.includes('isAuthenticated'), 'Navbar reads isAuthenticated state');
    assert(navbarContent.includes('Sign In'), 'Navbar displays "Sign In" button when unauthenticated');
    assert(navbarContent.includes('userDropdownOpen') || navbarContent.includes('userInitials'), 'Navbar renders avatar / user profile dropdown when authenticated');
    assert(navbarContent.includes('My Account'), 'Navbar dropdown includes "My Account" link');
    assert(navbarContent.includes('My Orders'), 'Navbar dropdown includes "My Orders" link');
    assert(navbarContent.includes('Sign Out'), 'Navbar dropdown includes "Sign Out" action');
    assert(navbarContent.includes('handleLogout') || navbarContent.includes('logout()'), 'Navbar triggers logout on sign out');

    // -------------------------------------------------------------------------
    // 11. Security Audit & Client Token Governance
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Security Audit & Best Practices ---');
    // Ensure frontend source files do NOT contain JWT_SECRET or hardcoded tokens
    const appTsx = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
    assert(!appTsx.includes('JWT_SECRET'), 'App.tsx does not contain JWT_SECRET');

    const authTs = fs.readFileSync(path.join(__dirname, 'src/services/auth.ts'), 'utf8');
    assert(!authTs.includes('JWT_SECRET'), 'auth.ts does not contain JWT_SECRET');
    assert(!authTs.includes('console.log(token'), 'auth.ts does not log tokens');

    const loginTsx = fs.readFileSync(path.join(__dirname, 'src/pages/LoginPage.tsx'), 'utf8');
    assert(!loginTsx.includes('console.log(password'), 'LoginPage does not log passwords');

    // -------------------------------------------------------------------------
    // 12. Design System & Palette Compliance
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Design System & Brand Palette Verification ---');
    const tailwindConfig = fs.readFileSync(path.join(__dirname, 'tailwind.config.js'), 'utf8');
    assert(tailwindConfig.includes('#14213D'), 'Tailwind config defines Navy (#14213D)');
    assert(tailwindConfig.includes('#0B1730'), 'Tailwind config defines Deep Navy (#0B1730)');
    assert(tailwindConfig.includes('#F5B700'), 'Tailwind config defines Honey Yellow (#F5B700)');
    assert(tailwindConfig.includes('#FFF4CC'), 'Tailwind config defines Soft Honey (#FFF4CC)');
    assert(tailwindConfig.includes('#F8FAFC'), 'Tailwind config defines Background (#F8FAFC)');

    // -------------------------------------------------------------------------
    // 13. Sprint 9A and 9B Regression Checks
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Regression Check: Catalog and Search APIs ---');
    const healthRes = await fetch(`${FRONTEND_URL}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');

    const productsRes = await fetch(`${FRONTEND_URL}/api/products?city=Bengaluru&limit=4`);
    assert(productsRes.status === 200, 'GET /api/products returns HTTP 200');
    const productsData = await productsRes.json();
    assert(productsData.data.length === 4, 'Products endpoint delivers active catalog items');

    const searchRes = await fetch(`${FRONTEND_URL}/api/search?q=coffee&city=Bengaluru`);
    assert(searchRes.status === 200, 'OpenSearch endpoint GET /api/search returns HTTP 200');

    console.log('\n================================================================');
    console.log(`SPRINT 9C TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Sprint 9C test execution:', err);
    process.exit(1);
  }
}

runSprint9cTests();
