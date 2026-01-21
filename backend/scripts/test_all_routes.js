/**
 * Test script to verify all extracted routes are working
 * Run: node scripts/test_all_routes.js
 */

import { pool } from '../db.js';

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
let authToken = null;
let testUserId = null;
let testEmail = 'test_routes@example.com';
let testPassword = 'test123456';

const tests = {
  passed: 0,
  failed: 0,
  errors: []
};

async function log(message) {
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
    // Check if user exists
    const { rows: existing } = await pool.query('SELECT id FROM "users" WHERE email = $1', [testEmail]);
    
    if (existing && existing.length > 0) {
      testUserId = existing[0].id;
      log(`Test user exists: ${testUserId}`);
    } else {
      // Create test user
      const bcrypt = (await import('bcrypt')).default;
      const hashed = await bcrypt.hash(testPassword, 10);
      const { rows } = await pool.query(
        'INSERT INTO "users" (email, password, role) VALUES ($1, $2, $3) RETURNING id',
        [testEmail, hashed, 'admin']
      );
      testUserId = rows[0].id;
      log(`Test user created: ${testUserId}`);
    }
    
    // Login to get token
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

async function runTests() {
  log('Starting route tests...\n');
  
  // Test 1: Auth Routes
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
  
  // Test 2: Journal Routes
  await test('Journal - List', async () => {
    const response = await fetchAPI('/api/journal');
    if (!response.ok) throw new Error('Journal list failed');
  });
  
  // Test 3: Orders Routes
  await test('Orders - List', async () => {
    const response = await fetchAPI('/api/orders');
    if (!response.ok) throw new Error('Orders list failed');
  });
  
  // Test 4: Invoices Routes
  await test('Invoices - List', async () => {
    const response = await fetchAPI('/api/invoices');
    if (!response.ok) throw new Error('Invoices list failed');
  });
  
  await test('Invoices - Next Number', async () => {
    const response = await fetchAPI('/api/invoices/next-number');
    if (!response.ok) throw new Error('Next number failed');
  });
  
  // Test 5: POS Routes
  await test('POS - Tables Layout', async () => {
    const response = await fetchAPI('/api/pos/tables-layout');
    if (!response.ok) throw new Error('Tables layout failed');
  });
  
  // Test 6: Expenses Routes
  await test('Expenses - List', async () => {
    const response = await fetchAPI('/api/expenses');
    if (!response.ok) throw new Error('Expenses list failed');
  });
  
  // Test 7: Partners Routes
  await test('Partners - List', async () => {
    const response = await fetchAPI('/api/partners');
    if (!response.ok) throw new Error('Partners list failed');
  });
  
  await test('Customers - List (alias)', async () => {
    const response = await fetchAPI('/api/customers');
    if (!response.ok) throw new Error('Customers list failed');
  });
  
  // Test 8: Products Routes
  await test('Products - List', async () => {
    const response = await fetchAPI('/api/products');
    if (!response.ok) throw new Error('Products list failed');
  });
  
  // Test 9: Accounts Routes
  await test('Accounts - List', async () => {
    const response = await fetchAPI('/api/accounts');
    if (!response.ok) throw new Error('Accounts list failed');
  });
  
  // Test 10: Users Routes
  await test('Users - List', async () => {
    const response = await fetchAPI('/api/users');
    if (!response.ok) throw new Error('Users list failed');
  });
  
  // Test 11: Settings Routes
  await test('Settings - List', async () => {
    const response = await fetchAPI('/api/settings');
    if (!response.ok) throw new Error('Settings list failed');
  });
  
  // Test 12: Reports Routes
  await test('Reports - Trial Balance', async () => {
    const response = await fetchAPI('/api/reports/trial-balance');
    if (!response.ok) throw new Error('Trial balance failed');
  });
  
  await test('Reports - Sales vs Expenses', async () => {
    const response = await fetchAPI('/api/reports/sales-vs-expenses');
    if (!response.ok) throw new Error('Sales vs expenses failed');
  });
  
  await test('Reports - Sales by Branch', async () => {
    const response = await fetchAPI('/api/reports/sales-by-branch');
    if (!response.ok) throw new Error('Sales by branch failed');
  });
  
  await test('Reports - Expenses by Branch', async () => {
    const response = await fetchAPI('/api/reports/expenses-by-branch');
    if (!response.ok) throw new Error('Expenses by branch failed');
  });
}

async function main() {
  try {
    log('='.repeat(60));
    log('Route Testing Script');
    log('='.repeat(60));
    
    await setupTestUser();
    
    if (!authToken) {
      log('ERROR: Could not obtain auth token. Some tests may fail.');
    }
    
    await runTests();
    
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
      log('✅ All tests passed! Routes are working correctly.');
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
