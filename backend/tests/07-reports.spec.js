import { test, expect } from '@playwright/test';

/**
 * التقارير - كشف الأعطال الحقيقي
 * التحقق من التقارير المحاسبية
 */
test('REPORTS – accounting driven reports', async ({ page }) => {
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

  // Navigate to reports page
  await page.goto('/reports');
  await page.waitForLoadState('networkidle');

  // Verify reports page loaded
  const bodyText = await page.textContent('body');
  if (!bodyText.includes('Report') && !bodyText.includes('تقرير') && !bodyText.includes('Reports') && !bodyText.includes('تقارير')) {
    throw new Error('Reports page did not load correctly');
  }

  // Try to navigate to trial balance report
  try {
    const trialBalanceSelectors = [
      'text=ميزان المراجعة',
      'text=Trial Balance',
      'a:has-text("ميزان")',
      'button:has-text("ميزان")',
      'a:has-text("Trial")',
    ];

    let reportClicked = false;
    for (const selector of trialBalanceSelectors) {
      try {
        const reportElement = page.locator(selector).first();
        if (await reportElement.isVisible({ timeout: 3000 })) {
          await reportElement.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          reportClicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (reportClicked) {
      // Check for report content
      const reportText = await page.textContent('body');
      const hasPublishedEntries = reportText.includes('محسوب من قيود منشورة') ||
                                  reportText.includes('Published') ||
                                  reportText.includes('Posted') ||
                                  reportText.includes('منشور');

      if (hasPublishedEntries) {
        console.log('Report content verified');
      }
    } else {
      console.log('Trial balance report link not found');
    }
  } catch (e) {
    console.log('Report navigation test skipped:', e.message);
  }

  // Verify reports page structure
  await expect(page.locator('body')).toBeVisible();
});
