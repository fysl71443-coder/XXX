#!/usr/bin/env node
/**
 * اختبار شامل لجميع API endpoints والشاشات
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:4000/api';
const TEST_USER = {
  email: 'fysl71443@gmail.com',
  password: 'StrongPass123'
};

let authToken = '';
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    };
    
    if (data) {
      config.data = data;
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
  if (result.success) {
    console.log(`   ✅ ${name}`);
    results.passed++;
    return true;
  } else {
    console.log(`   ❌ ${name}`);
    console.log(`      خطأ: ${JSON.stringify(result.error)}`);
    results.failed++;
    results.errors.push({ name, error: result.error });
    return false;
  }
}

// ============================================
// 1. Authentication Tests
// ============================================
async function testAuth() {
  console.log('\n🔐 اختبار المصادقة (Authentication)...');
  
  const loginResult = await makeRequest('POST', '/auth/login', TEST_USER);
  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    logTest('POST /api/auth/login', loginResult);
    return true;
  } else {
    logTest('POST /api/auth/login', loginResult);
    return false;
  }
}

// ============================================
// 2. Accounts Tests
// ============================================
async function testAccounts() {
  console.log('\n📊 اختبار الحسابات (Accounts)...');
  
  const listResult = await makeRequest('GET', '/accounts');
  logTest('GET /api/accounts', listResult);
  
  if (listResult.success) {
    let accounts = [];
    if (Array.isArray(listResult.data)) {
      accounts = listResult.data;
    } else if (listResult.data?.items) {
      accounts = listResult.data.items;
    }
    
    if (accounts.length > 0) {
      const accountId = accounts[0].id;
      const getResult = await makeRequest('GET', `/accounts/${accountId}`);
      logTest(`GET /api/accounts/${accountId}`, getResult);
    }
  }
}

// ============================================
// 3. Expenses Tests
// ============================================
async function testExpenses() {
  console.log('\n💰 اختبار المصروفات (Expenses)...');
  
  // GET - List
  const listResult = await makeRequest('GET', '/expenses');
  logTest('GET /api/expenses', listResult);
  
  // POST - Create
  const newExpense = {
    date: new Date().toISOString().split('T')[0],
    amount: 150,
    total: 150,
    account_code: '5210',
    description: 'مصروف اختبار شامل',
    payment_method: 'cash',
    status: 'draft',
    branch: 'china_town',
    type: 'expense'
  };
  
  const createResult = await makeRequest('POST', '/expenses', newExpense);
  const expenseCreated = logTest('POST /api/expenses (Create)', createResult);
  
  if (expenseCreated && createResult.data?.id) {
    const expenseId = createResult.data.id;
    
    // GET - Get single
    const getResult = await makeRequest('GET', `/expenses/${expenseId}`);
    logTest(`GET /api/expenses/${expenseId}`, getResult);
    
    // PUT - Update
    const updateResult = await makeRequest('PUT', `/expenses/${expenseId}`, { description: 'مصروف محدث' });
    logTest(`PUT /api/expenses/${expenseId} (Update)`, updateResult);
    
    // POST - Post expense
    const postResult = await makeRequest('POST', `/expenses/${expenseId}/post`);
    logTest(`POST /api/expenses/${expenseId}/post`, postResult);
    
    if (postResult.success) {
      // Verify journal entry was created
      const verifyResult = await makeRequest('GET', `/expenses/${expenseId}`);
      if (verifyResult.success && verifyResult.data.journal_entry_id) {
        console.log(`      ✅ تم ربط المصروف بقيد #${verifyResult.data.journal_entry_id}`);
      }
    }
  }
}

// ============================================
// 4. Invoices Tests
// ============================================
async function testInvoices() {
  console.log('\n📄 اختبار الفواتير (Invoices)...');
  
  // GET - List
  const listResult = await makeRequest('GET', '/invoices');
  logTest('GET /api/invoices', listResult);
  
  // POST - Create
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
    
    // GET - Get single
    const getResult = await makeRequest('GET', `/invoices/${invoiceId}`);
    logTest(`GET /api/invoices/${invoiceId}`, getResult);
    
    // PUT - Update
    const updateResult = await makeRequest('PUT', `/invoices/${invoiceId}`, { subtotal: 250, total: 287.5 });
    logTest(`PUT /api/invoices/${invoiceId} (Update)`, updateResult);
  }
}

// ============================================
// 5. Journal Entries Tests
// ============================================
async function testJournalEntries() {
  console.log('\n📚 اختبار القيود المحاسبية (Journal Entries)...');
  
  // GET - List
  const listResult = await makeRequest('GET', '/journal');
  logTest('GET /api/journal', listResult);
  
  if (listResult.success) {
    const items = listResult.data.items || listResult.data || [];
    console.log(`      تم جلب ${items.length} قيد`);
    
    if (items.length > 0) {
      const entry = items[0];
      
      // Verify postings exist
      if (entry.postings && entry.postings.length > 0) {
        console.log(`      ✅ القيد يحتوي على ${entry.postings.length} سطر`);
      } else {
        console.log(`      ⚠️ القيد لا يحتوي على سطور`);
      }
      
      // Verify totals
      if (entry.total_debit > 0 || entry.total_credit > 0) {
        console.log(`      ✅ المبالغ صحيحة: مدين=${entry.total_debit}, دائن=${entry.total_credit}`);
      } else {
        console.log(`      ⚠️ المبالغ = 0`);
      }
      
      // GET - Get single
      const getResult = await makeRequest('GET', `/journal/${entry.id}`);
      logTest(`GET /api/journal/${entry.id}`, getResult);
      
      if (getResult.success && getResult.data.postings) {
        console.log(`      ✅ القيد يحتوي على ${getResult.data.postings.length} سطر مع تفاصيل الحسابات`);
      }
    }
  }
}

// ============================================
// 6. Orders Tests
// ============================================
async function testOrders() {
  console.log('\n🛒 اختبار الطلبات (Orders)...');
  
  const listResult = await makeRequest('GET', '/orders');
  logTest('GET /api/orders', listResult);
  
  if (listResult.success) {
    const items = listResult.data.items || listResult.data || [];
    if (items.length === 0) {
      console.log(`      ⚠️ لا توجد طلبات في قاعدة البيانات`);
    }
  }
}

// ============================================
// 7. Products Tests
// ============================================
async function testProducts() {
  console.log('\n📦 اختبار المنتجات (Products)...');
  
  const listResult = await makeRequest('GET', '/products');
  logTest('GET /api/products', listResult);
}

// ============================================
// 8. Customers Tests
// ============================================
async function testCustomers() {
  console.log('\n👥 اختبار العملاء (Customers)...');
  
  const listResult = await makeRequest('GET', '/customers');
  logTest('GET /api/customers', listResult);
}

// ============================================
// 9. Database Integrity Tests
// ============================================
async function testIntegrity() {
  console.log('\n🔗 اختبار سلامة قاعدة البيانات (Database Integrity)...');
  
  // Test expenses linked to journal entries
  const expensesResult = await makeRequest('GET', '/expenses');
  if (expensesResult.success) {
    const expenses = expensesResult.data.items || expensesResult.data || [];
    const postedExpenses = expenses.filter(e => e.status === 'posted');
    const linkedExpenses = postedExpenses.filter(e => e.journal_entry_id);
    
    console.log(`   📊 المصروفات المنشورة: ${postedExpenses.length}`);
    console.log(`   📊 المصروفات المربوطة: ${linkedExpenses.length}`);
    
    if (postedExpenses.length > 0 && linkedExpenses.length === postedExpenses.length) {
      console.log(`   ✅ جميع المصروفات المنشورة مربوطة بالقيود`);
      results.passed++;
    } else if (postedExpenses.length > 0) {
      console.log(`   ⚠️ بعض المصروفات المنشورة غير مربوطة`);
      results.failed++;
    }
  }
  
  // Test journal entries have postings
  const journalResult = await makeRequest('GET', '/journal', { status: 'posted' });
  if (journalResult.success) {
    const entries = journalResult.data.items || journalResult.data || [];
    const entriesWithPostings = entries.filter(e => e.postings && e.postings.length > 0);
    
    console.log(`   📊 القيود المنشورة: ${entries.length}`);
    console.log(`   📊 القيود مع السطور: ${entriesWithPostings.length}`);
    
    if (entries.length > 0 && entriesWithPostings.length === entries.length) {
      console.log(`   ✅ جميع القيود تحتوي على سطور`);
      results.passed++;
    } else if (entries.length > 0) {
      console.log(`   ⚠️ بعض القيود لا تحتوي على سطور`);
      results.failed++;
    }
  }
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  console.log('🧪 بدء الاختبار الشامل للنظام');
  console.log('============================================================');
  console.log(`📍 Base URL: ${API_BASE}`);
  console.log('============================================================\n');
  
  // 1. Authentication
  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 2. Accounts
  await testAccounts();
  
  // 3. Expenses
  await testExpenses();
  
  // 4. Invoices
  await testInvoices();
  
  // 5. Journal Entries
  await testJournalEntries();
  
  // 6. Orders
  await testOrders();
  
  // 7. Products
  await testProducts();
  
  // 8. Customers
  await testCustomers();
  
  // 9. Database Integrity
  await testIntegrity();
  
  // Summary
  console.log('\n============================================================');
  console.log('📊 ملخص النتائج:');
  console.log('============================================================');
  console.log(`   ✅ نجح: ${results.passed}`);
  console.log(`   ❌ فشل: ${results.failed}`);
  console.log(`   📈 النسبة: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ الأخطاء:');
    results.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.name}: ${JSON.stringify(err.error)}`);
    });
  }
  
  console.log('\n============================================================');
  
  if (results.failed === 0) {
    console.log('✅✅ جميع الاختبارات نجحت!');
    process.exit(0);
  } else {
    console.log('⚠️ بعض الاختبارات فشلت - يرجى مراجعة الأخطاء أعلاه');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('❌ خطأ عام في الاختبار:', error);
  process.exit(1);
});
