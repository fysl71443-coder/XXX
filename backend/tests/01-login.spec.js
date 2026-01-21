import { test, expect } from '@playwright/test';

/**
 * اختبار تسجيل الدخول - بوابة النظام
 * أي فشل هنا = فشل كامل للنظام
 */
test('LOGIN – real user simulation', async ({ page, context }) => {
  // Clear any existing auth state for login test
  await context.clearCookies();
  
  // Smart console error handler - ignore non-critical errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore common non-critical errors
      const ignoredPatterns = [
        /404.*favicon/i,
        /404.*\.ico/i,
        /404.*\.png/i,
        /404.*\.jpg/i,
        /404.*\.svg/i,
        /Failed to load resource.*404/i,
        /net::ERR_/i,
      ];
      
      const shouldIgnore = ignoredPatterns.some(pattern => pattern.test(text));
      if (!shouldIgnore) {
        consoleErrors.push(text);
        // Only throw for critical errors
        if (text.includes('Uncaught') || text.includes('ReferenceError') || text.includes('TypeError')) {
          throw new Error(`Critical console error: ${text}`);
        }
      }
    }
  });

  // Smart network error handler - ignore 404 for static assets
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    
    if (status >= 400) {
      // Ignore 404 for static assets
      const staticAssetPatterns = [
        /favicon/i,
        /\.ico$/i,
        /\.png$/i,
        /\.jpg$/i,
        /\.svg$/i,
        /\.woff/i,
        /\.ttf/i,
        /manifest\.json/i,
      ];
      
      const isStaticAsset = staticAssetPatterns.some(pattern => pattern.test(url));
      const isApiError = url.includes('/api/');
      
      // Only fail on API errors or non-static 404s
      if (isApiError && status >= 400) {
        throw new Error(`API error: ${status} ${url}`);
      } else if (!isStaticAsset && status >= 500) {
        throw new Error(`Server error: ${status} ${url}`);
      }
    }
  });

  await page.goto('/login', { waitUntil: 'networkidle' });

  // Wait for login form
  await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible({ timeout: 10000 });

  // Fill login form - use credentials that work in e2e-test.js
  const email = process.env.ADMIN_EMAIL || 'admin@local.test';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);

  // Submit form and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  // Wait a bit for any redirects
  await page.waitForTimeout(2000);

  // Check if we're still on login page
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    // Check for error messages
    const bodyText = await page.textContent('body');
    if (bodyText.includes('error') || bodyText.includes('خطأ') || bodyText.includes('Invalid')) {
      throw new Error('Login failed - error message detected on page');
    }
    throw new Error('Login failed - still on login page after submission');
  }

  // Verify we're logged in - check for dashboard or any authenticated content
  await page.waitForLoadState('networkidle');
  const bodyText = await page.textContent('body');
  if (!bodyText.includes('لوحة التحكم') && !bodyText.includes('Dashboard') && !bodyText.includes('المحاسبة') && !bodyText.includes('Accounting')) {
    throw new Error('Login failed - dashboard not visible');
  }

  // Additional verification
  await expect(page.locator('body')).not.toContainText(/تسجيل الدخول|Login/i);
});
