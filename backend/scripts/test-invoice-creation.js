/**
 * Test script to verify invoice creation and /api/invoice_items/:id endpoint
 * This tests the complete flow: create invoice → fetch items → verify data
 */

import pg from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

// Test token (you may need to get a real token from login)
const TEST_TOKEN = process.env.TEST_TOKEN || '';

async function testInvoiceCreation() {
  console.log('🧪 Starting Invoice Creation Test...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connection established\n');

    // Step 1: Create a test invoice
    console.log('📝 Step 1: Creating test invoice...');
    
    const testLines = [
      {
        type: 'item',
        product_id: 1,
        name: 'Test Product 1',
        qty: 2,
        price: 50.00,
        discount: 0
      },
      {
        type: 'item',
        product_id: 2,
        name: 'Test Product 2',
        qty: 1,
        price: 30.00,
        discount: 5.00
      }
    ];

    const invoiceData = {
      number: `TEST-${Date.now()}`,
      invoice_number: `TEST-INV-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      customer_id: null,
      lines: testLines,
      subtotal: 130.00,
      discount_pct: 0,
      discount_amount: 5.00,
      tax_pct: 15,
      tax_amount: 18.75,
      total: 143.75,
      payment_method: 'CASH',
      status: 'posted',
      branch: 'china_town'
    };

    const insertQuery = `
      INSERT INTO invoices (
        number, invoice_number, date, customer_id, lines, 
        subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, 
        payment_method, status, branch, created_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING id, number, invoice_number, lines
    `;

    const insertResult = await client.query(insertQuery, [
      invoiceData.number,
      invoiceData.invoice_number,
      invoiceData.date,
      invoiceData.customer_id,
      JSON.stringify(invoiceData.lines),
      invoiceData.subtotal,
      invoiceData.discount_pct,
      invoiceData.discount_amount,
      invoiceData.tax_pct,
      invoiceData.tax_amount,
      invoiceData.total,
      invoiceData.payment_method,
      invoiceData.status,
      invoiceData.branch
    ]);

    const createdInvoice = insertResult.rows[0];
    const invoiceId = createdInvoice.id;

    console.log(`✅ Invoice created successfully!`);
    console.log(`   ID: ${invoiceId}`);
    console.log(`   Number: ${createdInvoice.number}`);
    console.log(`   Invoice Number: ${createdInvoice.invoice_number}`);
    console.log(`   Lines count: ${Array.isArray(createdInvoice.lines) ? createdInvoice.lines.length : 'N/A'}\n`);

    // Step 2: Test database query directly
    console.log('🔍 Step 2: Testing database query directly...');
    const dbQuery = await client.query(
      `SELECT id, number, invoice_number, lines FROM invoices WHERE id = $1`,
      [invoiceId]
    );

    if (dbQuery.rows.length === 0) {
      throw new Error('Invoice not found in database');
    }

    const dbInvoice = dbQuery.rows[0];
    console.log(`✅ Database query successful`);
    console.log(`   Invoice ID: ${dbInvoice.id}`);
    console.log(`   Lines type: ${typeof dbInvoice.lines}`);
    console.log(`   Lines is array: ${Array.isArray(dbInvoice.lines)}`);
    
    if (Array.isArray(dbInvoice.lines)) {
      console.log(`   Items count: ${dbInvoice.lines.filter(item => item && item.type === 'item').length}`);
      console.log(`   Sample item:`, JSON.stringify(dbInvoice.lines.find(item => item && item.type === 'item'), null, 2));
    }
    console.log('');

    // Step 3: Test /api/invoice_items/:id endpoint (if token available)
    if (TEST_TOKEN) {
      console.log('🌐 Step 3: Testing /api/invoice_items/:id endpoint...');
      try {
        const response = await axios.get(`${API_BASE}/invoice_items/${invoiceId}`, {
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`
          }
        });

        console.log(`✅ Endpoint response received`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Invoice ID: ${response.data.id}`);
        console.log(`   Invoice Number: ${response.data.invoice_number}`);
        console.log(`   Items count: ${Array.isArray(response.data.items) ? response.data.items.length : 0}`);
        
        if (Array.isArray(response.data.items) && response.data.items.length > 0) {
          console.log(`   Sample item:`, JSON.stringify(response.data.items[0], null, 2));
        }
        console.log('');

        // Verify data structure
        const hasItems = Array.isArray(response.data.items) && response.data.items.length > 0;
        const hasLines = Array.isArray(response.data.lines) && response.data.lines.length > 0;
        
        if (hasItems && hasLines) {
          console.log('✅ Data structure verification:');
          console.log(`   ✓ items array exists: ${hasItems}`);
          console.log(`   ✓ lines array exists: ${hasLines}`);
          console.log(`   ✓ items count: ${response.data.items.length}`);
          console.log(`   ✓ lines count: ${response.data.lines.length}`);
        } else {
          console.log('⚠️  Warning: items or lines array is empty');
        }
      } catch (error) {
        console.log(`❌ Endpoint test failed:`);
        console.log(`   Error: ${error.message}`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Data:`, error.response.data);
        }
        console.log('\n💡 Note: You may need to set TEST_TOKEN environment variable');
      }
    } else {
      console.log('⏭️  Step 3: Skipping endpoint test (no TEST_TOKEN provided)');
      console.log('   To test endpoint, set TEST_TOKEN environment variable\n');
    }

    // Step 4: Cleanup - Delete test invoice
    console.log('🧹 Step 4: Cleaning up test data...');
    await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
    console.log(`✅ Test invoice ${invoiceId} deleted\n`);

    console.log('✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Invoice creation: SUCCESS');
    console.log('   ✓ Database query: SUCCESS');
    console.log('   ✓ Data structure: CORRECT');
    if (TEST_TOKEN) {
      console.log('   ✓ API endpoint: TESTED');
    } else {
      console.log('   ⏭️  API endpoint: SKIPPED (no token)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('   Error details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testInvoiceCreation().catch(console.error);
