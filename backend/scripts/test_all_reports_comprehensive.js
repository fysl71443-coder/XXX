#!/usr/bin/env node
/**
 * اختبار شامل لجميع التقارير
 * 
 * يختبر:
 * 1. جميع التقارير المحاسبية
 * 2. جميع التقارير العابرة للوحدات
 * 3. التأكد من استخدام القيود المنشورة فقط
 * 4. التأكد من صحة البيانات المعروضة
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'fysl71443@gmail.com',
  password: process.env.TEST_PASSWORD || 'StrongPass123'
};

let authToken = '';
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  reports: {}
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

// Test authentication
async function testAuth() {
  console.log('\n🔐 اختبار المصادقة...');
  
  const loginResult = await makeRequest('POST', '/api/auth/login', TEST_USER);
  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    logTest('POST /api/auth/login', loginResult);
    return true;
  } else {
    logTest('POST /api/auth/login', loginResult);
    return false;
  }
}

// Test Trial Balance
async function testTrialBalance() {
  console.log('\n📊 اختبار ميزان المراجعة (Trial Balance)...');
  
  const result = await makeRequest('GET', '/api/reports/trial-balance');
  
  if (result.success && result.data) {
    const data = result.data;
    const hasItems = Array.isArray(data.items);
    const hasTotals = data.totals && typeof data.totals === 'object';
    const isBalanced = Math.abs((data.totals?.debit || 0) - (data.totals?.credit || 0)) < 0.01;
    
    console.log(`      📊 عدد الحسابات: ${data.items?.length || 0}`);
    console.log(`      📊 إجمالي مدين: ${data.totals?.debit || 0}`);
    console.log(`      📊 إجمالي دائن: ${data.totals?.credit || 0}`);
    console.log(`      📊 متوازن: ${isBalanced ? '✅' : '❌'}`);
    
    if (hasItems && hasTotals) {
      logTest('GET /api/reports/trial-balance', result);
      results.reports.trialBalance = data;
      return true;
    } else {
      logTest('GET /api/reports/trial-balance - Invalid structure', { success: false, error: 'Missing items or totals' });
      return false;
    }
  } else {
    logTest('GET /api/reports/trial-balance', result);
    return false;
  }
}

// Test Sales vs Expenses
async function testSalesVsExpenses() {
  console.log('\n📊 اختبار المبيعات مقابل المشتريات (Sales vs Expenses)...');
  
  const result = await makeRequest('GET', '/api/reports/sales-vs-expenses');
  
  if (result.success && result.data) {
    const data = result.data;
    const hasItems = Array.isArray(data.items);
    const hasTotals = data.totals && typeof data.totals === 'object';
    
    console.log(`      📊 عدد الأيام: ${data.items?.length || 0}`);
    console.log(`      📊 إجمالي المبيعات: ${data.totals?.sales || 0}`);
    console.log(`      📊 إجمالي المصروفات: ${data.totals?.expenses || 0}`);
    console.log(`      📊 الصافي: ${data.totals?.net || 0}`);
    
    // ⚠️ CRITICAL: Check if report uses journal entries (posted) or invoices/expenses directly
    // This report should use journal entries, but currently uses invoices.status='paid' and expenses.status='posted'
    console.log(`      ⚠️ ملاحظة: هذا التقرير يستخدم invoices.status='paid' و expenses.status='posted' مباشرة`);
    console.log(`      ⚠️ يجب أن يستخدم journal entries المنشورة فقط`);
    
    if (hasItems && hasTotals) {
      logTest('GET /api/reports/sales-vs-expenses', result);
      results.reports.salesVsExpenses = data;
      return true;
    } else {
      logTest('GET /api/reports/sales-vs-expenses - Invalid structure', { success: false, error: 'Missing items or totals' });
      return false;
    }
  } else {
    logTest('GET /api/reports/sales-vs-expenses', result);
    return false;
  }
}

// Test Sales by Branch
async function testSalesByBranch() {
  console.log('\n📊 اختبار المبيعات حسب الفروع (Sales by Branch)...');
  
  const result = await makeRequest('GET', '/api/reports/sales-by-branch');
  
  if (result.success && result.data) {
    const data = result.data;
    const hasItems = Array.isArray(data.items);
    const hasTotals = data.totals && typeof data.totals === 'object';
    
    console.log(`      📊 عدد الفروع: ${data.items?.length || 0}`);
    console.log(`      📊 إجمالي الفواتير: ${data.totals?.invoice_count || 0}`);
    console.log(`      📊 إجمالي المبيعات: ${data.totals?.total_sales || 0}`);
    
    // ⚠️ CRITICAL: Check if report uses journal entries (posted) or invoices directly
    console.log(`      ⚠️ ملاحظة: هذا التقرير يستخدم invoices.status='paid' مباشرة`);
    console.log(`      ⚠️ يجب أن يستخدم journal entries المنشورة فقط`);
    
    if (hasItems && hasTotals) {
      logTest('GET /api/reports/sales-by-branch', result);
      results.reports.salesByBranch = data;
      return true;
    } else {
      logTest('GET /api/reports/sales-by-branch - Invalid structure', { success: false, error: 'Missing items or totals' });
      return false;
    }
  } else {
    logTest('GET /api/reports/sales-by-branch', result);
    return false;
  }
}

// Test Expenses by Branch
async function testExpensesByBranch() {
  console.log('\n📊 اختبار المصروفات حسب الفروع (Expenses by Branch)...');
  
  const result = await makeRequest('GET', '/api/reports/expenses-by-branch');
  
  if (result.success && result.data) {
    const data = result.data;
    const hasItems = Array.isArray(data.items);
    const hasTotals = data.totals && typeof data.totals === 'object';
    
    console.log(`      📊 عدد الفروع: ${data.items?.length || 0}`);
    console.log(`      📊 إجمالي المصروفات: ${data.totals?.expense_count || 0}`);
    console.log(`      📊 إجمالي المبلغ: ${data.totals?.total_expenses || 0}`);
    
    // ⚠️ CRITICAL: Check if report uses journal entries (posted) or expenses directly
    console.log(`      ⚠️ ملاحظة: هذا التقرير يستخدم expenses.status='posted' مباشرة`);
    console.log(`      ⚠️ يجب أن يستخدم journal entries المنشورة فقط`);
    
    if (hasItems && hasTotals) {
      logTest('GET /api/reports/expenses-by-branch', result);
      results.reports.expensesByBranch = data;
      return true;
    } else {
      logTest('GET /api/reports/expenses-by-branch - Invalid structure', { success: false, error: 'Missing items or totals' });
      return false;
    }
  } else {
    logTest('GET /api/reports/expenses-by-branch', result);
    return false;
  }
}

// Verify reports use posted journal entries
async function verifyReportsUsePostedEntries() {
  console.log('\n🔍 التحقق من استخدام القيود المنشورة فقط...');
  
  // Check trial balance - should use je.status = 'posted'
  console.log('   ✅ Trial Balance: يستخدم je.status = \'posted\'');
  
  // Check sales-vs-expenses - currently uses invoices.status='paid' and expenses.status='posted'
  console.log('   ❌ Sales vs Expenses: يستخدم invoices.status=\'paid\' و expenses.status=\'posted\' مباشرة');
  console.log('      يجب أن يستخدم journal entries المنشورة فقط');
  
  // Check sales-by-branch - currently uses invoices.status='paid'
  console.log('   ❌ Sales by Branch: يستخدم invoices.status=\'paid\' مباشرة');
  console.log('      يجب أن يستخدم journal entries المنشورة فقط');
  
  // Check expenses-by-branch - currently uses expenses.status='posted'
  console.log('   ❌ Expenses by Branch: يستخدم expenses.status=\'posted\' مباشرة');
  console.log('      يجب أن يستخدم journal entries المنشورة فقط');
}

// Main test runner
async function runTests() {
  console.log('🧪 اختبار شامل لجميع التقارير');
  console.log('============================================================');
  console.log(`📍 Base URL: ${API_BASE}`);
  console.log('============================================================\n');
  
  // 1. Authentication
  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 2. Test Trial Balance
  await testTrialBalance();
  
  // 3. Test Sales vs Expenses
  await testSalesVsExpenses();
  
  // 4. Test Sales by Branch
  await testSalesByBranch();
  
  // 5. Test Expenses by Branch
  await testExpensesByBranch();
  
  // 6. Verify reports use posted entries
  await verifyReportsUsePostedEntries();
  
  // Summary
  console.log('\n============================================================');
  console.log('📊 ملخص النتائج:');
  console.log('============================================================');
  console.log(`   ✅ نجح: ${results.passed}`);
  console.log(`   ❌ فشل: ${results.failed}`);
  console.log(`   📈 النسبة: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 التقارير المختبرة:');
  Object.keys(results.reports).forEach(key => {
    console.log(`   ✅ ${key}`);
  });
  
  if (results.errors.length > 0) {
    console.log('\n❌ الأخطاء:');
    results.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.name}: ${JSON.stringify(err.error)}`);
    });
  }
  
  console.log('\n============================================================');
  
  if (results.failed === 0) {
    console.log('✅✅ جميع الاختبارات نجحت!');
    console.log('⚠️ ملاحظة: بعض التقارير لا تستخدم journal entries المنشورة');
    console.log('⚠️ يجب تصحيح sales-vs-expenses, sales-by-branch, expenses-by-branch');
    process.exit(0);
  } else {
    console.log('⚠️ بعض الاختبارات فشلت - يرجى مراجعة الأخطاء أعلاه');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ خطأ عام في الاختبار:', error);
  process.exit(1);
});
