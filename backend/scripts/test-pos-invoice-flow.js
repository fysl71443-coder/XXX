/**
 * اختبار شامل لسير عمل POS Invoice
 * 
 * يختبر:
 * 1. saveDraft - التأكد من إرجاع order_id
 * 2. issueInvoice - التأكد من إرسال order_id بشكل صحيح
 * 3. Integration Test - اختبار Backend مباشرة
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const text = await response.text();
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  
  return {
    ok: response.ok,
    status: response.status,
    data,
    text
  };
}

// Test 1: saveDraft
async function testSaveDraft(token) {
  console.log('\n📋 Test 1: saveDraft (Frontend → Backend)');
  console.log('   Goal: Ensure saveDraft returns order_id correctly');
  
  const payload = {
    tableId: 5,
    table: '5',
    branchId: 1,
    branch: 'china_town',
    items: [
      { product_id: 177, name: 'روبينثوفو', qty: 2, price: 50.43 },
      { product_id: 178, name: 'ثوفودحاج', qty: 1, price: 73.56 }
    ],
    subtotal: 174.42,
    discount_amount: 0,
    tax_amount: 26.16,
    total_amount: 200.58,
    customerId: 0,
    customerName: '',
    customerPhone: '',
    discountPct: 0,
    taxPct: 15,
    paymentMethod: 'cash',
    payLines: []
  };

  console.log('   Sending payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await apiCall('/api/pos/saveDraft', 'POST', payload, token);
    
    console.log('   Response status:', response.status);
    console.log('   Response data:', JSON.stringify(response.data, null, 2));

    if (!response.ok) {
      console.error('   ❌ [TEST saveDraft] FAILED: Request failed');
      console.error('   Error:', response.data);
      return null;
    }

    const order_id = response.data?.order_id || response.data?.id;
    
    if (!order_id) {
      console.error('   ❌ [TEST saveDraft] FAILED: order_id missing!');
      console.error('   Response:', response.data);
      return null;
    }

    console.log('   ✅ [TEST saveDraft] PASSED: order_id =', order_id);
    return order_id;
  } catch (err) {
    console.error('   ❌ [TEST saveDraft] ERROR:', err.message);
    console.error('   Stack:', err.stack);
    return null;
  }
}

// Test 2: issueInvoice
async function testIssueInvoice(orderId, token) {
  console.log('\n📋 Test 2: issueInvoice (Frontend → Backend)');
  console.log('   Goal: Ensure payload contains order_id before sending to backend');
  
  const payload = {
    order_id: orderId,  // CRITICAL: Must be a number
    branch: 'china_town',
    table: '5',
    branchId: 1,
    lines: [
      { type: 'item', product_id: 177, name: 'روبينثوفو', qty: 2, price: 50.43, discount: 0 },
      { type: 'item', product_id: 178, name: 'ثوفودحاج', qty: 1, price: 73.56, discount: 0 }
    ],
    customer_id: null,
    payment_method: 'CASH',
    discount_pct: 0,
    tax_pct: 15,
    subtotal: 174.42,
    discount_amount: 0,
    tax_amount: 26.16,
    total: 200.58,
    status: 'posted'
  };

  // CRITICAL: Verify order_id is a number
  if (typeof payload.order_id !== 'number') {
    console.warn('   ⚠️  order_id is not a number, converting...');
    payload.order_id = Number(payload.order_id);
  }

  console.log('   Sending payload:', JSON.stringify(payload, null, 2));
  console.log('   order_id type:', typeof payload.order_id, 'value:', payload.order_id);

  try {
    const response = await apiCall('/api/pos/issueInvoice', 'POST', payload, token);
    
    console.log('   Response status:', response.status);
    console.log('   Response data:', JSON.stringify(response.data, null, 2));

    if (!response.ok) {
      console.error('   ❌ [TEST issueInvoice] FAILED: Request failed');
      console.error('   Error:', response.data);
      return false;
    }

    console.log('   ✅ [TEST issueInvoice] PASSED');
    return true;
  } catch (err) {
    console.error('   ❌ [TEST issueInvoice] ERROR:', err.message);
    console.error('   Stack:', err.stack);
    return false;
  }
}

// Test 3: Integration Test (Direct Backend)
async function testIntegrationDirect(orderId, token) {
  console.log('\n📋 Test 3: Integration Test (Direct Backend)');
  console.log('   Goal: Test Backend directly with curl-like request');
  
  const payload = {
    order_id: Number(orderId),  // CRITICAL: Must be a number
    payment_method: 'CASH'
  };

  console.log('   Sending minimal payload:', JSON.stringify(payload, null, 2));
  console.log('   order_id type:', typeof payload.order_id, 'value:', payload.order_id);

  try {
    const response = await apiCall('/api/pos/issueInvoice', 'POST', payload, token);
    
    console.log('   Response status:', response.status);
    console.log('   Response data:', JSON.stringify(response.data, null, 2));

    if (!response.ok) {
      console.error('   ❌ [TEST Integration] FAILED: Request failed');
      console.error('   Error:', response.data);
      return false;
    }

    console.log('   ✅ [TEST Integration] PASSED');
    return true;
  } catch (err) {
    console.error('   ❌ [TEST Integration] ERROR:', err.message);
    console.error('   Stack:', err.stack);
    return false;
  }
}

// Main test function
async function runAllTests() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Login
    console.log('\n📋 Step 1: Login...');
    const loginRes = await apiCall('/api/auth/login', 'POST', {
      email: 'fysl71443@gmail.com',
      password: 'StrongPass123'
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${loginRes.text}`);
    }

    const token = loginRes.data?.token || loginRes.data?.access_token;
    if (!token) {
      throw new Error('No token in login response');
    }
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');

    // Step 2: Test saveDraft
    const orderId = await testSaveDraft(token);
    
    if (!orderId) {
      console.error('\n❌ Test failed: saveDraft did not return order_id');
      process.exit(1);
    }

    console.log('\n📋 Order ID obtained:', orderId);
    console.log('   Type:', typeof orderId);

    // Step 3: Test issueInvoice with full payload
    const issueResult = await testIssueInvoice(orderId, token);
    
    if (!issueResult) {
      console.error('\n❌ Test failed: issueInvoice failed');
      process.exit(1);
    }

    // Step 4: Create a new order for Integration test (since previous order is now ISSUED)
    console.log('\n📋 Step 4: Creating new order for Integration test...');
    const newOrderId = await testSaveDraft(token);
    
    if (!newOrderId) {
      console.error('\n❌ Test failed: Could not create new order for Integration test');
      process.exit(1);
    }

    // Step 5: Test Integration (minimal payload) with new order
    const integrationResult = await testIntegrationDirect(newOrderId, token);
    
    if (!integrationResult) {
      console.error('\n❌ Test failed: Integration test failed');
      process.exit(1);
    }

    // Step 6: Verify in database
    console.log('\n📋 Step 6: Verifying invoice in database...');
    const { rows } = await client.query(
      'SELECT id, number, status, total, customer_id, journal_entry_id FROM invoices ORDER BY id DESC LIMIT 1'
    );
    
    if (rows && rows.length > 0) {
      const invoice = rows[0];
      console.log('✅ Latest invoice in database:');
      console.log('   ID:', invoice.id);
      console.log('   Number:', invoice.number);
      console.log('   Status:', invoice.status);
      console.log('   Total:', invoice.total);
      console.log('   Journal Entry ID:', invoice.journal_entry_id);
    }

    console.log('\n✅✅✅ All tests passed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ saveDraft returned order_id:', orderId);
    console.log('   ✅ issueInvoice sent order_id successfully');
    console.log('   ✅ Integration test passed');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

runAllTests();
