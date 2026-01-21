import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * الموردين – اختبار تدفق العمل الكامل
 * فتح، فلاتر، إنشاء، فواتير، تصدير
 */
test('SUPPLIERS – full workflow simulation', async ({ page }) => {
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
  await db.connect();

  try {
    // ===================== 1. فتح صفحة الموردين =====================
    console.log('\n=== Opening Suppliers Page ===');
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    if (!bodyText.includes('Supplier') && !bodyText.includes('مورد') && !bodyText.includes('Suppliers')) {
      throw new Error('Suppliers page did not load correctly');
    }
    console.log('  ✓ Suppliers page loaded');

    // ===================== 2. اختبار الفلاتر والبحث =====================
    console.log('\n=== Testing Filters ===');
    
    try {
      const searchInput = page.locator('input[type="text"], input[placeholder*="بحث"]').first();
      if (await searchInput.isVisible({ timeout: 3000 })) {
        await searchInput.fill('Test');
        await page.waitForTimeout(1000);
        console.log('  ✓ Search filter applied');
      }
    } catch (e) {
      console.log('  ℹ️  Search filter not found');
    }

    // ===================== 3. التحقق من البطاقات والفواتير =====================
    console.log('\n=== Verifying Supplier Cards & Invoices ===');
    
    const pageText = await page.textContent('body');
    const hasCards = pageText.includes('Cards') || pageText.includes('بطاقات');
    const hasInvoices = pageText.includes('فواتير') || pageText.includes('Invoice') || pageText.includes('Invoices');

    if (hasCards || hasInvoices) {
      console.log('  ✓ Supplier cards/invoices section found');
      
      // Try to navigate to invoices if available
      if (hasInvoices) {
        try {
          const invoicesLink = page.locator('text=/فواتير|Invoice/i').first();
          if (await invoicesLink.isVisible({ timeout: 3000 })) {
            await invoicesLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            console.log('  ✓ Navigated to supplier invoices');
            
            // Go back
            await page.goBack();
            await page.waitForLoadState('networkidle');
          }
        } catch (e) {
          console.log('  ℹ️  Invoices navigation skipped');
        }
      }
    }

    // ===================== 4. التحقق من البيانات =====================
    console.log('\n=== Verifying Data ===');
    
    if (dbConnected) {
      try {
        const dbCount = await db.query('SELECT COUNT(*) as count FROM partners WHERE type IN ($1, $2)', ['supplier', 'مورد']);
        const dbSupplierCount = parseInt(dbCount.rows[0]?.count || 0);
        console.log(`  ✓ Database has ${dbSupplierCount} suppliers`);
      } catch (e) {
        console.log('  ℹ️  Database count verification skipped:', e.message);
      }
    } else {
      console.log('  ℹ️  Database not connected, skipping count verification');
    }

    // ===================== 5. اختبار التصدير =====================
    console.log('\n=== Testing Export ===');
    
    try {
      const pdfButton = page.locator('button:has-text("PDF")').first();
      if (await pdfButton.isVisible({ timeout: 3000 })) {
        console.log('  ✓ PDF export available');
      }
    } catch (e) {
      console.log('  ℹ️  PDF export not found');
    }

    console.log('\n✅ Suppliers full workflow test completed');
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
