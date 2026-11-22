import { test, expect } from '@playwright/test';
import {
  createIsolatedTestProduct,
  deleteIsolatedTestProduct,
  cleanupTestUsersAndOrders,
  TestFixtureProduct,
} from './test-helpers.ts';

test.describe('Order History & Order Details Browser Tests', () => {
  let fixture: TestFixtureProduct;
  const userPrefix = `e2e_ord_${Date.now()}`;
  const customerEmail = `${userPrefix}@hivemart.test`;
  const customerPassword = 'Password123!';
  const customerName = 'Order History User';

  test.beforeAll(async () => {
    fixture = await createIsolatedTestProduct(`E2E Orders Fixture ${Date.now()}`);
  });

  test.afterAll(async () => {
    if (fixture?.id) {
      await deleteIsolatedTestProduct(fixture.id);
    }
    await cleanupTestUsersAndOrders(userPrefix);
  });

  test('should display placed order in history and navigate to full details', async ({ page }) => {
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

    // 3. Add product and checkout
    await page.goto(`/products/${fixture.id}`);
    const addToCartBtn = page.locator('[data-testid="add-to-cart-btn"], button:has-text("Add to Cart")').first();
    await addToCartBtn.click();
    await page.waitForTimeout(800);

    await page.goto('/checkout');
    const placeOrderBtn = page.locator('[data-testid="place-order-btn"]').first();
    await placeOrderBtn.click();
    await page.waitForURL(/\/orders\/[a-f0-9-]+/, { timeout: 15000 });

    // 4. Open Order History
    await page.goto('/orders');
    await expect(page.locator('h1')).toContainText(/Your Order History/i);

    // 5. Verify order card is listed
    const viewDetailsLink = page.locator('a:has-text("View Details"), a[href^="/orders/"]').first();
    await expect(viewDetailsLink).toBeVisible({ timeout: 10000 });

    // 6. Navigate to Order Detail
    await viewDetailsLink.click();
    await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+/);
    await expect(page.locator('text=Order Identifier')).toBeVisible();
    await expect(page.locator('text=CONFIRMED').first()).toBeVisible();
  });
});
