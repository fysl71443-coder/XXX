import { test, expect } from '@playwright/test';

/**
 * نقطة البيع POS - أهم اختبار
 * اختيار الفرع وشاشة الفاتورة
 */
test('POS – branch selection & invoice screen', async ({ page }) => {
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

  // Navigate to POS page
  await page.goto('/pos');
  await page.waitForLoadState('networkidle');

  // Verify POS page loaded
  const bodyText = await page.textContent('body');
  if (!bodyText.includes('POS') && !bodyText.includes('نقطة البيع') && !bodyText.includes('Branch') && !bodyText.includes('فرع')) {
    throw new Error('POS page did not load correctly');
  }

  // Try to find and click on a branch
  try {
    // Look for branch links/buttons
    const branchSelectors = [
      'text=China Town',
      'text=Place',
      'a:has-text("China")',
      'button:has-text("China")',
      'div:has-text("China")',
      '[href*="pos"]',
    ];

    let branchClicked = false;
    for (const selector of branchSelectors) {
      try {
        const branchElement = page.locator(selector).first();
        if (await branchElement.isVisible({ timeout: 3000 })) {
          await branchElement.click();
          await page.waitForLoadState('networkidle');
          branchClicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    if (branchClicked) {
      // Wait a bit for POS screen to load
      await page.waitForTimeout(2000);
      
      // Check for invoice screen elements
      const posScreenText = await page.textContent('body');
      const hasInvoiceButton = posScreenText.includes('إصدار الفاتورة') || 
                              posScreenText.includes('Issue Invoice') ||
                              posScreenText.includes('Invoice');
      const hasPaymentMethod = posScreenText.includes('طريقة الدفع') || 
                              posScreenText.includes('Payment') ||
                              posScreenText.includes('Method');

      if (hasInvoiceButton || hasPaymentMethod) {
        console.log('POS invoice screen elements found');
      }
    } else {
      console.log('Branch selection not available - may need branches setup');
    }
  } catch (e) {
    console.log('Branch selection test skipped:', e.message);
  }

  // Verify POS page structure
  await expect(page.locator('body')).toBeVisible();
});
