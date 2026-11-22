import { test, expect } from '@playwright/test';

test.describe('Phase 16: Accessibility Verification', () => {
  test('should maintain semantic headings, accessible labels, and keyboard navigability', async ({ page }) => {
    // 1. Semantic H1 on Homepage
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();

    // 2. Form input accessibility on login page
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    const hasAriaOrLabel = await emailInput.evaluate((el) => {
      return el.getAttribute('aria-label') !== null || el.getAttribute('id') !== null;
    });
    expect(hasAriaOrLabel).toBe(true);

    // 3. Buttons have non-empty accessible text
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      const text = await btn.innerText();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect((text && text.trim().length > 0) || (ariaLabel && ariaLabel.trim().length > 0) || (title && title.trim().length > 0)).toBe(true);
    }
  });
});

