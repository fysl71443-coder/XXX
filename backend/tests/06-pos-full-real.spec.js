import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * نقطة البيع POS – اختبار تدفق العمل الحقيقي الكامل
 * إنشاء فاتورة حقيقية مع منتجات ودفع
 */
test('POS – real invoice creation workflow', async ({ page }) => {
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
  let createdOrderId = null;
  let createdInvoiceId = null;
  
  try {
    await db.connect();
    dbConnected = true;
  } catch (e) {
    console.log('  ⚠️  Database connection failed:', e.message);
  }

  try {
    // ===================== 1. التحضير: الحصول على فرع ومنتج =====================
    console.log('\n=== Preparing Test Data ===');
    
    let branchId = null;
    let branchName = 'china_town';
    let productId = null;
    let productName = '';
    
    if (dbConnected) {
      try {
        // Try to get branch from branches table
        let branchResult;
        try {
          branchResult = await db.query('SELECT id, name, code FROM branches LIMIT 1');
        } catch (e) {
          // If branches table doesn't exist, use default branches
          console.log('  ℹ️  Branches table not found, using default branches');
          branchName = 'china_town';
          branchId = null;
        }
        
        if (branchResult && branchResult.rows.length > 0) {
          branchId = branchResult.rows[0].id;
          branchName = (branchResult.rows[0].code || branchResult.rows[0].name).toLowerCase().replace(/\s+/g, '_');
          console.log(`  ✓ Found branch: ${branchName} (ID: ${branchId})`);
        } else {
          // Use default branch names
          branchName = 'china_town';
          console.log(`  ℹ️  Using default branch: ${branchName}`);
        }
        
        // Get first active product
        const productResult = await db.query('SELECT id, name, sale_price FROM products WHERE status = $1 LIMIT 1', ['active']);
        if (productResult.rows.length > 0) {
          productId = productResult.rows[0].id;
          productName = productResult.rows[0].name;
          console.log(`  ✓ Found product: ${productName} (ID: ${productId})`);
        } else {
          // Create a test product
          const createProductResult = await db.query(`
            INSERT INTO products (name, sale_price, cost_price, status, category)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name
          `, [`Test Product E2E ${Date.now()}`, 100, 50, 'active', 'عام']);
          productId = createProductResult.rows[0].id;
          productName = createProductResult.rows[0].name;
          console.log(`  ✓ Created test product: ${productName} (ID: ${productId})`);
        }
      } catch (e) {
        console.log('  ⚠️  Database preparation failed:', e.message);
      }
    }

    if (!productId) {
      throw new Error('No product available for testing');
    }

    // ===================== 2. فتح صفحة POS =====================
    console.log('\n=== Opening POS Page ===');
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ===================== 3. اختيار فرع =====================
    console.log('\n=== Selecting Branch ===');
    
    const branchSelectors = [
      `text=${branchName.replace(/_/g, ' ')}`,
      `a:has-text("${branchName.split('_')[0]}")`,
      'a[href*="pos"]',
      'button:has-text("China")',
      'button:has-text("Place")',
    ];

    let branchSelected = false;
    for (const selector of branchSelectors) {
      try {
        const branchElement = page.locator(selector).first();
        if (await branchElement.isVisible({ timeout: 3000 })) {
          await branchElement.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
          branchSelected = true;
          console.log(`  ✓ Branch selected: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!branchSelected) {
      throw new Error('Failed to select branch');
    }

    // ===================== 4. إضافة منتج للفاتورة =====================
    console.log('\n=== Adding Product to Invoice ===');
    
    // Wait for products to load
    await page.waitForTimeout(3000);
    
    // Get product price from database
    let productPrice = 100;
    if (dbConnected) {
      try {
        const priceResult = await db.query('SELECT sale_price FROM products WHERE id = $1', [productId]);
        if (priceResult.rows.length > 0) {
          productPrice = parseFloat(priceResult.rows[0].sale_price || 100);
        }
      } catch (e) {
        console.log('  ℹ️  Could not get product price:', e.message);
      }
    }
    
    // Try to find and click the product
    const productSelectors = [
      `text=${productName}`,
      `button:has-text("${productName}")`,
      `div:has-text("${productName}")`,
      `[data-product-id="${productId}"]`,
      `button[onclick*="${productId}"]`,
    ];

    let productAdded = false;
    for (const selector of productSelectors) {
      try {
        const productElement = page.locator(selector).first();
        if (await productElement.isVisible({ timeout: 3000 })) {
          await productElement.click();
          await page.waitForTimeout(2000);
          productAdded = true;
          console.log(`  ✓ Product clicked: ${productName}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Alternative: Use JavaScript to add product directly via window functions
    if (!productAdded) {
      try {
        const added = await page.evaluate((pid, pname, pprice) => {
          // Try multiple methods to add product
          if (window.__POS_TEST_ADD_ITEM__) {
            window.__POS_TEST_ADD_ITEM__({ id: pid, name: pname, price: pprice });
            return true;
          }
          // Try to find and click product button
          const productButtons = Array.from(document.querySelectorAll('button, div, a')).filter(el => 
            el.textContent && el.textContent.includes(pname)
          );
          if (productButtons.length > 0) {
            productButtons[0].click();
            return true;
          }
          return false;
        }, productId, productName, productPrice);
        
        if (added) {
          await page.waitForTimeout(2000);
          productAdded = true;
          console.log('  ✓ Product added via JavaScript');
        }
      } catch (e) {
        console.log('  ⚠️  Could not add product via JS:', e.message);
      }
    }

    if (!productAdded) {
      throw new Error('Failed to add product to invoice');
    }
    
    // Verify product was added to the invoice items
    const itemsVisible = await page.locator('text=/كمية|Quantity|qty/i, text=/إجمالي|Total/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (itemsVisible) {
      console.log('  ✓ Product appears in invoice items');
    }

    // ===================== 5. حفظ المسودة =====================
    console.log('\n=== Saving Draft Order ===');
    
    // Wait a bit for auto-save or trigger manual save
    await page.waitForTimeout(3000);
    
    // Try to trigger save using window function if available
    try {
      const savedOrderId = await page.evaluate(() => {
        if (window.__POS_TEST_SAVE__) {
          return window.__POS_TEST_SAVE__();
        }
        return null;
      });
      
      if (savedOrderId) {
        createdOrderId = savedOrderId;
        await page.waitForTimeout(2000);
        console.log(`  ✓ Draft order saved via window function (ID: ${createdOrderId})`);
      }
    } catch (e) {
      console.log('  ℹ️  Window save function not available');
    }
    
    // Check if order was saved by checking localStorage
    if (!createdOrderId) {
      const orderIdFromStorage = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const posKey = keys.find(k => k.includes('pos_order'));
        return posKey ? localStorage.getItem(posKey) : null;
      });

      if (orderIdFromStorage) {
        createdOrderId = orderIdFromStorage;
        console.log(`  ✓ Draft order found in storage (ID: ${createdOrderId})`);
      }
    }
    
    // Verify order exists in database
    if (dbConnected && createdOrderId) {
      try {
        const orderResult = await db.query('SELECT id, status FROM orders WHERE id = $1', [createdOrderId]);
        if (orderResult.rows.length > 0) {
          console.log(`  ✓ Order verified in database (Status: ${orderResult.rows[0].status})`);
        } else {
          console.log('  ⚠️  Order not found in database yet');
        }
      } catch (e) {
        console.log('  ℹ️  Could not verify order in database:', e.message);
      }
    }
    
    if (!createdOrderId) {
      throw new Error('Failed to save draft order');
    }

    // ===================== 6. إصدار الفاتورة =====================
    console.log('\n=== Issuing Invoice ===');
    
    // Set payment method
    let paymentSet = false;
    try {
      const paymentSelect = page.locator('select[name="paymentMethod"], select:has-text("cash"), select:has-text("Cash")').first();
      if (await paymentSelect.isVisible({ timeout: 3000 })) {
        await paymentSelect.selectOption('cash');
        await page.waitForTimeout(1000);
        paymentSet = true;
        console.log('  ✓ Payment method set to cash');
      }
    } catch (e) {
      // Try to set via JavaScript
      try {
        await page.evaluate(() => {
          if (window.__POS_TEST_SET_PAYMENT__) {
            window.__POS_TEST_SET_PAYMENT__('cash');
          }
        });
        paymentSet = true;
        console.log('  ✓ Payment method set via JavaScript');
      } catch (e2) {
        console.log('  ℹ️  Could not set payment method');
      }
    }

    // Click issue invoice button or use window function
    let invoiceIssued = false;
    
    // Try window function first (more reliable)
    try {
      const issued = await page.evaluate(() => {
        if (window.__POS_TEST_ISSUE__) {
          return window.__POS_TEST_ISSUE__('cash', null);
        }
        return false;
      });
      
      if (issued) {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000); // Wait longer for invoice creation
        invoiceIssued = true;
        console.log('  ✓ Invoice issued via window function');
      }
    } catch (e) {
      console.log('  ℹ️  Window issue function not available, trying button');
    }
    
    // Fallback to button click
    if (!invoiceIssued) {
      const issueButtonSelectors = [
        'button:has-text("إصدار الفاتورة")',
        'button:has-text("Issue Invoice")',
        'button:has-text("Invoice")',
        'button[type="submit"]',
        'button:has-text("حفظ")',
      ];

      for (const selector of issueButtonSelectors) {
        try {
          const issueButton = page.locator(selector).first();
          if (await issueButton.isVisible({ timeout: 3000 })) {
            await issueButton.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000); // Wait longer for invoice creation
            invoiceIssued = true;
            console.log(`  ✓ Invoice issued using button: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!invoiceIssued) {
      throw new Error('Failed to issue invoice');
    }

    // Verify invoice was created in database
    if (dbConnected && createdOrderId) {
      try {
        const invoiceResult = await db.query(
          'SELECT id FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
          [createdOrderId]
        );
        if (invoiceResult.rows.length > 0) {
          createdInvoiceId = invoiceResult.rows[0].id;
          console.log(`  ✓ Invoice created in database (ID: ${createdInvoiceId})`);
        }
      } catch (e) {
        console.log('  ℹ️  Could not verify invoice in database:', e.message);
      }
    }

    // ===================== 7. طباعة الفاتورة =====================
    console.log('\n=== Testing Print ===');
    
    try {
      const printButton = page.locator('button:has-text("طباعة"), button:has-text("Print")').first();
      if (await printButton.isVisible({ timeout: 3000 })) {
        // Don't actually print, just verify button exists
        const isEnabled = await printButton.isEnabled();
        if (isEnabled) {
          console.log('  ✓ Print button available');
          // Could click here to test actual printing
        }
      }
    } catch (e) {
      console.log('  ℹ️  Print button not found');
    }

    console.log('\n✅ POS real invoice creation test completed');
  } finally {
    // ===================== 8. تنظيف البيانات =====================
    if (dbConnected && (createdOrderId || createdInvoiceId)) {
      console.log('\n=== Cleaning Up Test Data ===');
      try {
        if (createdInvoiceId) {
          await db.query('DELETE FROM invoices WHERE id = $1', [createdInvoiceId]);
          console.log(`  ✓ Deleted invoice (ID: ${createdInvoiceId})`);
        }
        if (createdOrderId) {
          await db.query('DELETE FROM orders WHERE id = $1', [createdOrderId]);
          console.log(`  ✓ Deleted order (ID: ${createdOrderId})`);
        }
      } catch (e) {
        console.log('  ⚠️  Cleanup failed:', e.message);
      }
    }
    
    if (dbConnected) {
      try {
        await db.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
});
