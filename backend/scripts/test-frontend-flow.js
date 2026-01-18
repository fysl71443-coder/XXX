/**
 * اختبار محاكاة سير عمل المستخدم في Frontend
 * 
 * هذا السكريبت يحاكي:
 * 1. حفظ مسودة (saveDraft)
 * 2. إصدار فاتورة (issueInvoice)
 * 
 * مع التحقق من أن order_id يُرسل بشكل صحيح في كل خطوة
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

// محاكاة console.log من Frontend
const frontendConsole = {
  log: (label, ...args) => {
    console.log(`[FRONTEND] ${label}`);
    if (args.length > 0) {
      console.log('   ', ...args);
    }
  },
  error: (label, ...args) => {
    console.error(`[FRONTEND ERROR] ${label}`);
    if (args.length > 0) {
      console.error('   ', ...args);
    }
  }
};

async function simulateUserFlow() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Login
    console.log('\n📋 Step 1: User Login...');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fysl71443@gmail.com',
        password: 'StrongPass123'
      })
    });
    
    if (!loginRes.ok) {
      const errorText = await loginRes.text();
      throw new Error(`Login failed: ${loginRes.status} ${errorText}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.access_token;
    if (!token) {
      throw new Error('No token in login response');
    }
    console.log('✅ Login successful');

    // Step 2: Save Draft (محاكاة saveDraft في Frontend)
    console.log('\n📋 Step 2: User saves draft (saveDraft)...');
    frontendConsole.log('User clicks "Save Draft" button');
    
    const saveDraftPayload = {
      branch: 'china_town',
      table: '6',
      branchId: 1,
      items: [
        { id: 1, name: 'Test Product 1', quantity: 2, price: 50, discount: 0 },
        { id: 2, name: 'Test Product 2', quantity: 1, price: 100, discount: 0 }
      ],
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 30,
      total_amount: 230,
      customerId: 0,
      customerName: '',
      customerPhone: '',
      discountPct: 0,
      taxPct: 15,
      paymentMethod: 'cash',
      payLines: []
    };

    frontendConsole.log('Calling saveDraft() with payload:', JSON.stringify(saveDraftPayload, null, 2));
    
    const saveDraftRes = await fetch(`${API_BASE}/api/pos/saveDraft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(saveDraftPayload)
    });

    if (!saveDraftRes.ok) {
      const errorText = await saveDraftRes.text();
      throw new Error(`saveDraft failed: ${saveDraftRes.status} ${errorText}`);
    }

    const saveDraftData = await saveDraftRes.json();
    const order_id = saveDraftData.order_id || saveDraftData.id;
    
    if (!order_id) {
      throw new Error('saveDraft did not return order_id');
    }
    
    // محاكاة Frontend: saveDraft returns order_id
    frontendConsole.log('[ISSUE] saveDraft returned order_id:', order_id);
    console.log('✅ Draft order created, order_id:', order_id);

    // Step 3: Issue Invoice (محاكاة issueInvoice في Frontend)
    console.log('\n📋 Step 3: User issues invoice (issueInvoice)...');
    frontendConsole.log('User clicks "Issue Invoice" button');
    
    // محاكاة issue() function في Frontend
    const paymentMethod = 'cash';
    let id = order_id; // saveDraft returned this
    id = id ? Number(String(id).trim()) : 0;
    frontendConsole.log('[ISSUE] saveDraft returned order_id:', id);
    
    if (!id || id <= 0) {
      throw new Error('Invalid order_id after saveDraft');
    }
    
    // محاكاة issueInvoice(paymentMethod, id) call
    const orderIdForIssue = id; // This is what gets passed to issueInvoice
    frontendConsole.log('[ISSUE] Calling issueInvoice with order_id:', id);
    frontendConsole.log('[ISSUE INVOICE CALLBACK] Called with orderIdForIssue:', orderIdForIssue, 'paymentType:', paymentMethod);
    
    // محاكاة effectiveOrderId calculation
    const effectiveOrderId = (function(){
      frontendConsole.log('[ISSUE INVOICE] Finding order_id from sources:', { 
        orderIdForIssue, 
        orderIdFromURL: null, 
        branch: 'china_town', 
        table: '6' 
      });
      
      if (orderIdForIssue && Number(orderIdForIssue) > 0) {
        frontendConsole.log('[ISSUE INVOICE] Using orderIdForIssue:', orderIdForIssue);
        return Number(orderIdForIssue);
      }
      return null;
    })();
    
    if (!effectiveOrderId || effectiveOrderId <= 0) {
      throw new Error('effectiveOrderId is invalid');
    }
    
    // محاكاة payload construction
    const payload = {
      order_id: effectiveOrderId,  // CRITICAL: Send order_id to link invoice to order
      branch: 'china_town',
      table: '6',
      branchId: 1,
      lines: [
        { type: 'item', product_id: 1, name: 'Test Product 1', qty: 2, price: 50, discount: 0 },
        { type: 'item', product_id: 2, name: 'Test Product 2', qty: 1, price: 100, discount: 0 }
      ],
      customer_id: null,
      payment_method: 'CASH',
      discount_pct: 0,
      tax_pct: 15,
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 30,
      total: 230,
      status: 'posted'
    };
    
    // CRITICAL: Verify order_id is present in payload before sending
    if (!payload.order_id || payload.order_id <= 0) {
      frontendConsole.error('[ISSUE INVOICE] Payload missing order_id:', payload);
      throw new Error('Payload missing order_id');
    }
    
    frontendConsole.log('[ISSUE INVOICE] Sending payload with order_id:', payload.order_id, JSON.stringify(payload, null, 2));
    
    // Step 4: Send issueInvoice request
    console.log('\n📋 Step 4: Sending issueInvoice request to Backend...');
    console.log('   Request Payload:', JSON.stringify(payload, null, 2));
    
    const issueInvoiceRes = await fetch(`${API_BASE}/api/pos/issueInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const issueInvoiceText = await issueInvoiceRes.text();
    console.log('   Response status:', issueInvoiceRes.status);
    console.log('   Response body:', issueInvoiceText);

    if (!issueInvoiceRes.ok) {
      throw new Error(`issueInvoice failed: ${issueInvoiceRes.status} ${issueInvoiceText}`);
    }

    const issueInvoiceData = JSON.parse(issueInvoiceText);
    console.log('✅ Invoice issued successfully!');
    console.log('   Invoice:', JSON.stringify(issueInvoiceData, null, 2));
    
    frontendConsole.log('[ISSUE INVOICE] Invoice issued successfully for order_id:', order_id);

    // Step 5: Verify in database
    console.log('\n📋 Step 5: Verifying invoice in database...');
    const invoiceId = issueInvoiceData.id || issueInvoiceData.invoice_id;
    if (invoiceId) {
      const { rows } = await client.query(
        'SELECT id, number, status, total, customer_id, journal_entry_id FROM invoices WHERE id = $1',
        [invoiceId]
      );
      
      if (rows && rows.length > 0) {
        const invoice = rows[0];
        console.log('✅ Invoice found in database:');
        console.log('   ID:', invoice.id);
        console.log('   Number:', invoice.number);
        console.log('   Status:', invoice.status);
        console.log('   Total:', invoice.total);
        console.log('   Journal Entry ID:', invoice.journal_entry_id);
      }
    }

    console.log('\n✅✅✅ User flow simulation completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ saveDraft returned order_id:', order_id);
    console.log('   ✅ issueInvoice received orderIdForIssue:', orderIdForIssue);
    console.log('   ✅ effectiveOrderId calculated:', effectiveOrderId);
    console.log('   ✅ payload.order_id sent:', payload.order_id);
    console.log('   ✅ Invoice created successfully:', invoiceId);
    
  } catch (error) {
    console.error('\n❌ User flow simulation failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

simulateUserFlow();
