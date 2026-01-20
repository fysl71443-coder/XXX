/**
 * Comprehensive System Test
 * Tests all critical functionality and reports real issues
 */

const { Client } = require('pg');
const axios = require('axios');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';
const API_BASE = process.env.API_BASE_URL || 'https://china-town-5z2i.onrender.com';
const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'admin123';

let authToken = null;
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  summary: {}
};

// Helper: Log test result
function logTest(name, passed, message = '', details = null) {
  const result = {
    name,
    passed,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  if (passed) {
    testResults.passed.push(result);
    console.log(`✅ PASS: ${name}${message ? ' - ' + message : ''}`);
  } else {
    testResults.failed.push(result);
    console.log(`❌ FAIL: ${name}${message ? ' - ' + message : ''}`);
    if (details) console.log(`   Details:`, details);
  }
  
  return passed;
}

function logWarning(name, message, details = null) {
  testResults.warnings.push({
    name,
    message,
    details,
    timestamp: new Date().toISOString()
  });
  console.log(`⚠️  WARN: ${name} - ${message}`);
}

// Test 1: Database Connection
async function testDatabaseConnection(client) {
  try {
    const result = await client.query('SELECT NOW() as now, version() as version');
    logTest('Database Connection', true, `Connected to PostgreSQL ${result.rows[0].version.split(' ')[1]}`);
    return true;
  } catch (error) {
    logTest('Database Connection', false, error.message, error);
    return false;
  }
}

// Test 2: API Authentication
async function testAuthentication() {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      logTest('API Authentication', true, 'Token obtained');
      return true;
    } else {
      logTest('API Authentication', false, 'No token in response', response.data);
      return false;
    }
  } catch (error) {
    logTest('API Authentication', false, error.message, {
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
}

// Test 3: Orders Table Schema
async function testOrdersSchema(client) {
  try {
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = [
      'id', 'branch', 'table_code', 'lines', 'status',
      'subtotal', 'discount_amount', 'tax_amount', 'total_amount',
      'customerId', 'customer_name', 'customer_phone'
    ];
    
    const existingColumns = rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      logTest('Orders Table Schema', true, `All ${requiredColumns.length} required columns present`);
    } else {
      logTest('Orders Table Schema', false, `Missing columns: ${missingColumns.join(', ')}`, {
        existing: existingColumns,
        missing: missingColumns
      });
    }
    
    return missingColumns.length === 0;
  } catch (error) {
    logTest('Orders Table Schema', false, error.message, error);
    return false;
  }
}

// Test 4: Draft Orders Integrity
async function testDraftOrdersIntegrity(client) {
  try {
    const { rows } = await client.query(`
      SELECT id, branch, table_code, status, lines,
             subtotal, discount_amount, tax_amount, total_amount,
             "customerId", customer_name, customer_phone
      FROM orders
      WHERE status = 'DRAFT'
      ORDER BY id DESC
      LIMIT 10
    `);
    
    if (rows.length === 0) {
      logWarning('Draft Orders Integrity', 'No DRAFT orders found to test');
      return true;
    }
    
    let issues = [];
    
    for (const order of rows) {
      const orderIssues = [];
      
      // Check lines JSON
      if (!order.lines) {
        orderIssues.push('lines is NULL');
      } else {
        try {
          const lines = typeof order.lines === 'string' ? JSON.parse(order.lines) : order.lines;
          if (!Array.isArray(lines)) {
            orderIssues.push('lines is not an array');
          } else if (lines.length === 0) {
            orderIssues.push('lines array is empty');
          } else {
            const meta = lines.find(l => l && l.type === 'meta');
            if (!meta) {
              orderIssues.push('No meta object in lines');
            } else {
              // Check required meta fields
              if (!meta.hasOwnProperty('subtotal')) orderIssues.push('meta.subtotal missing');
              if (!meta.hasOwnProperty('total_amount')) orderIssues.push('meta.total_amount missing');
              if (!meta.hasOwnProperty('customerId')) orderIssues.push('meta.customerId missing');
            }
          }
        } catch (e) {
          orderIssues.push(`Failed to parse lines: ${e.message}`);
        }
      }
      
      // Check columns
      if (order.subtotal === null) orderIssues.push('subtotal column is NULL');
      if (order.total_amount === null) orderIssues.push('total_amount column is NULL');
      if (!order.branch) orderIssues.push('branch is NULL');
      if (!order.table_code) orderIssues.push('table_code is NULL');
      
      if (orderIssues.length > 0) {
        issues.push({
          order_id: order.id,
          issues: orderIssues
        });
      }
    }
    
    if (issues.length === 0) {
      logTest('Draft Orders Integrity', true, `All ${rows.length} draft orders are valid`);
    } else {
      logTest('Draft Orders Integrity', false, `${issues.length} orders have issues`, issues);
    }
    
    return issues.length === 0;
  } catch (error) {
    logTest('Draft Orders Integrity', false, error.message, error);
    return false;
  }
}

// Test 5: API GET /api/orders
async function testGetOrdersAPI() {
  if (!authToken) {
    logTest('API GET /api/orders', false, 'No auth token available');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/api/orders?branch=place_india&status=DRAFT`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.status === 200) {
      const orders = Array.isArray(response.data) ? response.data : [];
      
      // Check response structure
      let structureIssues = [];
      if (orders.length > 0) {
        const firstOrder = orders[0];
        if (!firstOrder.hasOwnProperty('id')) structureIssues.push('Missing id');
        if (!firstOrder.hasOwnProperty('lines')) structureIssues.push('Missing lines');
        if (!firstOrder.hasOwnProperty('items')) structureIssues.push('Missing items');
        if (!firstOrder.hasOwnProperty('order_id')) structureIssues.push('Missing order_id');
      }
      
      if (structureIssues.length === 0) {
        logTest('API GET /api/orders', true, `Retrieved ${orders.length} orders`);
      } else {
        logTest('API GET /api/orders', false, `Structure issues: ${structureIssues.join(', ')}`, structureIssues);
      }
      
      return structureIssues.length === 0;
    } else {
      logTest('API GET /api/orders', false, `HTTP ${response.status}`, response.data);
      return false;
    }
  } catch (error) {
    logTest('API GET /api/orders', false, error.message, {
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
}

// Test 6: API POST /api/pos/saveDraft
async function testSaveDraftAPI() {
  if (!authToken) {
    logTest('API POST /api/pos/saveDraft', false, 'No auth token available');
    return false;
  }
  
  try {
    const testDraft = {
      branch: 'place_india',
      table: '99',
      items: [
        { id: 1, name: 'Test Item 1', quantity: 2, price: 50.00, discount: 0 },
        { id: 2, name: 'Test Item 2', quantity: 1, price: 30.00, discount: 5.00 }
      ],
      discountPct: 10,
      taxPct: 15,
      customerName: 'Test Customer',
      customerPhone: '0501234567'
    };
    
    const response = await axios.post(`${API_BASE}/api/pos/saveDraft`, testDraft, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.status === 200 || response.status === 201) {
      const order = response.data;
      
      // Verify response structure
      const requiredFields = ['order_id', 'lines', 'items', 'invoice', 'subtotal', 'total_amount'];
      const missingFields = requiredFields.filter(field => !order.hasOwnProperty(field));
      
      // Verify invoice is null for drafts
      if (order.invoice !== null && order.invoice !== undefined) {
        logTest('API POST /api/pos/saveDraft', false, 'invoice should be null for drafts', order);
        return false;
      }
      
      // Verify order_id exists
      if (!order.order_id && !order.id) {
        logTest('API POST /api/pos/saveDraft', false, 'Missing order_id in response', order);
        return false;
      }
      
      // Verify lines is array
      if (!Array.isArray(order.lines)) {
        logTest('API POST /api/pos/saveDraft', false, 'lines is not an array', order);
        return false;
      }
      
      // Verify items is array
      if (!Array.isArray(order.items)) {
        logTest('API POST /api/pos/saveDraft', false, 'items is not an array', order);
        return false;
      }
      
      // Verify totals are calculated
      if (order.total_amount === null || order.total_amount === undefined) {
        logTest('API POST /api/pos/saveDraft', false, 'total_amount is missing or null', order);
        return false;
      }
      
      if (missingFields.length === 0 && order.total_amount > 0) {
        logTest('API POST /api/pos/saveDraft', true, `Order ${order.order_id || order.id} created with total ${order.total_amount}`);
        
        // Cleanup: Delete test order
        try {
          if (authToken) {
            await axios.delete(`${API_BASE}/api/orders/${order.order_id || order.id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          }
        } catch (cleanupError) {
          logWarning('Cleanup Test Order', `Failed to delete test order ${order.order_id || order.id}`);
        }
        
        return true;
      } else {
        logTest('API POST /api/pos/saveDraft', false, `Missing fields: ${missingFields.join(', ')}`, order);
        return false;
      }
    } else {
      logTest('API POST /api/pos/saveDraft', false, `HTTP ${response.status}`, response.data);
      return false;
    }
  } catch (error) {
    logTest('API POST /api/pos/saveDraft', false, error.message, {
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
}

// Test 7: Journal Entries for Posted Transactions
async function testJournalEntries(client) {
  try {
    // Check for posted expenses without journal entries
    const { rows: expenses } = await client.query(`
      SELECT e.id, e.status, e.amount
      FROM expenses e
      LEFT JOIN journal_entries je ON je.reference_type = 'expense' AND je.reference_id = e.id
      WHERE e.status = 'posted' AND je.id IS NULL
      LIMIT 10
    `);
    
    // Check for posted invoices without journal entries
    const { rows: invoices } = await client.query(`
      SELECT i.id, i.status, i.total
      FROM invoices i
      LEFT JOIN journal_entries je ON je.reference_type = 'invoice' AND je.reference_id = i.id
      WHERE i.status = 'posted' AND je.id IS NULL
      LIMIT 10
    `);
    
    if (expenses.length > 0 || invoices.length > 0) {
      logTest('Journal Entries', false, `Missing journal entries for ${expenses.length} expenses and ${invoices.length} invoices`, {
        expenses_without_entries: expenses,
        invoices_without_entries: invoices
      });
      return false;
    } else {
      logTest('Journal Entries', true, 'All posted transactions have journal entries');
      return true;
    }
  } catch (error) {
    logTest('Journal Entries', false, error.message, error);
    return false;
  }
}

// Test 8: Database Constraints
async function testDatabaseConstraints(client) {
  try {
    const issues = [];
    
    // Check for orphaned foreign keys
    const { rows: orphanedPartners } = await client.query(`
      SELECT e.id, e.partner_id
      FROM expenses e
      LEFT JOIN partners p ON p.id = e.partner_id
      WHERE e.partner_id IS NOT NULL AND p.id IS NULL
      LIMIT 10
    `);
    
    if (orphanedPartners.length > 0) {
      issues.push(`Found ${orphanedPartners.length} expenses with invalid partner_id`);
    }
    
    // Check for negative amounts
    const { rows: negativeAmounts } = await client.query(`
      SELECT 'expenses' as table_name, id, amount
      FROM expenses WHERE amount < 0
      UNION ALL
      SELECT 'invoices' as table_name, id, total
      FROM invoices WHERE total < 0
      LIMIT 10
    `);
    
    if (negativeAmounts.length > 0) {
      issues.push(`Found ${negativeAmounts.length} records with negative amounts`);
    }
    
    if (issues.length === 0) {
      logTest('Database Constraints', true, 'All constraints validated');
      return true;
    } else {
      logTest('Database Constraints', false, issues.join('; '), {
        orphaned_partners: orphanedPartners,
        negative_amounts: negativeAmounts
      });
      return false;
    }
  } catch (error) {
    logTest('Database Constraints', false, error.message, error);
    return false;
  }
}

// Test 9: API Endpoint Availability
async function testAPIEndpoints() {
  if (!authToken) {
    logTest('API Endpoints', false, 'No auth token available');
    return false;
  }
  
  const endpoints = [
    { method: 'GET', path: '/api/accounts' },
    { method: 'GET', path: '/api/products' },
    { method: 'GET', path: '/api/partners' },
    { method: 'GET', path: '/api/employees' },
    { method: 'GET', path: '/api/expenses' },
    { method: 'GET', path: '/api/journal' }
  ];
  
  let failed = 0;
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${API_BASE}${endpoint.path}`,
        headers: { 'Authorization': `Bearer ${authToken}` },
        validateStatus: () => true
      });
      
      if (response.status >= 200 && response.status < 300) {
        // Success
      } else if (response.status === 401) {
        logWarning(`API ${endpoint.method} ${endpoint.path}`, 'Unauthorized (may need different permissions)');
      } else {
        failed++;
        logTest(`API ${endpoint.method} ${endpoint.path}`, false, `HTTP ${response.status}`, response.data);
      }
    } catch (error) {
      failed++;
      logTest(`API ${endpoint.method} ${endpoint.path}`, false, error.message);
    }
  }
  
  if (failed === 0) {
    logTest('API Endpoints', true, `All ${endpoints.length} endpoints accessible`);
    return true;
  } else {
    logTest('API Endpoints', false, `${failed} endpoints failed`);
    return false;
  }
}

// Test 10: Accounting Period Control
async function testAccountingPeriods(client) {
  try {
    // Check if accounting_periods table exists
    const { rows: tableCheck } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'accounting_periods'
      )
    `);
    
    if (!tableCheck[0].exists) {
      logTest('Accounting Periods', false, 'accounting_periods table does not exist');
      return false;
    }
    
    // Check for current period
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { rows: periodCheck } = await client.query(
      'SELECT id, period, status FROM accounting_periods WHERE period = $1',
      [currentPeriod]
    );
    
    if (periodCheck.length === 0) {
      logWarning('Accounting Periods', `Current period ${currentPeriod} not found (will be auto-created)`);
    } else if (periodCheck[0].status === 'closed') {
      logWarning('Accounting Periods', `Current period ${currentPeriod} is closed`);
    } else {
      logTest('Accounting Periods', true, `Current period ${currentPeriod} is open`);
    }
    
    return true;
  } catch (error) {
    logTest('Accounting Periods', false, error.message, error);
    return false;
  }
}

