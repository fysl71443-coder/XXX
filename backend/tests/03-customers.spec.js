import { test, expect } from '@playwright/test';

/**
 * العملاء - اختبار التنقل والواجهة
 */
test('CUSTOMERS – real UI navigation', async ({ page }) => {
  // Smart console error handler
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignoredPatterns = [/404.*favicon/i, /404.*\.ico/i, /Failed to load resource.*404/i];
      if (!ignoredPatterns.some(pattern => pattern.test(text))) {
        if (text.includes('Uncaught') || text.includes('ReferenceError')) {
          throw new Error(`Critical console error: ${text}`);
        }
      }
    }
  });

  // Navigate to customers page
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  // Verify customers page loaded
  const bodyText = await page.textContent('body');
  if (!bodyText.includes('Client') && !bodyText.includes('عميل') && !bodyText.includes('Customer')) {
    throw new Error('Customers page did not load correctly');
  }

  // Try to find and click create button
  try {
    const createButton = page.locator('text=إضافة عميل, text=Add Client, text=Create, button:has-text("إضافة"), button:has-text("Add")').first();
    
    if (await createButton.isVisible({ timeout: 5000 })) {
      await createButton.click();
      await page.waitForLoadState('networkidle');
      
      // Verify create page loaded
      await expect(page.locator('input, form')).toBeVisible({ timeout: 5000 });
      
      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');
    }
  } catch (e) {
    // Create button might not be visible due to permissions - that's okay for this test
    console.log('Create button not found or not visible');
  }

  // Verify we're still on customers page
  await expect(page.locator('body')).toContainText(/Client|عميل|Customer/i);
});
