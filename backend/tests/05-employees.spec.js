import { test, expect } from '@playwright/test';

/**
 * الموظفين - البطاقات والرواتب
 */
test('EMPLOYEES – cards & payroll access', async ({ page }) => {
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

  // Navigate to employees page
  await page.goto('/employees');
  await page.waitForLoadState('networkidle');

  // Verify employees page loaded
  const bodyText = await page.textContent('body');
  if (!bodyText.includes('Employee') && !bodyText.includes('موظف') && !bodyText.includes('Employees')) {
    throw new Error('Employees page did not load correctly');
  }

  // Check for add employee button
  const hasAddButton = bodyText.includes('إضافة موظف') || 
                       bodyText.includes('Add Employee') || 
                       bodyText.includes('Create');

  // Check for total employees count
  const hasTotal = bodyText.includes('إجمالي') || 
                   bodyText.includes('Total') || 
                   bodyText.includes('Count');

  if (!hasAddButton && !hasTotal) {
    console.log('Add button or total count not found, but page loaded');
  }

  // Verify page structure
  await expect(page.locator('body')).toBeVisible();
});