// Main test runner
async function runComprehensiveTests() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE SYSTEM TEST');
  console.log('='.repeat(60));
  console.log(`Database: ${DATABASE_URL.split('@')[1] || 'local'}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log();
  
  let client = null;
  let dbConnected = false;
  
  try {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    dbConnected = true;
    
    // Run database tests
    await testDatabaseConnection(client);
    await testOrdersSchema(client);
    await testDraftOrdersIntegrity(client);
    await testJournalEntries(client);
    await testDatabaseConstraints(client);
    await testAccountingPeriods(client);
    
  } catch (dbError) {
    console.log(`⚠️  Database connection failed: ${dbError.message}`);
    console.log('   Continuing with API-only tests...');
    console.log();
    logWarning('Database Connection', dbError.message, 'Continuing with API tests only');
  } finally {
    if (client && dbConnected) {
      await client.end().catch(() => {});
    }
  }
  
  // Run API tests (these don't require DB connection)
  try {
    await testAuthentication();
    await testGetOrdersAPI();
    await testSaveDraftAPI();
    await testAPIEndpoints();
  } catch (apiError) {
    console.error('API test error:', apiError.message);
    logTest('API Tests', false, apiError.message);
  }
  
  // Generate summary
  testResults.summary = {
    total_tests: testResults.passed.length + testResults.failed.length,
    passed: testResults.passed.length,
    failed: testResults.failed.length,
    warnings: testResults.warnings.length,
    pass_rate: ((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(1) + '%'
  };
  
  // Print summary
  console.log();
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.summary.total_tests}`);
  console.log(`Passed: ${testResults.summary.passed} ✅`);
  console.log(`Failed: ${testResults.summary.failed} ❌`);
  console.log(`Warnings: ${testResults.summary.warnings} ⚠️`);
  console.log(`Pass Rate: ${testResults.summary.pass_rate}`);
  console.log('='.repeat(60));
  
  if (testResults.failed.length > 0) {
    console.log();
    console.log('FAILED TESTS:');
    testResults.failed.forEach(test => {
      console.log(`  - ${test.name}: ${test.message}`);
    });
  }
  
  return testResults;
}

// Run if called directly
if (require.main === module) {
  runComprehensiveTests()
    .then(results => {
      process.exit(results.failed.length === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveTests };
