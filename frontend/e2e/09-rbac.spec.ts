import { test, expect } from '@playwright/test';

test.describe('Sprint 9F: Role-Based Access Control & Dashboards', () => {
  const timestamp = Date.now();
  const adminEmail = 'admin@hivemart.test';
  const adminPassword = 'AdminPassword123!';
  const customerEmail = `customer_rbac_${timestamp}@hivemart.test`;
  const customerPassword = 'Password123!';
  const retailerEmail = `retailer_e2e_${timestamp}@hivemart.test`;
  const retailerPassword = 'RetailerPassword123!';

  test('1. Customer cannot access Admin or Retailer Dashboard and receives Access Denied UI', async ({ page }) => {
    // Register customer
    await page.goto('/register');
    await page.locator('#reg-name, input[name="name"]').first().fill('RBAC Shopper');
    await page.locator('#reg-email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(customerPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait until registered and logged in
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });

    // Customer attempts to navigate directly to /admin/dashboard
    await page.goto('/admin/dashboard');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=does not have permission to access this page')).toBeVisible();

    // Customer attempts to navigate directly to /retailer/dashboard
    await page.goto('/retailer/dashboard');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=does not have permission to access this page')).toBeVisible();
  });

  test('2. Administrator logs in, accesses Admin Dashboard, and creates new retailer partner', async ({ page }) => {
    // Clear session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Log in as administrator
    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(adminEmail);
    await page.locator('#password, input[name="password"]').first().fill(adminPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify redirection to /admin/dashboard
    await page.waitForURL((url) => url.pathname.includes('/admin/dashboard'), { timeout: 10000 });
    await expect(page.locator('text=Administrator Control Center')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Platform Management & Operations')).toBeVisible();

    // Verify key platform metrics
    await expect(page.locator('text=Total Customers')).toBeVisible();
    await expect(page.locator('text=Active Catalog')).toBeVisible();
    await expect(page.locator('text=City Warehouse Inventory Status')).toBeVisible();
    await expect(page.locator('text=Retailer Network Management')).toBeVisible();

    // Open "Add Retailer" modal
    await page.getByRole('button', { name: /Add Retailer/i }).click();
    await expect(page.locator('text=Create Retailer Account')).toBeVisible();

    // Fill form
    await page.locator('#retailer-name').fill('Bengaluru E2E Partner');
    await page.locator('#retailer-email').fill(retailerEmail);
    await page.locator('#retailer-password').fill(retailerPassword);
    await page.locator('#retailer-city').selectOption('Bengaluru');
    await page.getByRole('button', { name: 'Create Retailer' }).click();

    // Wait for success banner or modal close
    await expect(page.locator('text=New retailer created successfully')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${retailerEmail}`)).toBeVisible();
  });

  test('3. Retailer logs in and accesses Retailer Dashboard with city hub inventory', async ({ page }) => {
    // Clear session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Log in as newly created retailer
    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(retailerEmail);
    await page.locator('#password, input[name="password"]').first().fill(retailerPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify redirection to /retailer/dashboard
    await page.waitForURL((url) => url.pathname.includes('/retailer/dashboard'), { timeout: 10000 });
    await expect(page.locator('text=Retailer Store Portal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=City Hub: Bengaluru')).toBeVisible();

    // Verify inventory elements and POS Sprint 9G preview banner
    await expect(page.locator('text=Sprint 9G Preview — Coming Next')).toBeVisible();
    await expect(page.locator('text=Offline Retail Point of Sale (POS) Terminal')).toBeVisible();
    await expect(page.locator('text=City Warehouse Inventory')).toBeVisible();
  });
});
