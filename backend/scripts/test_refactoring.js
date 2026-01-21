/**
 * Comprehensive test script for Phase 1 and Phase 2 refactoring
 * Tests backend routes (Phase 1) and frontend hooks (Phase 2)
 */

import { pool } from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
let authToken = null;
let testUserId = null;
let testEmail = 'test_refactoring@example.com';
let testPassword = 'test123456';

const tests = {
  passed: 0,
  failed: 0,
  errors: []
};

function log(message) {
  console.log(`[TEST] ${message}`);
}

async function test(name, fn) {
  try {
    await fn();
    tests.passed++;
    log(`✅ ${name}`);
  } catch (error) {
    tests.failed++;
    tests.errors.push({ name, error: error.message });
    log(`❌ ${name}: ${error.message}`);
  }
}

async function fetchAPI(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
  }
  
  return response;
}

async function setupTestUser() {
  log('Setting up test user...');
  try {
    const { rows: existing } = await pool.query('SELECT id FROM "users" WHERE email = $1', [testEmail]);
    
    if (existing && existing.length > 0) {
      testUserId = existing[0].id;
      log(`Test user exists: ${testUserId}`);
    } else {
      const bcrypt = (await import('bcrypt')).default;
      const hashed = await bcrypt.hash(testPassword, 10);
      const { rows } = await pool.query(
        'INSERT INTO "users" (email, password, role) VALUES ($1, $2, $3) RETURNING id',
        [testEmail, hashed, 'admin']
      );
      testUserId = rows[0].id;
      log(`Test user created: ${testUserId}`);
    }
    
    const loginResponse = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('Failed to login');
    }
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    log(`Auth token obtained: ${authToken ? 'Yes' : 'No'}`);
    
  } catch (error) {
    log(`Warning: Could not setup test user: ${error.message}`);
  }
}

// Phase 1 Tests: Backend Routes
async function testPhase1() {
  log('\n' + '='.repeat(60));
  log('PHASE 1: Backend Routes Refactoring Tests');
  log('='.repeat(60));
  
  // Test Auth Routes
  await test('Auth - Login', async () => {
    const response = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();
    if (!data.token) throw new Error('No token in response');
  });
  
  await test('Auth - Me', async () => {
    const response = await fetchAPI('/api/auth/me');
    if (!response.ok) throw new Error('Me endpoint failed');
    const data = await response.json();
    if (!data.id) throw new Error('No user data in response');
  });
  
  // Test Orders Routes
  await test('Orders - List', async () => {
    const response = await fetchAPI('/api/orders');
    if (!response.ok) throw new Error('Orders list failed');
  });
  
  // Test Invoices Routes
  await test('Invoices - List', async () => {
    const response = await fetchAPI('/api/invoices');
    if (!response.ok) throw new Error('Invoices list failed');
  });
  
  await test('Invoices - Next Number', async () => {
    const response = await fetchAPI('/api/invoices/next-number');
    if (!response.ok) throw new Error('Next number failed');
  });
  
  // Test POS Routes
  await test('POS - Tables Layout', async () => {
    const response = await fetchAPI('/api/pos/tables-layout');
    if (!response.ok) throw new Error('Tables layout failed');
  });
  
  // Test Products Routes
  await test('Products - List', async () => {
    const response = await fetchAPI('/api/products');
    if (!response.ok) throw new Error('Products list failed');
  });
  
  // Test Partners Routes
  await test('Partners - List', async () => {
    const response = await fetchAPI('/api/partners');
    if (!response.ok) throw new Error('Partners list failed');
  });
  
  // Test Accounts Routes
  await test('Accounts - List', async () => {
    const response = await fetchAPI('/api/accounts');
    if (!response.ok) throw new Error('Accounts list failed');
  });
  
  // Test Users Routes
  await test('Users - List', async () => {
    const response = await fetchAPI('/api/users');
    if (!response.ok) throw new Error('Users list failed');
  });
  
  // Test Settings Routes
  await test('Settings - List', async () => {
    const response = await fetchAPI('/api/settings');
    if (!response.ok) throw new Error('Settings list failed');
  });
  
  // Test Reports Routes
  await test('Reports - Trial Balance', async () => {
    const response = await fetchAPI('/api/reports/trial-balance');
    if (!response.ok) throw new Error('Trial balance failed');
  });
}

// Phase 2 Tests: Frontend Hooks
async function testPhase2() {
  log('\n' + '='.repeat(60));
  log('PHASE 2: Frontend Hooks Refactoring Tests');
  log('='.repeat(60));
  
  // Check if hooks files exist
  const hooksPath = join(__dirname, '..', 'frontend', 'src', 'hooks');
  
  await test('Hook Files - useOrder.js exists', async () => {
    const useOrderPath = join(hooksPath, 'useOrder.js');
    try {
      readFileSync(useOrderPath, 'utf-8');
    } catch (e) {
      throw new Error('useOrder.js not found');
    }
  });
  
  await test('Hook Files - useInvoice.js exists', async () => {
    const useInvoicePath = join(hooksPath, 'useInvoice.js');
    try {
      readFileSync(useInvoicePath, 'utf-8');
    } catch (e) {
      throw new Error('useInvoice.js not found');
    }
  });
  
  await test('Hook Files - usePayments.js exists', async () => {
    const usePaymentsPath = join(hooksPath, 'usePayments.js');
    try {
      readFileSync(usePaymentsPath, 'utf-8');
    } catch (e) {
      throw new Error('usePayments.js not found');
    }
  });
  
  // Check if POSInvoice.jsx uses hooks
  await test('POSInvoice.jsx - Imports hooks', async () => {
    const posInvoicePath = join(__dirname, '..', 'frontend', 'src', 'pages', 'POSInvoice.jsx');
    const content = readFileSync(posInvoicePath, 'utf-8');
    if (!content.includes('useOrder') || !content.includes('useInvoice') || !content.includes('usePayments')) {
      throw new Error('POSInvoice.jsx does not import hooks');
    }
  });
  
  await test('POSInvoice.jsx - Uses hooks', async () => {
    const posInvoicePath = join(__dirname, '..', 'frontend', 'src', 'pages', 'POSInvoice.jsx');
    const content = readFileSync(posInvoicePath, 'utf-8');
    if (!content.includes('orderHook') || !content.includes('invoiceHook') || !content.includes('paymentsHook')) {
      throw new Error('POSInvoice.jsx does not use hooks');
    }
  });
}

async function main() {
  try {
    log('='.repeat(60));
    log('Refactoring Test Suite');
    log('='.repeat(60));
    
    await setupTestUser();
    
    if (!authToken) {
      log('ERROR: Could not obtain auth token. Some tests may fail.');
    }
    
    await testPhase1();
    await testPhase2();
    
    log('\n' + '='.repeat(60));
    log('Test Results Summary');
    log('='.repeat(60));
    log(`✅ Passed: ${tests.passed}`);
    log(`❌ Failed: ${tests.failed}`);
    log(`Total: ${tests.passed + tests.failed}`);
    
    if (tests.errors.length > 0) {
      log('\nErrors:');
      tests.errors.forEach(({ name, error }) => {
        log(`  - ${name}: ${error}`);
      });
    }
    
    log('\n' + '='.repeat(60));
    
    if (tests.failed === 0) {
      log('✅ All tests passed! Refactoring is successful.');
      process.exit(0);
    } else {
      log('❌ Some tests failed. Please review the errors above.');
      process.exit(1);
    }
    
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
