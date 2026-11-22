import { test, expect } from '@playwright/test';

test.describe('Sprint 9G: Offline Retail POS Terminal & Centralized Inventory Concurrency', () => {
  const timestamp = Date.now();
  const adminEmail = 'admin@hivemart.test';
  const adminPassword = 'AdminPassword123!';
  const customerEmail = `pos_cust_${timestamp}@hivemart.test`;
  const customerPassword = 'Password123!';
  const retailerEmail = `pos_retailer_e2e_${timestamp}@hivemart.test`;
  const retailerPassword = 'RetailerPassword123!';

  test('1. Customer cannot access POS Terminal or Retailer Bills and receives Access Denied UI', async ({ page }) => {
    // Clear storage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Register customer
    await page.goto('/register');
    await page.locator('#reg-name, input[name="name"]').first().fill('Regular Customer');
    await page.locator('#reg-email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(customerPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait until registered and logged in
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });
    await page.waitForTimeout(500);

    // Customer attempts to navigate directly to /retailer/pos
    await page.goto('/retailer/pos');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=does not have permission to access this page')).toBeVisible();

    // Customer attempts to navigate directly to /retailer/bills
    await page.goto('/retailer/bills');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=does not have permission to access this page')).toBeVisible();
  });

  test('2. Retailer logs in, launches POS Terminal, adds products, finalizes bill, and views receipt', async ({ page }) => {
    // Setup: Administrator provisions an approved retailer in Bengaluru
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
    await page.locator('#retailer-name').fill('E2E POS Retailer');
    await page.locator('#retailer-email').fill(retailerEmail);
    await page.locator('#retailer-password').fill(retailerPassword);
    await page.locator('#retailer-city').selectOption('Bengaluru');
    await page.getByRole('button', { name: 'Create Retailer' }).click();

    // Wait for success toast / retailer creation
    await expect(page.locator('text=New retailer created successfully')).toBeVisible({ timeout: 10000 });

    // Retailer logs in
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(retailerEmail);
    await page.locator('#password, input[name="password"]').first().fill(retailerPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify retailer redirected to /retailer/dashboard
    await page.waitForURL((url) => url.pathname.includes('/retailer/dashboard'), { timeout: 10000 });
    await expect(page.locator('text=Retailer Store Portal')).toBeVisible({ timeout: 10000 });

    // Click "Launch POS Terminal" from Retailer Dashboard
    await page.getByRole('link', { name: /Launch POS Terminal/i }).first().click();
    await page.waitForURL((url) => url.pathname.includes('/retailer/pos'), { timeout: 10000 });

    // Verify POS Terminal Header & Hub
    await expect(page.locator('text=In-Store POS Terminal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Warehouse: Bengaluru')).toBeVisible();

    // Add first available product
    const addButtons = page.locator('button:has-text("Add")');
    await expect(addButtons.first()).toBeVisible({ timeout: 10000 });
    await addButtons.first().click();

    // Verify item added to draft bill
    await expect(page.locator('text=Bill #HVM-BLR-').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Remove').first()).toBeVisible();

    // Select payment method (e.g., Cash)
    await page.getByRole('button', { name: 'Cash' }).click();
    await page.waitForTimeout(500);

    // Enter optional reference
    const notesInput = page.locator('input[placeholder*="customer reference"]');
    if (await notesInput.isVisible()) {
      await notesInput.fill('Playwright in-store retail checkout');
      await notesInput.blur();
      await page.waitForTimeout(500);
    }

    // Click Finalize & Deduct Warehouse Stock
    const finalizeBtn = page.getByRole('button', { name: /Finalize & Deduct Warehouse Stock/i });
    await expect(finalizeBtn).toBeEnabled({ timeout: 10000 });
    await finalizeBtn.click();

    // Verify confirmation modal opens
    await expect(page.locator('text=Confirm Final Bill Finalization')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Centralized Warehouse Stock Deduction')).toBeVisible();

    // Confirm finalization
    await page.getByRole('button', { name: 'Confirm & Finalize' }).click();

    // Verify Finalized Receipt View is displayed
    await expect(page.locator('text=Bill Finalized & Warehouse Stock Deducted')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=FINALIZED').first()).toBeVisible();
    await expect(page.locator('text=Print Receipt').first()).toBeVisible();

    // Navigate to Store Bills history
    await page.getByRole('link', { name: 'View All Store Bills' }).click();
    await page.waitForURL((url) => url.pathname.includes('/retailer/bills'), { timeout: 10000 });

    // Verify bill appears in table
    await expect(page.locator('text=Store Invoices & Bills')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=FINALIZED').first()).toBeVisible();

    // Click "View" to open detailed receipt
    await page.locator('a:has-text("View")').first().click();
    await page.waitForURL((url) => url.pathname.includes('/retailer/bills/'), { timeout: 10000 });
    await expect(page.locator('text=Print Receipt').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Grand Total')).toBeVisible();
  });
});
