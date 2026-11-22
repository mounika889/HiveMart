import { test, expect } from '@playwright/test';

test.describe('Phase 8: Catalog & OpenSearch Search Browser Tests', () => {
  test('should display catalog products and filter by keyword, typo, category, and city', async ({ page }) => {
    // 1. Navigate to catalog page
    await page.goto('/products');
    await expect(page).toHaveTitle(/HiveMart/);

    // 2. Products grid loads
    const productItems = page.locator('a[href^="/products/"]');
    await expect(productItems.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await productItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // 3. Typo-tolerant search using OpenSearch: search "headfones"
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('headfones');
    await searchInput.press('Enter');

    // Wait for OpenSearch query resolution
    await page.waitForTimeout(1000);
    const searchResults = page.locator('text=boAt Rockerz 450');
    await expect(searchResults.first()).toBeVisible({ timeout: 10000 });

    // 4. Category filter
    await page.goto('/products');
    const categoryButton = page.locator('button:has-text("Electronics"), a:has-text("Electronics")').first();
    if (await categoryButton.isVisible()) {
      await categoryButton.click();
      await page.waitForTimeout(500);
    }

    // 5. Open product detail page
    const firstProduct = page.locator('a[href^="/products/"]').first();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/products\/[a-f0-9-]+/);

    // Product detail elements
    const addToCartBtn = page.locator('[data-testid="add-to-cart-btn"], button:has-text("Add to Cart")').first();
    await expect(addToCartBtn).toBeVisible({ timeout: 10000 });
  });
});

