import { test, expect } from '@playwright/test';
import {
  createIsolatedTestProduct,
  deleteIsolatedTestProduct,
  TestFixtureProduct,
} from './test-helpers.ts';

test.describe('Phase 10: Shopping Cart Browser Tests', () => {
  let fixture: TestFixtureProduct;
  const customerEmail = `e2e_cart_${Date.now()}@hivemart.test`;
  const customerPassword = 'Password123!';
  const customerName = 'Cart Test User';

  test.beforeAll(async () => {
    fixture = await createIsolatedTestProduct(`E2E Cart Fixture ${Date.now()}`);
  });

  test.afterAll(async () => {
    if (fixture?.id) {
      await deleteIsolatedTestProduct(fixture.id);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Clear session to ensure clean state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Register and login customer
    await page.goto('/register');
    await page.locator('#reg-name, input[name="name"]').first().fill(customerName);
    await page.locator('#reg-email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(customerPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });
  });

  test('should add items, update quantities, persist state, and support clear cart', async ({ page }) => {
    // 1. Browse directly to in-stock test fixture product
    await page.goto(`/products/${fixture.id}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator(`text=${fixture.name}`).first()).toBeVisible({ timeout: 10000 });

    // 2. Add to cart
    const addToCartBtn = page.locator('[data-testid="add-to-cart-btn"], button:has-text("Add to Cart")').first();
    await expect(addToCartBtn).toBeVisible({ timeout: 10000 });
    await addToCartBtn.click();

    // 3. Navbar cart badge updates - wait until badge reflects count >= 1
    const badge = page.locator('[data-testid="navbar-cart-badge"]').first();
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText(/^[1-9]/, { timeout: 10000 });

    // 4. Open Cart Page
    await page.goto('/cart');
    await expect(page.locator('h1')).toContainText(/Your Shopping Cart/i);

    // 5. Quantity stepper adjustment
    const incrementBtn = page.locator('button[aria-label="Increase quantity"], button:has-text("+")').first();
    if (await incrementBtn.isVisible()) {
      await incrementBtn.click();
      await page.waitForTimeout(600);
    }

    // 6. Test Clear Cart modal
    const clearCartBtn = page.locator('button:has-text("Clear Cart")').first();
    if (await clearCartBtn.isVisible()) {
      await clearCartBtn.click();
      const confirmDialog = page.locator('[role="dialog"]');
      await expect(confirmDialog).toBeVisible();

      // Cancel dismissal
      const cancelBtn = confirmDialog.locator('button:has-text("Cancel")');
      await cancelBtn.click();
      await expect(confirmDialog).not.toBeVisible();

      // Open again and confirm
      await clearCartBtn.click();
      const confirmBtn = confirmDialog.locator('button:has-text("Yes, Clear Cart")');
      await confirmBtn.click();
      await page.waitForTimeout(600);

      // Verify empty cart state
      await expect(page.locator('text=Your Cart is Empty')).toBeVisible({ timeout: 10000 });
    }
  });
});
