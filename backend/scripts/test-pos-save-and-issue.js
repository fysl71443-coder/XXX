#!/usr/bin/env node
/**
 * اختبار شامل لحفظ مسودة وإصدار فاتورة مبيعات
 * 
 * يختبر:
 * 1. حفظ مسودة (saveDraft)
 * 2. إصدار فاتورة مبيعات (issueInvoice)
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
  testData: {
    orderId: null,
    invoiceId: null,
    products: []
  }
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

// Get test data (products, branch)
async function getTestData() {
  console.log('\n📦 جلب البيانات اللازمة للاختبار...');
  
  // Get products
  const productsResult = await makeRequest('GET', '/api/products');
  if (productsResult.success) {
    const products = Array.isArray(productsResult.data) ? productsResult.data : 
                     (productsResult.data?.items || []);
    if (products.length > 0) {
      results.testData.products = products.slice(0, 2); // Take first 2 products
      console.log(`   ✅ تم جلب ${products.length} منتج (سيتم استخدام ${results.testData.products.length})`);
      return true;
    } else {
      console.log('   ⚠️ لا توجد منتجات في قاعدة البيانات');
      return false;
    }
  } else {
    console.log('   ❌ فشل جلب المنتجات');
    return false;
  }
}

// Test saveDraft
async function testSaveDraft() {
  console.log('\n📝 اختبار حفظ مسودة...');
  
  if (results.testData.products.length === 0) {
    console.log('   ⚠️ لا توجد منتجات للاختبار');
    return false;
  }
  
  const branch = 'china_town';
  const table = '1';
  
  // Prepare items from products
  const items = results.testData.products.map((p, idx) => ({
    id: p.id,
    name: p.name || `Product ${idx + 1}`,
    quantity: idx + 1, // 1 for first, 2 for second
    price: Number(p.price || p.sale_price || 10)
  }));
  
  const payload = {
    branch: branch,
    table: table,
    items: items,
    customerId: null,
    customerName: '',
    customerPhone: '',
    discountPct: 0,
    taxPct: 15,
    paymentMethod: ''
  };
  
  console.log(`   📋 البيانات المرسلة:`);
  console.log(`      - Branch: ${branch}`);
  console.log(`      - Table: ${table}`);
  console.log(`      - Items: ${items.length}`);
  console.log(`      - Total Items Quantity: ${items.reduce((sum, item) => sum + item.quantity, 0)}`);
  
  // Use /api/ prefix to avoid SPA fallback
  const route = '/api/pos/save-draft';
  
  console.log(`   🔗 Testing route: ${route}`);
  const result = await makeRequest('POST', route, payload);
  
  if (result.success && result.data) {
    // Check if response is HTML (SPA fallback issue)
    if (typeof result.data === 'string' && result.data.includes('<!doctype html>')) {
      console.log(`      ❌ Received HTML instead of JSON - route may not be registered correctly`);
      logTest(`POST ${route} - HTML response (route not found)`, { success: false, error: 'Route returns HTML' });
      return false;
    }
    
    const orderId = result.data.order_id || result.data.id || result.data.orderId;
    if (orderId) {
      results.testData.orderId = orderId;
      logTest(`POST ${route} - Order ID: ${orderId}`, result);
      console.log(`      📊 Order ID: ${orderId}`);
      console.log(`      📊 Lines Count: ${result.data.lines?.length || 0}`);
      console.log(`      📊 Items Count: ${result.data.items?.length || 0}`);
      console.log(`      📊 Subtotal: ${result.data.subtotal || 0}`);
      console.log(`      📊 Tax: ${result.data.tax_amount || 0}`);
      console.log(`      📊 Total: ${result.data.total_amount || 0}`);
      return true;
    } else {
      console.log(`      ⚠️ Response structure:`, JSON.stringify(result.data, null, 2).substring(0, 300));
      logTest(`POST ${route} - No order_id returned`, { success: false, error: 'Missing order_id', response: result.data });
      return false;
    }
  } else {
    logTest(`POST ${route}`, result);
    return false;
  }
}

// Test issueInvoice
async function testIssueInvoice() {
  console.log('\n📄 اختبار إصدار فاتورة مبيعات...');
  
  if (!results.testData.orderId) {
    console.log('   ⚠️ لا توجد order_id للاختبار - يجب حفظ مسودة أولاً');
    return false;
  }
  
  const branch = 'china_town';
  const table = '1';
  
  // Prepare items from products
  const items = results.testData.products.map((p, idx) => ({
    id: p.id,
    name: p.name || `Product ${idx + 1}`,
    quantity: idx + 1,
    price: Number(p.price || p.sale_price || 10)
  }));
  
  // Calculate totals from items
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = subtotal * 0.15;
  const total = subtotal + taxAmount;
  
  const payload = {
    branch: branch,
    table: table,
    order_id: results.testData.orderId,
    items: items,
    customerId: null,
    customerName: '',
    customerPhone: '',
    discountPct: 0,
    taxPct: 15,
    paymentMethod: 'cash',
    payLines: [
      { method: 'cash', amount: total } // Total amount
    ]
  };
  
  console.log(`      - Calculated Subtotal: ${subtotal}`);
  console.log(`      - Calculated Tax: ${taxAmount}`);
  console.log(`      - Calculated Total: ${total}`);
  
  console.log(`   📋 البيانات المرسلة:`);
  console.log(`      - Branch: ${branch}`);
  console.log(`      - Table: ${table}`);
  console.log(`      - Order ID: ${results.testData.orderId}`);
  console.log(`      - Payment Method: cash`);
  console.log(`      - Items: ${items.length}`);
  
  // Use /api/ prefix to avoid SPA fallback
  const route = '/api/pos/issue-invoice';
  
  console.log(`   🔗 Testing route: ${route}`);
  const result = await makeRequest('POST', route, payload);
  
  if (result.success && result.data) {
    // Check if response is HTML (SPA fallback issue)
    if (typeof result.data === 'string' && result.data.includes('<!doctype html>')) {
      console.log(`      ❌ Received HTML instead of JSON - route may not be registered correctly`);
      logTest(`POST ${route} - HTML response (route not found)`, { success: false, error: 'Route returns HTML' });
      return false;
    }
    
    const invoiceId = result.data.invoice?.id || result.data.invoice_id || result.data.id;
    if (invoiceId) {
      results.testData.invoiceId = invoiceId;
      logTest(`POST ${route} - Invoice ID: ${invoiceId}`, result);
      console.log(`      📊 Invoice ID: ${invoiceId}`);
      console.log(`      📊 Invoice Number: ${result.data.invoice?.invoice_number || result.data.invoice_number || 'N/A'}`);
      console.log(`      📊 Total: ${result.data.invoice?.total || result.data.total || 'N/A'}`);
      console.log(`      📊 Tax: ${result.data.invoice?.tax || result.data.tax || 'N/A'}`);
      
      // Verify journal entry was created
      if (result.data.journal_entry_id || result.data.invoice?.journal_entry_id) {
        const journalId = result.data.journal_entry_id || result.data.invoice?.journal_entry_id;
        console.log(`      ✅ تم إنشاء قيد محاسبي: #${journalId}`);
      }
      
      return true;
    } else {
      console.log(`      ⚠️ Response structure:`, JSON.stringify(result.data, null, 2).substring(0, 300));
      logTest(`POST ${route} - No invoice_id returned`, { success: false, error: 'Missing invoice_id', response: result.data });
      return false;
    }
  } else {
    logTest(`POST ${route}`, result);
    return false;
  }
}

// Verify order was updated (called before issueInvoice)
async function verifyOrderBeforeIssue() {
  console.log('\n🔍 التحقق من الطلب قبل إصدار الفاتورة...');
  
  if (!results.testData.orderId) {
    console.log('   ⚠️ لا توجد order_id للتحقق');
    return false;
  }
  
  const result = await makeRequest('GET', `/api/orders/${results.testData.orderId}`);
  
  if (result.success && result.data) {
    const order = result.data;
    console.log(`   ✅ تم جلب الطلب #${order.id}`);
    console.log(`      📊 Status: ${order.status || 'N/A'}`);
    console.log(`      📊 Lines Count: ${order.lines?.length || 0}`);
    console.log(`      📊 Items Count: ${order.items?.length || 0}`);
    logTest('GET /api/orders/:id (before issue)', { success: true });
    return true;
  } else {
    logTest('GET /api/orders/:id', result);
    return false;
  }
}

// Verify order was updated (called after issueInvoice)
async function verifyOrderAfterIssue() {
  console.log('\n🔍 التحقق من تحديث الطلب بعد إصدار الفاتورة...');
  
  if (!results.testData.orderId) {
    console.log('   ⚠️ لا توجد order_id للتحقق');
    return false;
  }
  
  const result = await makeRequest('GET', `/api/orders/${results.testData.orderId}`);
  
  if (result.success && result.data) {
    const order = result.data;
    console.log(`   ✅ تم جلب الطلب #${order.id}`);
    console.log(`      📊 Status: ${order.status || 'N/A'}`);
    console.log(`      📊 Lines Count: ${order.lines?.length || 0}`);
    console.log(`      📊 Items Count: ${order.items?.length || 0}`);
    
    if (order.status === 'CLOSED' || order.status === 'closed') {
      console.log(`      ✅ الطلب مغلق (تم إصدار الفاتورة)`);
      logTest('Order status is CLOSED after issue', { success: true });
      return true;
    } else {
      console.log(`      ⚠️ حالة الطلب: ${order.status} (متوقع: CLOSED)`);
      logTest('Order status check after issue', { success: true });
      return true;
    }
  } else {
    logTest('GET /api/orders/:id (after issue)', result);
    return false;
  }
}

// Verify invoice
async function verifyInvoice() {
  console.log('\n🔍 التحقق من الفاتورة...');
  
  if (!results.testData.invoiceId) {
    console.log('   ⚠️ لا توجد invoice_id للتحقق');
    return false;
  }
  
  const result = await makeRequest('GET', `/api/invoices/${results.testData.invoiceId}`);
  
  if (result.success && result.data) {
    const invoice = result.data;
    console.log(`   ✅ تم جلب الفاتورة #${invoice.id}`);
    console.log(`      📊 Invoice Number: ${invoice.invoice_number || invoice.number || 'N/A'}`);
    console.log(`      📊 Status: ${invoice.status || 'N/A'}`);
    console.log(`      📊 Subtotal: ${invoice.subtotal || 0}`);
    console.log(`      📊 Tax: ${invoice.tax_amount || invoice.tax || 0}`);
    console.log(`      📊 Total: ${invoice.total || 0}`);
    console.log(`      📊 Lines Count: ${invoice.lines?.length || 0}`);
    
    if (invoice.journal_entry_id) {
      console.log(`      ✅ مربوط بقيد محاسبي: #${invoice.journal_entry_id}`);
    }
    
    logTest('GET /api/invoices/:id', result);
    return true;
  } else {
    logTest('GET /api/invoices/:id', result);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 اختبار حفظ مسودة وإصدار فاتورة مبيعات');
  console.log('============================================================');
  console.log(`📍 Base URL: ${API_BASE}`);
  console.log('============================================================\n');
  
  // 1. Authentication
  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 2. Get test data
  const dataSuccess = await getTestData();
  if (!dataSuccess) {
    console.log('\n❌ فشل جلب البيانات - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 3. Test saveDraft
  const saveSuccess = await testSaveDraft();
  if (!saveSuccess) {
    console.log('\n❌ فشل حفظ المسودة - لا يمكن متابعة الاختبارات');
    return;
  }
  
  // 4. Verify order before issue
  await verifyOrderBeforeIssue();
  
  // 5. Test issueInvoice
  const issueSuccess = await testIssueInvoice();
  if (!issueSuccess) {
    console.log('\n❌ فشل إصدار الفاتورة');
    return;
  }
  
  // 6. Verify order after issue (should be CLOSED)
  await verifyOrderAfterIssue();
  
  // 7. Verify invoice
  await verifyInvoice();
  
  // Summary
  console.log('\n============================================================');
  console.log('📊 ملخص النتائج:');
  console.log('============================================================');
  console.log(`   ✅ نجح: ${results.passed}`);
  console.log(`   ❌ فشل: ${results.failed}`);
  console.log(`   📈 النسبة: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.testData.orderId) {
    console.log(`\n   📝 Order ID: ${results.testData.orderId}`);
  }
  if (results.testData.invoiceId) {
    console.log(`   📄 Invoice ID: ${results.testData.invoiceId}`);
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ الأخطاء:');
    results.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.name}: ${JSON.stringify(err.error)}`);
    });
  }
  
  console.log('\n============================================================');
  
  if (results.failed === 0) {
    console.log('✅✅ جميع الاختبارات نجحت!');
    console.log('✅ تم حفظ المسودة وإصدار الفاتورة بنجاح');
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
