#!/usr/bin/env node
/**
 * سكريبت اختبار شامل لجميع API Endpoints
 * 
 * يختبر:
 * - CRUD operations لكل endpoint
 * - Foreign keys integrity
 * - Posting operations
 * - Error handling
 * 
 * الاستخدام:
 *   node backend/scripts/test-api-endpoints.js
 * 
 * متطلبات:
 *   - الخادم يجب أن يكون يعمل على http://localhost:4000 (أو PORT المحدد)
 *   - يجب وجود مستخدم admin في قاعدة البيانات
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api`;

// بيانات تسجيل الدخول
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'fysl71443@gmail.com',
  password: process.env.TEST_PASSWORD || 'StrongPass123'
};

let authToken = null;
let testData = {
  accounts: [],
  expenses: [],
  invoices: [],
  journalEntries: [],
  orders: []
};

// ============================================
// Helper Functions
// ============================================

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

function logTest(name, result) {
  const icon = result.success ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (!result.success) {
    console.log(`   خطأ: ${JSON.stringify(result.error)}`);
  }
  return result.success;
}

// ============================================
// Authentication Tests
// ============================================

async function testLogin() {
  console.log('\n🔐 اختبار تسجيل الدخول...');
  const result = await makeRequest('POST', '/auth/login', TEST_USER);
  
  if (result.success && result.data.token) {
    authToken = result.data.token;
    console.log('✅ تم تسجيل الدخول بنجاح');
    return true;
  } else {
    console.log('❌ فشل تسجيل الدخول');
    console.log('   تأكد من وجود مستخدم admin في قاعدة البيانات');
    return false;
  }
}

// ============================================
// Accounts Tests
// ============================================

async function testAccounts() {
  console.log('\n📊 اختبار الحسابات (Accounts)...');
  
  // GET - List accounts
  const listResult = await makeRequest('GET', '/accounts');
  logTest('GET /api/accounts', listResult);
  
  // Handle both array response and { items: [] } response
  let accounts = [];
  if (listResult.success) {
    if (Array.isArray(listResult.data)) {
      accounts = listResult.data;
    } else if (listResult.data?.items && Array.isArray(listResult.data.items)) {
      accounts = listResult.data.items;
    } else if (listResult.data?.items && Array.isArray(listResult.data)) {
      accounts = listResult.data;
    }
  }
  
  if (accounts.length > 0) {
    testData.accounts = accounts;
    console.log(`   تم جلب ${testData.accounts.length} حساب`);
    
    // GET - Get single account
    const accountId = testData.accounts[0].id;
    const getResult = await makeRequest('GET', `/accounts/${accountId}`);
    logTest(`GET /api/accounts/${accountId}`, getResult);
  } else {
    console.log('   ⚠️ لا توجد حسابات في قاعدة البيانات');
  }
}

// ============================================
// Expenses Tests
// ============================================

async function testExpenses() {
  console.log('\n💰 اختبار المصروفات (Expenses)...');
  
  // POST - Create expense
  const newExpense = {
    type: 'expense',
    amount: 100,
    total: 100,
    account_code: testData.accounts[0]?.account_code || '5210',
    description: 'مصروف اختبار',
    status: 'draft',
    branch: 'china_town',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'cash'
  };
  
  const createResult = await makeRequest('POST', '/expenses', newExpense);
  const expenseCreated = logTest('POST /api/expenses (Create)', createResult);
  
  if (expenseCreated && createResult.data?.id) {
    const expenseId = createResult.data.id;
    testData.expenses.push({ id: expenseId, ...newExpense });
    
    // GET - Get expense
    const getResult = await makeRequest('GET', `/expenses/${expenseId}`);
    logTest(`GET /api/expenses/${expenseId}`, getResult);
    
    // PUT - Update expense
    const updateData = { description: 'مصروف محدث' };
    const updateResult = await makeRequest('PUT', `/expenses/${expenseId}`, updateData);
    logTest(`PUT /api/expenses/${expenseId} (Update)`, updateResult);
    
    // POST - Post expense
    const postResult = await makeRequest('POST', `/expenses/${expenseId}/post`);
    const posted = logTest(`POST /api/expenses/${expenseId}/post`, postResult);
    
    if (posted) {
      // Verify journal_entry_id was set
      const verifyResult = await makeRequest('GET', `/expenses/${expenseId}`);
      if (verifyResult.success && verifyResult.data?.journal_entry_id) {
        console.log(`   ✅ تم ربط المصروف بقيد #${verifyResult.data.journal_entry_id}`);
        testData.journalEntries.push({ id: verifyResult.data.journal_entry_id });
      } else {
        console.log('   ⚠️ لم يتم ربط المصروف بقيد');
      }
    }
    
    // GET - List expenses
    const listResult = await makeRequest('GET', '/expenses');
    logTest('GET /api/expenses (List)', listResult);
  }
}

// ============================================
// Invoices Tests
// ============================================

async function testInvoices() {
  console.log('\n📄 اختبار الفواتير (Invoices)...');
  
  // POST - Create invoice
  const newInvoice = {
    number: `INV-TEST-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    customer_id: null,
    lines: [],
    subtotal: 200,
    tax_pct: 15,
    tax_amount: 30,
    total: 230,
    status: 'draft',
    branch: 'china_town'
  };
  
  const createResult = await makeRequest('POST', '/invoices', newInvoice);
  const invoiceCreated = logTest('POST /api/invoices (Create)', createResult);
  
  if (invoiceCreated && createResult.data?.id) {
    const invoiceId = createResult.data.id;
    testData.invoices.push({ id: invoiceId, ...newInvoice });
    
    // GET - Get invoice
    const getResult = await makeRequest('GET', `/invoices/${invoiceId}`);
    logTest(`GET /api/invoices/${invoiceId}`, getResult);
    
    // PUT - Update invoice
    const updateData = { subtotal: 250, total: 287.5 };
    const updateResult = await makeRequest('PUT', `/invoices/${invoiceId}`, updateData);
    logTest(`PUT /api/invoices/${invoiceId} (Update)`, updateResult);
    
    // GET - List invoices
    const listResult = await makeRequest('GET', '/invoices');
    logTest('GET /api/invoices (List)', listResult);
  }
}

// ============================================
// Journal Entries Tests
// ============================================

async function testJournalEntries() {
  console.log('\n📚 اختبار القيود المحاسبية (Journal Entries)...');
  
  // GET - List journal entries
  const listResult = await makeRequest('GET', '/journal');
  logTest('GET /api/journal (List)', listResult);
  
  if (listResult.success && listResult.data?.items?.length > 0) {
    testData.journalEntries = listResult.data.items;
    console.log(`   تم جلب ${testData.journalEntries.length} قيد`);
    
    // GET - Get single entry
    const entryId = testData.journalEntries[0].id;
    const getResult = await makeRequest('GET', `/journal/${entryId}`);
    logTest(`GET /api/journal/${entryId}`, getResult);
  } else {
    console.log('   ⚠️ لا توجد قيود في قاعدة البيانات');
  }
}

// ============================================
// Orders Tests
// ============================================

async function testOrders() {
  console.log('\n🛒 اختبار الطلبات (Orders)...');
  
  // GET - List orders
  const listResult = await makeRequest('GET', '/orders');
  logTest('GET /api/orders (List)', listResult);
  
  if (listResult.success) {
    if (listResult.data?.items?.length > 0) {
      testData.orders = listResult.data.items;
      console.log(`   تم جلب ${testData.orders.length} طلب`);
    } else {
      console.log('   ⚠️ لا توجد طلبات في قاعدة البيانات');
    }
  }
}

// ============================================
// Foreign Keys Integrity Tests
// ============================================

async function testForeignKeysIntegrity() {
  console.log('\n🔗 اختبار سلامة Foreign Keys...');
  
  // Test expense -> journal_entry relationship
  if (testData.expenses.length > 0) {
    const expense = testData.expenses[0];
    const getResult = await makeRequest('GET', `/expenses/${expense.id}`);
    
    if (getResult.success && getResult.data?.journal_entry_id) {
      const journalId = getResult.data.journal_entry_id;
      const journalResult = await makeRequest('GET', `/journal/${journalId}`);
      
      if (journalResult.success) {
        console.log(`   ✅ المصروف #${expense.id} مربوط بقيد #${journalId}`);
      } else {
        console.log(`   ❌ القيد #${journalId} غير موجود (Foreign Key broken)`);
      }
    }
  }
}

// ============================================
// Main Test Runner
// ============================================

async function runAllTests() {
  console.log('🧪 بدء اختبار شامل لجميع API Endpoints');
  console.log('='.repeat(60));
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📍 API Base: ${API_BASE}`);
  console.log('='.repeat(60));
  
  // Step 1: Login
  const loggedIn = await testLogin();
  if (!loggedIn) {
    console.log('\n❌ لا يمكن المتابعة بدون تسجيل الدخول');
    process.exit(1);
  }
  
  // Step 2: Test all endpoints
  await testAccounts();
  await testExpenses();
  await testInvoices();
  await testJournalEntries();
  await testOrders();
  
  // Step 3: Test integrity
  await testForeignKeysIntegrity();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅✅ انتهى الاختبار الشامل');
  console.log('='.repeat(60));
  console.log('\n📊 ملخص البيانات المُختبرة:');
  console.log(`   - حسابات: ${testData.accounts.length}`);
  console.log(`   - مصروفات: ${testData.expenses.length}`);
  console.log(`   - فواتير: ${testData.invoices.length}`);
  console.log(`   - قيود: ${testData.journalEntries.length}`);
  console.log(`   - طلبات: ${testData.orders.length}`);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ خطأ في الاختبار:', error.message);
  process.exit(1);
});
