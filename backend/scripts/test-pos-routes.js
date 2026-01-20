#!/usr/bin/env node
/**
 * اختبار مسارات POS - التحقق من عمل جميع Aliases
 * 
 * يختبر:
 * - /pos/saveDraft و /pos/save-draft
 * - /api/pos/saveDraft و /api/pos/save-draft
 * - /pos/issueInvoice و /pos/issue-invoice
 * - /api/pos/issueInvoice و /api/pos/issue-invoice
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

// Test saveDraft routes
async function testSaveDraftRoutes() {
  console.log('\n📝 اختبار مسارات saveDraft...');
  
  const testPayload = {
    branch: 'china_town',
    table: '1',
    items: [
      { id: 1, name: 'Test Item', quantity: 1, price: 10 }
    ]
  };
  
  const routes = [
    '/pos/saveDraft',
    '/pos/save-draft',
    '/api/pos/saveDraft',
    '/api/pos/save-draft'
  ];
  
  for (const route of routes) {
    const result = await makeRequest('POST', route, testPayload);
    // We expect either success (200) or validation error (400), but not 404
    if (result.status === 404) {
      logTest(`POST ${route} (404 Not Found)`, { success: false, error: 'Route not found' });
    } else if (result.status === 200 || result.status === 201 || result.status === 400) {
      logTest(`POST ${route} (${result.status})`, { success: true, data: result.data });
    } else {
      logTest(`POST ${route} (${result.status})`, result);
    }
  }
}

// Test issueInvoice routes
async function testIssueInvoiceRoutes() {
  console.log('\n📄 اختبار مسارات issueInvoice...');
  
  const testPayload = {
    branch: 'china_town',
    table: '1',
    order_id: 1,
    items: [],
    paymentMethod: 'cash'
  };
  
  const routes = [
    '/pos/issueInvoice',
    '/pos/issue-invoice',
    '/api/pos/issueInvoice',
    '/api/pos/issue-invoice'
  ];
  
  for (const route of routes) {
    const result = await makeRequest('POST', route, testPayload);
    // We expect either success (200) or validation error (400), but not 404
    if (result.status === 404) {
      logTest(`POST ${route} (404 Not Found)`, { success: false, error: 'Route not found' });
    } else if (result.status === 200 || result.status === 201 || result.status === 400) {
      logTest(`POST ${route} (${result.status})`, { success: true, data: result.data });
    } else {
      logTest(`POST ${route} (${result.status})`, result);
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 اختبار مسارات POS Routes');
  console.log('============================================================');
  console.log(`📍 Base URL: ${API_BASE}`);
  console.log('============================================================\n');
  
  // 1. Authentication
  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 2. Test saveDraft routes
  await testSaveDraftRoutes();
  
  // 3. Test issueInvoice routes
  await testIssueInvoiceRoutes();
  
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
    console.log('✅✅ جميع المسارات تعمل بشكل صحيح!');
    process.exit(0);
  } else {
    console.log('⚠️ بعض المسارات تحتاج مراجعة');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ خطأ عام في الاختبار:', error);
  process.exit(1);
});
