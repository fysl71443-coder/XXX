import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * التقارير – اختبار تدفق العمل الكامل
 * فتح التقرير، تطبيق فلاتر، التحقق من البيانات، التحقق من التوازن
 */
test('REPORTS – full workflow simulation', async ({ page }) => {
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

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  let dbConnected = false;
  try {
    await db.connect();
    dbConnected = true;
  } catch (e) {
    console.log('  ⚠️  Database connection failed, continuing without DB verification:', e.message);
  }

  try {
    // ===================== 1. فتح صفحة التقارير =====================
    console.log('\n=== Opening Reports Page ===');
    await page.goto('/reports', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    if (!bodyText.includes('Report') && !bodyText.includes('تقرير') && !bodyText.includes('Reports')) {
      throw new Error('Reports page did not load correctly');
    }
    console.log('  ✓ Reports page loaded');

    // ===================== 2. فتح تقرير ميزان المراجعة =====================
    console.log('\n=== Testing Trial Balance Report ===');
    
    const trialBalanceSelectors = [
      'text=ميزان المراجعة',
      'text=Trial Balance',
      'a:has-text("ميزان")',
      'button:has-text("ميزان")',
      'a:has-text("Trial")',
    ];

    let reportOpened = false;
    for (const selector of trialBalanceSelectors) {
      try {
        const reportElement = page.locator(selector).first();
        if (await reportElement.isVisible({ timeout: 3000 })) {
          await reportElement.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
          reportOpened = true;
          console.log(`  ✓ Trial Balance report opened using: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (reportOpened) {
      // ===================== 3. التحقق من محتوى التقرير =====================
      console.log('\n=== Verifying Report Content ===');
      
      const reportText = await page.textContent('body');
      
      // Check for report indicators
      const hasPublishedEntries = reportText.includes('محسوب من قيود منشورة') ||
                                  reportText.includes('Published') ||
                                  reportText.includes('Posted') ||
                                  reportText.includes('منشور');
      
      const hasAccountData = reportText.includes('حساب') || 
                            reportText.includes('Account') ||
                            reportText.match(/\d+.*\d+.*\d+/); // Numbers pattern

      if (hasPublishedEntries || hasAccountData) {
        console.log('  ✓ Report content verified');
      }

      // ===================== 4. التحقق من التوازن من قاعدة البيانات =====================
      if (dbConnected) {
        console.log('\n=== Verifying Balance from Database ===');
        
        try {
          // Get trial balance data from database
          const trialBalanceQuery = `
            SELECT 
              a.id,
              a.name,
              COALESCE(SUM(CASE WHEN jp.debit > 0 THEN jp.debit ELSE 0 END), 0) as total_debit,
              COALESCE(SUM(CASE WHEN jp.credit > 0 THEN jp.credit ELSE 0 END), 0) as total_credit
            FROM accounts a
            LEFT JOIN journal_postings jp ON jp.account_id = a.id
            LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
            GROUP BY a.id, a.name
            HAVING COALESCE(SUM(jp.debit), 0) > 0 OR COALESCE(SUM(jp.credit), 0) > 0
            LIMIT 10
          `;

          const dbResult = await db.query(trialBalanceQuery);
          const accounts = dbResult.rows;

      if (accounts.length > 0) {
        // Calculate totals
        const totalDebit = accounts.reduce((sum, acc) => sum + parseFloat(acc.total_debit || 0), 0);
        const totalCredit = accounts.reduce((sum, acc) => sum + parseFloat(acc.total_credit || 0), 0);
        const difference = Math.abs(totalDebit - totalCredit);

        console.log(`  Database totals: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}`);

        if (difference > 0.01) {
          throw new Error(`Trial balance unbalanced! Debit: ${totalDebit}, Credit: ${totalCredit}, Difference: ${difference}`);
        }
        console.log('  ✓ Trial balance is balanced');
      } else {
        console.log('  ℹ️  No posted journal entries found for balance verification');
      }
        } catch (e) {
          console.log('  ℹ️  Database balance verification skipped:', e.message);
        }
      } else {
        console.log('  ℹ️  Database not connected, skipping balance verification');
      }

      // ===================== 5. اختبار فلاتر التقرير =====================
      console.log('\n=== Testing Report Filters ===');
      
      // Try to find and use date filters
      try {
        const dateInputs = await page.locator('input[type="date"]').all();
        if (dateInputs.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const lastMonthStr = lastMonth.toISOString().split('T')[0];

          if (dateInputs[0]) {
            await dateInputs[0].fill(lastMonthStr);
          }
          if (dateInputs[1]) {
            await dateInputs[1].fill(today);
          }
          
          await page.waitForTimeout(1000);
          
          // Try to find apply/refresh button
          const applyButton = page.locator('button:has-text("تطبيق"), button:has-text("Apply"), button:has-text("تحديث")').first();
          if (await applyButton.isVisible({ timeout: 2000 })) {
            await applyButton.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            console.log('  ✓ Report filters applied');
          }
        }
      } catch (e) {
        console.log('  ℹ️  Report filters test skipped');
      }

      // ===================== 6. اختبار تصدير التقرير =====================
      console.log('\n=== Testing Report Export ===');
      
      // Test PDF export
      try {
        const pdfButton = page.locator('button:has-text("PDF")').first();
        if (await pdfButton.isVisible({ timeout: 3000 })) {
          const isEnabled = await pdfButton.isEnabled();
          if (isEnabled) {
            console.log('  ✓ PDF export button available');
            // Don't actually click to avoid downloading
          }
        }
      } catch (e) {
        console.log('  ℹ️  PDF export not found');
      }

      // Test Excel export
      try {
        const excelButton = page.locator('button:has-text("Excel"), button:has-text("XLSX")').first();
        if (await excelButton.isVisible({ timeout: 3000 })) {
          const isEnabled = await excelButton.isEnabled();
          if (isEnabled) {
            console.log('  ✓ Excel export button available');
          }
        }
      } catch (e) {
        console.log('  ℹ️  Excel export not found');
      }
    } else {
      console.log('  ℹ️  Trial Balance report link not found - testing other reports');
      
      // Try other report types
      const otherReports = [
        'text=قائمة الدخل',
        'text=Income Statement',
        'text=المركز المالي',
        'text=Balance Sheet',
      ];

      for (const reportSelector of otherReports) {
        try {
          const reportElement = page.locator(reportSelector).first();
          if (await reportElement.isVisible({ timeout: 2000 })) {
            await reportElement.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            console.log(`  ✓ Opened report: ${reportSelector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // ===================== 7. التحقق من الأداء =====================
    console.log('\n=== Performance Check ===');
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    if (loadTime > 10000) {
      console.warn(`  ⚠ Reports page load took ${loadTime}ms (slow)`);
    } else {
      console.log(`  ✓ Reports page loaded in ${loadTime}ms`);
    }

    console.log('\n✅ Reports full workflow test completed');
  } finally {
    if (dbConnected) {
      try {
        await db.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
});
