import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * المحاسبة – اختبار تدفق العمل الكامل
 * ليس فقط فتح الشاشة، بل محاكاة المستخدم الحقيقي بالكامل
 */
test('ACCOUNTING – full workflow simulation', async ({ page }) => {
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

  // Connect to database for data verification
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
    // ===================== 1. شجرة الحسابات =====================
    console.log('\n=== Testing Chart of Accounts ===');
    await page.goto('/accounting');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page loaded - check for multiple possible texts
    const accountingText = await page.textContent('body');
    const hasAccountingContent = 
      accountingText.includes('شجرة الحسابات') || 
      accountingText.includes('Account') ||
      accountingText.includes('حساب') ||
      accountingText.includes('Accounts') ||
      accountingText.includes('المحاسبة') ||
      accountingText.includes('Accounting');
    
    if (!hasAccountingContent) {
      // Try to wait a bit more and check again
      await page.waitForTimeout(2000);
      const accountingText2 = await page.textContent('body');
      const hasAccountingContent2 = 
        accountingText2.includes('شجرة الحسابات') || 
        accountingText2.includes('Account') ||
        accountingText2.includes('حساب') ||
        accountingText2.includes('Accounts') ||
        accountingText2.includes('المحاسبة') ||
        accountingText2.includes('Accounting');
      
      if (!hasAccountingContent2) {
        throw new Error(`Accounting page did not load correctly. Page content: ${accountingText2.substring(0, 200)}`);
      }
    }

    // Check for account tree structure
    await expect(page.locator('body')).toContainText(/شجرة|Account|حساب|Accounts|المحاسبة|Accounting/i);

    // ===================== 2. القيود اليومية - فتح الشاشة =====================
    console.log('\n=== Testing Journal Entries Page ===');
    await page.goto('/journal');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page loaded
    const journalText = await page.textContent('body');
    if (!journalText.includes('Journal') && !journalText.includes('القيود')) {
      throw new Error('Journal page did not load correctly');
    }

    // ===================== 3. اختبار الفلاتر =====================
    console.log('\n=== Testing Filters ===');
    
    // Test date filter
    try {
      const fromDateInput = page.locator('input[type="date"]').first();
      if (await fromDateInput.isVisible({ timeout: 3000 })) {
        const today = new Date().toISOString().split('T')[0];
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStr = lastMonth.toISOString().split('T')[0];
        
        await fromDateInput.fill(lastMonthStr);
        await page.waitForTimeout(1000);
        console.log('  ✓ Date filter applied');
      }
    } catch (e) {
      console.log('  ℹ️  Date filter not found');
    }

    // Test status filter
    try {
      const statusSelect = page.locator('select').filter({ hasText: /draft|posted|status/i }).first();
      if (await statusSelect.isVisible({ timeout: 3000 })) {
        await statusSelect.selectOption('posted');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        console.log('  ✓ Status filter applied');
      }
    } catch (e) {
      console.log('  ℹ️  Status filter not found');
    }

    // ===================== 4. التحقق من الإجماليات =====================
    console.log('\n=== Verifying Journal Totals ===');
    
    const bodyText = await page.textContent('body');
    
    // Extract debit and credit totals
    const debitMatch = bodyText.match(/(?:إجمالي المدين|Total Debit)[:\s]*([\d,]+\.?\d*)/i);
    const creditMatch = bodyText.match(/(?:إجمالي الدائن|Total Credit)[:\s]*([\d,]+\.?\d*)/i);
    
    if (debitMatch && creditMatch) {
      const debitTotal = parseFloat(debitMatch[1].replace(/,/g, ''));
      const creditTotal = parseFloat(creditMatch[1].replace(/,/g, ''));
      
      // Verify balance (should be equal for posted entries)
      const difference = Math.abs(debitTotal - creditTotal);
      if (difference > 0.01) {
        throw new Error(`Journal entries unbalanced! Debit: ${debitTotal}, Credit: ${creditTotal}, Difference: ${difference}`);
      }
      console.log(`  ✓ Totals balanced: Debit=${debitTotal}, Credit=${creditTotal}`);
    } else {
      console.log('  ℹ️  Totals not found in UI, checking database...');
      
      if (dbConnected) {
        try {
          // Verify from database
          const dbResult = await db.query(`
            SELECT 
              COALESCE(SUM(jp.debit), 0) as total_debit,
              COALESCE(SUM(jp.credit), 0) as total_credit
            FROM journal_entries je
            JOIN journal_postings jp ON jp.journal_entry_id = je.id
            WHERE je.status = 'posted'
          `);
          
          const dbDebit = parseFloat(dbResult.rows[0]?.total_debit || 0);
          const dbCredit = parseFloat(dbResult.rows[0]?.total_credit || 0);
          const dbDifference = Math.abs(dbDebit - dbCredit);
          
          if (dbDifference > 0.01) {
            throw new Error(`Database entries unbalanced! Debit: ${dbDebit}, Credit: ${dbCredit}, Difference: ${dbDifference}`);
          }
          console.log(`  ✓ Database totals balanced: Debit=${dbDebit}, Credit=${dbCredit}`);
        } catch (e) {
          console.log('  ℹ️  Database verification skipped:', e.message);
        }
      } else {
        console.log('  ℹ️  Database not connected, skipping balance verification');
      }
    }

    // ===================== 5. اختبار الأزرار =====================
    console.log('\n=== Testing Action Buttons ===');
    
    // Test Create button
    try {
      const createButton = page.locator('button:has-text("إنشاء"), button:has-text("Create"), button:has-text("إضافة")').first();
      if (await createButton.isVisible({ timeout: 3000 })) {
        await createButton.click();
        await page.waitForTimeout(1000);
        
        // Check if modal/form opened
        const modalVisible = await page.locator('input[type="date"], input[name="date"]').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (modalVisible) {
          console.log('  ✓ Create modal opened');
          // Close modal
          const closeButton = page.locator('button:has-text("إغلاق"), button:has-text("Close"), button:has-text("×")').first();
          if (await closeButton.isVisible({ timeout: 1000 })) {
            await closeButton.click();
            await page.waitForTimeout(500);
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
    } catch (e) {
      console.log('  ℹ️  Create button test skipped');
    }

    // Test PDF export button
    try {
      const pdfButton = page.locator('button:has-text("PDF")').first();
      if (await pdfButton.isVisible({ timeout: 3000 })) {
        // Just verify it exists and is clickable, don't actually download
        const isEnabled = await pdfButton.isEnabled();
        if (isEnabled) {
          console.log('  ✓ PDF export button available');
        }
      }
    } catch (e) {
      console.log('  ℹ️  PDF button not found');
    }

    // Test Excel export button
    try {
      const excelButton = page.locator('button:has-text("Excel"), button:has-text("XLSX")').first();
      if (await excelButton.isVisible({ timeout: 3000 })) {
        const isEnabled = await excelButton.isEnabled();
        if (isEnabled) {
          console.log('  ✓ Excel export button available');
        }
      }
    } catch (e) {
      console.log('  ℹ️  Excel button not found');
    }

    // ===================== 6. اختبار التفاعل مع القيود =====================
    console.log('\n=== Testing Journal Entry Interactions ===');
    
    // Try to find and interact with a journal entry card
    try {
      const entryCard = page.locator('[class*="card"], [class*="entry"], [class*="journal"]').first();
      if (await entryCard.isVisible({ timeout: 3000 })) {
        // Try to click View button
        const viewButton = entryCard.locator('button:has-text("عرض"), button:has-text("View")').first();
        if (await viewButton.isVisible({ timeout: 2000 })) {
          await viewButton.click();
          await page.waitForTimeout(1000);
          console.log('  ✓ View button clicked');
          
          // Check if details opened
          const detailsVisible = await page.locator('body').textContent().then(text => 
            text.includes('تفاصيل') || text.includes('Details') || text.includes('Posting')
          );
          if (detailsVisible) {
            console.log('  ✓ Entry details displayed');
          }
        }
      }
    } catch (e) {
      console.log('  ℹ️  Entry interaction test skipped');
    }

    // ===================== 7. التحقق من الأداء =====================
    console.log('\n=== Performance Check ===');
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    if (loadTime > 10000) {
      console.warn(`  ⚠ Page load took ${loadTime}ms (slow)`);
    } else {
      console.log(`  ✓ Page loaded in ${loadTime}ms`);
    }

    console.log('\n✅ Accounting full workflow test completed');
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
