import { test as setup, expect } from '@playwright/test';

/**
 * Setup file - تسجيل الدخول قبل جميع الاختبارات
 * يحفظ حالة المصادقة في ملف للاستخدام في الاختبارات الأخرى
 */
setup('authenticate', async ({ page }) => {
  // Use the same credentials that work in e2e-test.js
  const email = process.env.ADMIN_EMAIL || 'admin@local.test';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  // Ignore non-critical console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignoredPatterns = [
        /404.*favicon/i,
        /404.*\.ico/i,
        /Failed to load resource.*404/i,
      ];
      if (!ignoredPatterns.some(pattern => pattern.test(text))) {
        // Log but don't fail on non-critical errors
        if (text.includes('Uncaught') || text.includes('ReferenceError')) {
          console.warn('Console error (non-fatal):', text);
        }
      }
    }
  });

  await page.goto('/login', { waitUntil: 'networkidle' });

  // Wait for login form
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

  // Fill and submit
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  
  // Submit and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  // Wait a bit for redirects
  await page.waitForTimeout(2000);

  // Check if we're still on login page
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    const bodyText = await page.textContent('body');
    if (bodyText.includes('error') || bodyText.includes('خطأ')) {
      throw new Error('Login failed - error message detected');
    }
    throw new Error('Login failed - still on login page after submission');
  }

  // Verify login success
  await page.waitForLoadState('networkidle');
  const bodyText = await page.textContent('body');
  if (bodyText.includes('تسجيل الدخول') || bodyText.includes('Login')) {
    throw new Error('Login failed - still on login page');
  }

  // Save authentication state
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
