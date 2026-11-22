import { test, expect } from '@playwright/test';

test.describe('Phase 7: Homepage Browser Tests', () => {
  test('should load homepage and render core branding, hero, categories, and footer', async ({ page }) => {
    // 1. Homepage loads successfully
    await page.goto('/');
    await expect(page).toHaveTitle(/HiveMart/);

    // 2. Logo and brand identity visible
    const logo = page.locator('text=HiveMart').first();
    await expect(logo).toBeVisible();

    // 3. Hero headline visible
    const heroHeadline = page.locator('text=All in One Hive.');
    await expect(heroHeadline).toBeVisible();

    // 4. Category cards load from API (at least 6 categories)
    const categoryCards = page.locator('[data-testid="home-category-card"]');
    await expect(categoryCards.first()).toBeVisible({ timeout: 10000 });
    const catCount = await categoryCards.count();
    expect(catCount).toBeGreaterThanOrEqual(6);

    // 5. Featured products load
    const productCards = page.locator('a[href^="/products/"]');
    await expect(productCards.first()).toBeVisible({ timeout: 10000 });
    const prodCount = await productCards.count();
    expect(prodCount).toBeGreaterThanOrEqual(4);

    // 6. Search input exists and allows typing
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('headphones');
    expect(await searchInput.inputValue()).toBe('headphones');

    // 7. City selector works
    const citySelector = page.locator('button[title="Select Delivery City"]').first();
    await expect(citySelector).toBeVisible();

    // 8. Footer renders
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // 9. No horizontal overflow on desktop
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
