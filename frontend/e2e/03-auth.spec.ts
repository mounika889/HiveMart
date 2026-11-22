import { test, expect } from '@playwright/test';

test.describe('Phase 9: Authentication & Session Browser Tests', () => {
  const testEmail = `e2e_user_${Date.now()}@hivemart.test`;
  const testPassword = 'Password123!';
  const testName = 'E2E Test Customer';

  test('should handle validation, registration, login, session persistence, and logout', async ({ page }) => {
    // 1. Clear session to start clean
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Registration form validation
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText(/Create Account|Register/i);

    // Try submitting empty
    const createAccountBtn = page.getByRole('button', { name: 'Create Account' });
    await createAccountBtn.click();
    const errorBanner = page.locator('[data-testid="auth-error-banner"]').first();
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Name must be at least 2 characters long');

    // Fill valid registration fields
    await page.locator('#reg-name, input[name="name"]').first().fill(testName);
    await page.locator('#reg-email, input[name="email"]').first().fill(testEmail);
    await page.locator('#reg-password, input[name="password"]').first().fill(testPassword);
    await page.locator('#reg-confirm-password, input[name="confirmPassword"]').first().fill(testPassword);

    // Submit registration
    await createAccountBtn.click();

    // 3. Confirm redirect and logged-in state in navbar
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });
    const userBadge = page.locator(`text=${testName}`).first();
    await expect(userBadge).toBeVisible({ timeout: 10000 });

    // 4. Test logout
    const userBtn = page.locator('[data-testid="navbar-user-btn"]').first();
    if (await userBtn.isVisible()) {
      await userBtn.click();
      const logoutBtn = page.locator('button:has-text("Sign Out")').first();
      await logoutBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Test login with wrong password
    await page.goto('/login');
    await page.locator('#email, input[name="email"]').first().fill(testEmail);
    await page.locator('#password, input[name="password"]').first().fill('WrongPassword!');
    const signInBtn = page.getByRole('button', { name: 'Sign In' });
    await signInBtn.click();
    const loginErrorBanner = page.locator('[data-testid="auth-error-banner"]').first();
    await expect(loginErrorBanner).toBeVisible({ timeout: 10000 });
    await expect(loginErrorBanner).toContainText('Invalid email or password');

    // 6. Test successful login
    await page.locator('#password, input[name="password"]').first().fill(testPassword);
    await signInBtn.click();

    // Confirm session restored
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await expect(page.locator(`text=${testName}`).first()).toBeVisible({ timeout: 10000 });
  });
});
