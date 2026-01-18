import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

async function testInvoiceCreation() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Login
    console.log('\n📋 Step 1: Login...');
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
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');

    // 2. Create a draft order (saveDraft)
    console.log('\n📋 Step 2: Creating draft order (saveDraft)...');
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
    console.log('✅ Draft order created, order_id:', order_id);
    console.log('   Response:', JSON.stringify(saveDraftData, null, 2));

    // 3. Issue invoice (issueInvoice)
    console.log('\n📋 Step 3: Issuing invoice (issueInvoice)...');
    const issueInvoicePayload = {
      order_id: order_id,  // CRITICAL: Must include order_id
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

    console.log('   Payload:', JSON.stringify(issueInvoicePayload, null, 2));

    const issueInvoiceRes = await fetch(`${API_BASE}/api/pos/issueInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(issueInvoicePayload)
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

    // 4. Verify invoice in database
    console.log('\n📋 Step 4: Verifying invoice in database...');
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
        
        if (invoice.journal_entry_id) {
          const { rows: jeRows } = await client.query(
            'SELECT id, entry_number, description, status FROM journal_entries WHERE id = $1',
            [invoice.journal_entry_id]
          );
          
          if (jeRows && jeRows.length > 0) {
            console.log('✅ Journal entry created:');
            console.log('   Entry ID:', jeRows[0].id);
            console.log('   Entry Number:', jeRows[0].entry_number);
            console.log('   Description:', jeRows[0].description);
            console.log('   Status:', jeRows[0].status);
          }
        }
      } else {
        console.log('⚠️  Invoice not found in database');
      }
    }

    console.log('\n✅✅✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

testInvoiceCreation();
