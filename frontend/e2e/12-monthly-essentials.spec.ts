import { test, expect } from '@playwright/test';

test.describe('Sprint 9I: Customer Monthly Essentials & Smart Reminders Journey', () => {
  const timestamp = Date.now();
  const customerEmail = `ess_e2e_${timestamp}@hivemart.test`;
  const customerPassword = 'Password123!';

  test('Customer registers, configures monthly list, adds items, updates quantity, and adds all to cart', async ({
    page,
  }) => {
    // 1. Clear session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Register new customer
    await page.goto('/register');
    await page.locator('#reg-name, input[name="name"]').first().fill('Rohan Essentials User');
    await page.locator('#reg-email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(customerPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait until registered and redirected
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });
    await page.waitForTimeout(500);

    // 3. Navigate to /monthly-essentials
    await page.goto('/monthly-essentials');
    await expect(page.locator('h1')).toContainText('My Monthly Essentials', { timeout: 10000 });
    await expect(page.locator('text=Scheduled Shopping Day')).toBeVisible({ timeout: 5000 });

    // 4. Open Settings modal and update shopping day & reminder days
    const settingsBtn = page.locator('[data-testid="edit-essentials-settings-btn"]');
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click();

    await expect(page.locator('text=Essentials Schedule & Settings')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="setting-shopping-day-input"]').fill('25');
    await page.locator('[data-testid="setting-reminder-days-input"]').fill('4');
    await page.locator('[data-testid="save-essentials-settings-btn"]').click();

    // Verify settings updated
    await expect(page.locator('text=Day 25')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=4 Days')).toBeVisible({ timeout: 5000 });

    // 5. Add a product to the monthly list
    const addProductBtn = page.locator('[data-testid="add-product-to-essentials-btn"], [data-testid="empty-state-add-product-btn"]').first();
    await addProductBtn.click();

    await expect(page.locator('text=Add Product to Monthly Essentials')).toBeVisible({ timeout: 5000 });

    // Select the first product available in the modal list
    const firstProductOption = page.locator('form button[type="button"]').first();
    await expect(firstProductOption).toBeVisible({ timeout: 5000 });
    await firstProductOption.click();

    await page.locator('[data-testid="item-quantity-input"]').fill('2');
    await page.locator('[data-testid="confirm-add-item-btn"]').click();

    // 6. Verify product is rendered in the items table
    await expect(page.locator('[data-testid="essentials-table"]')).toBeVisible({ timeout: 8000 });
    const qtyVal = page.locator('[data-testid^="qty-val-"]').first();
    await expect(qtyVal).toHaveText('2', { timeout: 5000 });

    // 7. Update quantity using stepper '+'
    const increaseBtn = page.getByTitle('Increase quantity').first();
    await increaseBtn.click();
    await page.waitForTimeout(600);
    await expect(qtyVal).toHaveText('3', { timeout: 5000 });

    // 8. Click 'Add All to Cart'
    const addAllBtn = page.locator('[data-testid="add-all-to-cart-btn"]').first();
    await addAllBtn.click();

    // 9. Verify Cart Result Modal
    await expect(page.locator('text=Essentials Added to Cart!')).toBeVisible({ timeout: 10000 });
    const proceedCartBtn = page.locator('[data-testid="proceed-to-cart-btn"]');
    await expect(proceedCartBtn).toBeVisible({ timeout: 5000 });

    // 10. Click 'View Shopping Cart' and verify cart has items
    await proceedCartBtn.click();
    await page.waitForURL((url) => url.pathname.includes('/cart'), { timeout: 10000 });

    // Verify in cart
    await expect(page.locator('h1')).toContainText('Shopping Cart', { timeout: 8000 });
    await expect(page.locator('text=Order Summary')).toBeVisible({ timeout: 8000 });
  });

  test('Customer sees My Monthly Essentials link in account page and navbar dropdown', async ({ page }) => {
    // Login with previously registered customer
    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#password, input[name="password"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Navigate to /account
    await page.goto('/account');
    const essentialsLink = page.locator('[data-testid="account-monthly-essentials-link"]');
    await expect(essentialsLink).toBeVisible({ timeout: 8000 });
    await essentialsLink.click();

    await page.waitForURL((url) => url.pathname.includes('/monthly-essentials'), { timeout: 8000 });
    await expect(page.locator('h1')).toContainText('My Monthly Essentials');
  });
});
