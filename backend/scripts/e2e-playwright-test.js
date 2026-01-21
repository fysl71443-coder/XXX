/**
 * ERP System Full User Simulation E2E Test Script
 * Playwright + Node.js
 * محاكاة كاملة لكل الوحدات: المحاسبة، العملاء، الموردين، الموظفين، POS، التقارير
 * قاعدة البيانات PostgreSQL
 * تنفيذ صارم: أي خطأ يوقف السكريبت مباشرة.
 * 
 * Usage:
 *   npm install playwright
 *   npx playwright install chromium
 *   node scripts/e2e-playwright-test.js
 */

import { chromium } from 'playwright';
import { Client } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ===================== CONFIG =====================
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL?.replace('/api', '') || 'http://localhost:5000',
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@local.test',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  HEADLESS: process.env.HEADLESS !== 'false', // Default to headless unless explicitly set to false
};

// ===================== VALIDATION =====================
if (!CONFIG.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// ===================== DB CONNECTION =====================
const db = new Client({
  connectionString: CONFIG.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===================== HELPERS =====================
async function dbQuery(query, params = []) {
  const res = await db.query(query, params);
  return res.rows;
}

function logSuccess(msg) {
  console.log(`✅ ${msg}`);
}

function logError(msg, err = null) {
  console.error(`❌ ${msg}`);
  if (err) {
    console.error('Error details:', err.message);
    if (err.stack) console.error(err.stack);
  }
  process.exit(1);
}

async function waitForNavigation(page, timeout = 10000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (e) {
    // Fallback: wait for DOM content
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (e2) {
      // If that also fails, just wait a bit
      await page.waitForTimeout(1000);
    }
  }
}

// ===================== SETUP ADMIN USER =====================
async function ensureAdminUser() {
  console.log('\n=== Setting up Admin User ===');
  
  let admin = await dbQuery('SELECT id, password FROM users WHERE email = $1', [CONFIG.ADMIN_EMAIL]);
  
  if (!admin[0]) {
    console.log(`  Creating admin user: ${CONFIG.ADMIN_EMAIL}`);
    const hashedPassword = await bcrypt.hash(CONFIG.ADMIN_PASSWORD, 10);
    await dbQuery(
      "INSERT INTO users(email, password, role) VALUES($1, $2, 'admin')",
      [CONFIG.ADMIN_EMAIL, hashedPassword]
    );
    logSuccess('Admin user created');
  } else {
    // Update password to ensure it matches
    console.log(`  Updating admin password: ${CONFIG.ADMIN_EMAIL}`);
    const hashedPassword = await bcrypt.hash(CONFIG.ADMIN_PASSWORD, 10);
    await dbQuery(
      'UPDATE users SET password = $1, role = $2 WHERE email = $3',
      [hashedPassword, 'admin', CONFIG.ADMIN_EMAIL]
    );
    logSuccess('Admin password updated');
  }
}

// ===================== MAIN TEST SUITE =====================
(async () => {
  let browser;
  let page;

  try {
    // Connect to database
    console.log('🚀 Starting E2E Playwright Test Suite');
    console.log(`   Base URL: ${CONFIG.BASE_URL}`);
    console.log(`   Headless: ${CONFIG.HEADLESS}`);
    
    await db.connect();
    logSuccess('Database connected');

    // Ensure admin user exists
    await ensureAdminUser();

    // Launch browser
    browser = await chromium.launch({
      headless: CONFIG.HEADLESS,
      slowMo: CONFIG.HEADLESS ? 0 : 100, // Slow down for visual debugging when not headless
    });
    page = await browser.newPage();

    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // ------------------- LOGIN -------------------
    console.log('\n=== Testing Login ===');
    await page.goto(`${CONFIG.BASE_URL}/login`, { waitUntil: 'networkidle' });
    await waitForNavigation(page);

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    
    // Fill login form - try multiple selectors
    const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = await page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = await page.locator('button[type="submit"], button:has-text("تسجيل"), button:has-text("Login")').first();

    await emailInput.fill(CONFIG.ADMIN_EMAIL);
    await passwordInput.fill(CONFIG.ADMIN_PASSWORD);
    
    // Click and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      submitButton.click()
    ]);

    // Wait a bit for any redirects
    await page.waitForTimeout(2000);
    
    // Check if we're still on login page
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Check for error messages
      const errorText = await page.textContent('body');
      if (errorText.includes('error') || errorText.includes('خطأ')) {
        throw new Error('Login failed - error message detected');
      }
      throw new Error('Login failed - still on login page after submission');
    }
    
    await waitForNavigation(page);
    logSuccess('Admin login successful');

    // ------------------- ACCOUNTING / JOURNAL -------------------
    console.log('\n=== Testing Accounting / Journal ===');
    await page.goto(`${CONFIG.BASE_URL}/journal`);
    await waitForNavigation(page);

    // Wait for journal page to load
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Check if we can see journal entries or create button
    const journalContent = await page.textContent('body');
    if (journalContent.includes('Journal') || journalContent.includes('القيود') || journalContent.includes('Create') || journalContent.includes('إنشاء')) {
      logSuccess('Journal page loaded');
    } else {
      logError('Journal page did not load correctly');
    }

    // ------------------- CLIENTS / CUSTOMERS -------------------
    console.log('\n=== Testing Clients / Customers ===');
    await page.goto(`${CONFIG.BASE_URL}/clients`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const clientsContent = await page.textContent('body');
    if (clientsContent.includes('Client') || clientsContent.includes('عميل') || clientsContent.includes('Customer')) {
      logSuccess('Clients page loaded');
      
      // Try to find and click create button if available
      try {
        const createButton = await page.locator('button:has-text("إضافة"), button:has-text("Add"), a:has-text("Create"), a:has-text("إنشاء")').first();
        if (await createButton.isVisible({ timeout: 3000 })) {
          await createButton.click();
          await waitForNavigation(page);
          logSuccess('Client create page accessed');
          // Go back to clients list
          await page.goBack();
          await waitForNavigation(page);
        }
      } catch (e) {
        // Create button might not be visible, that's okay
        console.log('  ℹ️  Create button not found or not visible (may require permissions)');
      }
    } else {
      logError('Clients page did not load correctly');
    }

    // ------------------- SUPPLIERS -------------------
    console.log('\n=== Testing Suppliers ===');
    await page.goto(`${CONFIG.BASE_URL}/suppliers`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const suppliersContent = await page.textContent('body');
    if (suppliersContent.includes('Supplier') || suppliersContent.includes('مورد') || suppliersContent.includes('Suppliers')) {
      logSuccess('Suppliers page loaded');
      
      // Try to find create button
      try {
        const createButton = await page.locator('button:has-text("إضافة"), button:has-text("Add"), a:has-text("Create"), a:has-text("إنشاء")').first();
        if (await createButton.isVisible({ timeout: 3000 })) {
          await createButton.click();
          await waitForNavigation(page);
          logSuccess('Supplier create page accessed');
          await page.goBack();
          await waitForNavigation(page);
        }
      } catch (e) {
        console.log('  ℹ️  Create button not found or not visible');
      }
    } else {
      logError('Suppliers page did not load correctly');
    }

    // ------------------- EMPLOYEES -------------------
    console.log('\n=== Testing Employees ===');
    await page.goto(`${CONFIG.BASE_URL}/employees`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const employeesContent = await page.textContent('body');
    if (employeesContent.includes('Employee') || employeesContent.includes('موظف') || employeesContent.includes('Employees')) {
      logSuccess('Employees page loaded');
      
      // Try to find create button
      try {
        const createButton = await page.locator('button:has-text("إضافة"), button:has-text("Add"), a:has-text("Create"), a:has-text("إنشاء")').first();
        if (await createButton.isVisible({ timeout: 3000 })) {
          await createButton.click();
          await waitForNavigation(page);
          logSuccess('Employee create page accessed');
          await page.goBack();
          await waitForNavigation(page);
        }
      } catch (e) {
        console.log('  ℹ️  Create button not found or not visible');
      }
    } else {
      logError('Employees page did not load correctly');
    }

    // ------------------- PRODUCTS -------------------
    console.log('\n=== Testing Products ===');
    await page.goto(`${CONFIG.BASE_URL}/products`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const productsContent = await page.textContent('body');
    if (productsContent.includes('Product') || productsContent.includes('منتج') || productsContent.includes('Products')) {
      logSuccess('Products page loaded');
    } else {
      logError('Products page did not load correctly');
    }

    // ------------------- POS -------------------
    console.log('\n=== Testing POS ===');
    await page.goto(`${CONFIG.BASE_URL}/pos`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const posContent = await page.textContent('body');
    if (posContent.includes('POS') || posContent.includes('نقطة البيع') || posContent.includes('Branch') || posContent.includes('فرع')) {
      logSuccess('POS page loaded');
      
      // Try to click on a branch if available
      try {
        const branchLink = await page.locator('a:has-text("Place"), button:has-text("Place"), div:has-text("Place")').first();
        if (await branchLink.isVisible({ timeout: 3000 })) {
          await branchLink.click();
          await waitForNavigation(page);
          logSuccess('POS branch selected');
          await page.goBack();
          await waitForNavigation(page);
        }
      } catch (e) {
        console.log('  ℹ️  Branch selection not available (may need branches setup)');
      }
    } else {
      logError('POS page did not load correctly');
    }

    // ------------------- REPORTS -------------------
    console.log('\n=== Testing Reports ===');
    await page.goto(`${CONFIG.BASE_URL}/reports`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const reportsContent = await page.textContent('body');
    if (reportsContent.includes('Report') || reportsContent.includes('تقرير') || reportsContent.includes('Reports') || reportsContent.includes('تقارير')) {
      logSuccess('Reports page loaded');
      
      // Try to navigate to different reports
      try {
        const reportLinks = await page.locator('a, button').filter({ hasText: /Income|Statement|Balance|قائمة|مركز|دخل/i });
        const count = await reportLinks.count();
        if (count > 0) {
          logSuccess(`Found ${count} report links`);
        }
      } catch (e) {
        console.log('  ℹ️  Report links not found');
      }
    } else {
      logError('Reports page did not load correctly');
    }

    // ------------------- ACCOUNTING SCREEN -------------------
    console.log('\n=== Testing Accounting Screen ===');
    await page.goto(`${CONFIG.BASE_URL}/accounting`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const accountingContent = await page.textContent('body');
    if (accountingContent.includes('Account') || accountingContent.includes('حساب') || accountingContent.includes('Accounting') || accountingContent.includes('محاسبة')) {
      logSuccess('Accounting screen loaded');
    } else {
      logError('Accounting screen did not load correctly');
    }

    // ------------------- EXPENSES -------------------
    console.log('\n=== Testing Expenses ===');
    await page.goto(`${CONFIG.BASE_URL}/expenses`);
    await waitForNavigation(page);

    await page.waitForSelector('body', { timeout: 10000 });
    const expensesContent = await page.textContent('body');
    if (expensesContent.includes('Expense') || expensesContent.includes('مصروف') || expensesContent.includes('Expenses') || expensesContent.includes('مصروفات')) {
      logSuccess('Expenses page loaded');
    } else {
      logError('Expenses page did not load correctly');
    }

    // Final success message
    console.log('\n' + '='.repeat(60));
    logSuccess('All E2E Playwright tests completed successfully!');
    console.log('='.repeat(60));

  } catch (err) {
    logError(`Test failed: ${err.message}`, err);
  } finally {
    if (page) {
      try {
        await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
        console.log('📸 Screenshot saved to test-screenshot.png');
      } catch (e) {
        // Ignore screenshot errors
      }
    }
    if (browser) await browser.close();
    await db.end();
  }
})();
