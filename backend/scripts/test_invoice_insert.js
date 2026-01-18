import { pool } from '../db.js';

async function testInsert() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Test data - simple array
    const linesArray = [
      {
        type: 'item',
        product_id: 1,
        name: 'Test Product',
        qty: 2,
        price: 100,
        discount: 10
      }
    ];
    
    console.log('Testing INSERT with linesArray:', JSON.stringify(linesArray, null, 2));
    
    // Test 1: Direct array (like POST /invoices)
    try {
      const { rows } = await client.query(
        'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
        [null, new Date(), null, linesArray, 200, 0, 10, 0, 0, 190, 'cash', 'draft', 'test']
      );
      console.log('✅ Test 1 PASSED: Direct array');
      await client.query('ROLLBACK');
      await client.query('BEGIN');
    } catch (err) {
      console.error('❌ Test 1 FAILED:', err.message);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
    }
    
    // Test 2: Stringified JSON
    try {
      const linesJson = JSON.stringify(linesArray);
      const { rows } = await client.query(
        'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
        [null, new Date(), null, linesJson, 200, 0, 10, 0, 0, 190, 'cash', 'draft', 'test']
      );
      console.log('✅ Test 2 PASSED: Stringified JSON');
      await client.query('ROLLBACK');
      await client.query('BEGIN');
    } catch (err) {
      console.error('❌ Test 2 FAILED:', err.message);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
    }
    
    // Test 3: Stringified JSON with ::jsonb cast
    try {
      const linesJson = JSON.stringify(linesArray);
      const { rows } = await client.query(
        'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
        [null, new Date(), null, linesJson, 200, 0, 10, 0, 0, 190, 'cash', 'draft', 'test']
      );
      console.log('✅ Test 3 PASSED: Stringified JSON with ::jsonb cast');
      await client.query('ROLLBACK');
    } catch (err) {
      console.error('❌ Test 3 FAILED:', err.message);
      await client.query('ROLLBACK');
    }
    
  } catch (err) {
    console.error('❌ Test FAILED:', err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

testInsert();
