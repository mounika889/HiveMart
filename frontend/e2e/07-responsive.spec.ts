import { test, expect } from '@playwright/test';

test.describe('Phase 15: Responsive Design Across Standard Viewports', () => {
  const viewports = [
    { name: 'Mobile (iPhone)', width: 375, height: 812 },
    { name: 'Tablet (iPad)', width: 768, height: 1024 },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Desktop (1080p)', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`should render cleanly without horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Test Homepage
      await page.goto('/');
      await page.waitForTimeout(500);

      const hasHorizontalScrollHome = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollHome).toBe(false);

      // On mobile, test navigation drawer
      if (vp.width <= 768) {
        const menuToggle = page.locator('button[aria-label="Toggle navigation menu"]').first();
        if (await menuToggle.isVisible()) {
          await menuToggle.click();
          await page.waitForTimeout(300);
          // Check that drawer links are visible
          await expect(page.locator('div.md\\:hidden a:has-text("All Products")')).toBeVisible();
          // Close drawer
          await menuToggle.click();
        }
      }

      // Test Catalog Page
      await page.goto('/products');
      await page.waitForTimeout(500);
      const hasHorizontalScrollCatalog = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollCatalog).toBe(false);

      // Test Cart Page
      await page.goto('/cart');
      await page.waitForTimeout(500);
      const hasHorizontalScrollCart = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollCart).toBe(false);
    });
  }
});
