import { test, expect } from '@playwright/test';

test.describe('Sprint 9H: Smart Warehouse Inventory Notifications, Early Alerts & Bestseller Analytics', () => {
  const timestamp = Date.now();
  const adminEmail = 'admin@hivemart.test';
  const adminPassword = 'AdminPassword123!';
  const customerEmail = `alerts_cust_${timestamp}@hivemart.test`;
  const customerPassword = 'Password123!';
  const retailerEmail = `alerts_retailer_${timestamp}@hivemart.test`;
  const retailerPassword = 'RetailerPassword123!';

  test('1. Customer cannot access Retailer Notification Center and receives Access Denied UI', async ({ page }) => {
    // Clear storage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Register customer
    await page.goto('/register');
    await page.locator('#reg-name, input[name="name"]').first().fill('Alert Customer');
    await page.locator('#reg-email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(customerPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait until registered and logged in
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });
    await page.waitForTimeout(500);

    // Customer attempts to navigate directly to /retailer/notifications
    await page.goto('/retailer/notifications');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=does not have permission to access this page')).toBeVisible();
  });

  test('2. Admin provisions retailer; retailer navigates to Notification Center and views dashboard alerts', async ({ page }) => {
    // Step A: Admin provisions an approved retailer in Bengaluru
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(adminEmail);
    await page.locator('#password, input[name="password"]').first().fill(adminPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL((url) => url.pathname.includes('/admin/dashboard'), { timeout: 10000 });

    // Open Add Retailer modal
    await page.getByRole('button', { name: /Add Retailer/i }).click();
    await expect(page.locator('text=Create Retailer Account')).toBeVisible({ timeout: 5000 });

    // Fill retailer form
    await page.locator('#retailer-name').fill('Alert Hub Retailer');
    await page.locator('#retailer-email').fill(retailerEmail);
    await page.locator('#retailer-password').fill(retailerPassword);
    await page.locator('#retailer-city').selectOption('Bengaluru');
    await page.getByRole('button', { name: 'Create Retailer' }).click();

    await expect(page.locator('text=New retailer created successfully')).toBeVisible({ timeout: 10000 });

    // Step B: Retailer logs in
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(retailerEmail);
    await page.locator('#password, input[name="password"]').first().fill(retailerPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL((url) => url.pathname.includes('/retailer/dashboard'), { timeout: 10000 });
    await expect(page.locator('text=Retailer Store Portal')).toBeVisible({ timeout: 10000 });

    // Verify Smart Inventory Alerts section is visible on Retailer Dashboard
    await expect(page.locator('text=Smart Warehouse Stock Alerts & Early Warnings')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /Out of Stock/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Critical Stock/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Low Stock/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Reorder Soon/i }).first()).toBeVisible();

    // Verify Notification Bell icon in Navbar is visible
    const notificationBell = page.locator('a[href="/retailer/notifications"]').first();
    await expect(notificationBell).toBeVisible({ timeout: 5000 });

    // Click Notification Bell to open Notification Center
    await notificationBell.click();
    await page.waitForURL((url) => url.pathname.includes('/retailer/notifications'), { timeout: 10000 });

    // Verify Notification Center UI
    await expect(page.locator('text=Smart Inventory Alerts & Demand Center')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Warehouse Notifications')).toBeVisible();
    await expect(page.locator('text=Show Unread Only')).toBeVisible();
  });

  test('3. Admin monitors multi-city alerts, bestseller analytics, and edits threshold settings', async ({ page }) => {
    // Admin login
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(adminEmail);
    await page.locator('#password, input[name="password"]').first().fill(adminPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL((url) => url.pathname.includes('/admin/dashboard'), { timeout: 10000 });

    // Verify Multi-City Stock Alerts Oversight section
    await expect(page.locator('text=Multi-City Stock Alerts & Replenishment Oversight')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=City Fulfillment Hub Alert Matrix')).toBeVisible();

    // Verify Cross-City Bestsellers section
    await expect(page.locator('text=Cross-City Monthly Bestsellers & Sales Velocity')).toBeVisible({ timeout: 10000 });

    // Verify Refresh Analytics button works
    const refreshBtn = page.getByRole('button', { name: /Refresh Analytics/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('text=Analytics updated: Daily sales aggregation refreshed successfully.')).toBeVisible({ timeout: 10000 });

    // Verify Product Stock Alert Threshold Configurations section
    await expect(page.locator('text=Product Stock Alert Threshold Configurations')).toBeVisible({ timeout: 10000 });

    // Click "Edit" on the first threshold row
    const editBtns = page.locator('button:has-text("Edit")');
    if (await editBtns.count() > 0) {
      await editBtns.first().click();
      await expect(page.locator('text=Configure Thresholds')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Early Warning Reorder Threshold')).toBeVisible();

      // Attempt to save invalid hierarchy: early < min
      await page.locator('#early-reorder').fill('2');
      await page.locator('#min-stock').fill('10');
      await page.getByRole('button', { name: /Update & Re-evaluate/i }).click();

      // Expect validation error
      await expect(page.locator('text=Hierarchy violated')).toBeVisible({ timeout: 5000 });

      // Correct hierarchy: early = 20, min = 10, crit = 5
      await page.locator('#early-reorder').fill('20');
      await page.locator('#min-stock').fill('10');
      await page.locator('#crit-stock').fill('5');
      await page.getByRole('button', { name: /Update & Re-evaluate/i }).click();

      // Modal closes upon valid save
      await expect(page.locator('text=Configure Thresholds')).not.toBeVisible({ timeout: 5000 });
    }
  });
});
