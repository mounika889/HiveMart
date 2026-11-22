import { test, expect } from '@playwright/test';
import {
  createIsolatedTestProduct,
  deleteIsolatedTestProduct,
  cleanupTestUsersAndOrders,
  TestFixtureProduct,
} from './test-helpers.ts';

test.describe('Phase 11: Real Browser Checkout & Idempotency Tests (Isolated Fixtures)', () => {
  let fixture: TestFixtureProduct;
  const userPrefix = `e2e_chk_${Date.now()}`;
  const customerEmail = `${userPrefix}@hivemart.test`;
  const customerPassword = 'Password123!';
  const customerName = 'Checkout Test User';

  test.beforeAll(async () => {
    // Phase 5: Create isolated temporary product to preserve original catalog inventory
    fixture = await createIsolatedTestProduct(`E2E Checkout Isolated Fixture ${Date.now()}`);
  });

  test.afterAll(async () => {
    // Phase 5: Safely clean up isolated temporary test product and test user
    if (fixture?.id) {
      await deleteIsolatedTestProduct(fixture.id);
    }
    await cleanupTestUsersAndOrders(userPrefix);
  });

  test('should execute atomic checkout on isolated fixture, record receipt, and clear cart', async ({ page }) => {
    // 1. Clear session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Register temporary customer
    await page.goto('/register');
    await page.locator('#reg-name, input[name="name"]').first().fill(customerName);
    await page.locator('#reg-email, input[name="email"]').first().fill(customerEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(customerPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(customerPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });

    // 3. Navigate directly to the isolated fixture product
    await page.goto(`/products/${fixture.id}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator(`text=${fixture.name}`).first()).toBeVisible({ timeout: 10000 });

    // 4. Add isolated fixture to cart and wait for badge to reflect item
    const addToCartBtn = page.locator('[data-testid="add-to-cart-btn"], button:has-text("Add to Cart")').first();
    await expect(addToCartBtn).toBeVisible({ timeout: 10000 });
    await addToCartBtn.click();
    const badge = page.locator('[data-testid="navbar-cart-badge"]').first();
    await expect(badge).toHaveText(/^[1-9]/, { timeout: 10000 });

    // 5. Open Checkout
    await page.goto('/checkout');
    await expect(page.locator('h1')).toContainText(/Secure Checkout/i);

    // 6. Verify order item review contains isolated fixture name
    await expect(page.locator(`text=${fixture.name}`).first()).toBeVisible({ timeout: 10000 });

    // 7. Submit checkout
    const placeOrderBtn = page.locator('[data-testid="place-order-btn"]').first();
    await expect(placeOrderBtn).toBeEnabled();
    await placeOrderBtn.click();

    // 8. Confirm redirect to Order Confirmation receipt page
    await page.waitForURL(/\/orders\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.locator('text=Order Confirmed & Committed')).toBeVisible();
    await expect(page.locator('text=CONFIRMED').first()).toBeVisible();

    // 9. Confirm cart was automatically cleared
    await page.goto('/cart');
    await expect(page.locator('text=Your Cart is Empty')).toBeVisible({ timeout: 10000 });
  });
});
