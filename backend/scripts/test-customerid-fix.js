/**
 * Test script to verify customerId column alignment fix
 * Tests:
 * 1. INSERT order with customerId
 * 2. SELECT order with customerId
 * 3. UPDATE order with customerId
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xxx',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

let testResults = {
  passed: [],
  failed: []
};

function log(message, type = 'info') {
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

async function testInsertOrder() {
  log('Test 1: INSERT order with customerId...');
  
  try {
    const testBranch = 'test_branch';
    const testTable = '1';
    const testCustomerId = 123;
    
    const { rows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId") 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, branch, table_code, "customerId", customer_name, customer_phone`,
      [testBranch, testTable, JSON.stringify([{ type: 'meta', branch: testBranch, table: testTable }]), 'DRAFT', 0, 0, 0, 0, 'Test Customer', '1234567890', testCustomerId]
    );
    
    if (rows && rows[0] && rows[0].customerId === testCustomerId) {
      testResults.passed.push('INSERT order with customerId');
      log(`INSERT successful: order_id=${rows[0].id}, customerId=${rows[0].customerId}`, 'success');
      
      // Cleanup
      await pool.query('DELETE FROM orders WHERE id = $1', [rows[0].id]);
      return true;
    } else {
      testResults.failed.push('INSERT order with customerId - customerId not returned correctly');
      log(`INSERT failed: customerId mismatch. Expected ${testCustomerId}, got ${rows[0]?.customerId}`, 'error');
      return false;
    }
  } catch (error) {
    testResults.failed.push(`INSERT order with customerId - ${error.message}`);
    log(`INSERT failed: ${error.message}`, 'error');
    return false;
  }
}

async function testSelectOrder() {
  log('Test 2: SELECT order with customerId...');
  
  try {
    // First create a test order
    const testCustomerId = 456;
    const { rows: insertRows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId") 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id`,
      ['test_branch', '2', JSON.stringify([{ type: 'meta' }]), 'DRAFT', 0, 0, 0, 0, 'Test', '123', testCustomerId]
    );
    
    const orderId = insertRows[0].id;
    
    // Now select it
    const { rows } = await pool.query(
      `SELECT id, branch, table_code, "customerId", customer_name, customer_phone 
       FROM orders 
       WHERE id = $1`,
      [orderId]
    );
    
    if (rows && rows[0] && rows[0].customerId === testCustomerId) {
      testResults.passed.push('SELECT order with customerId');
      log(`SELECT successful: order_id=${rows[0].id}, customerId=${rows[0].customerId}`, 'success');
      
      // Cleanup
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      return true;
    } else {
      testResults.failed.push('SELECT order with customerId - customerId not returned correctly');
      log(`SELECT failed: customerId mismatch`, 'error');
      return false;
    }
  } catch (error) {
    testResults.failed.push(`SELECT order with customerId - ${error.message}`);
    log(`SELECT failed: ${error.message}`, 'error');
    return false;
  }
}

async function testUpdateOrder() {
  log('Test 3: UPDATE order with customerId...');
  
  try {
    // First create a test order
    const initialCustomerId = 789;
    const { rows: insertRows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId") 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id`,
      ['test_branch', '3', JSON.stringify([{ type: 'meta' }]), 'DRAFT', 0, 0, 0, 0, 'Test', '123', initialCustomerId]
    );
    
    const orderId = insertRows[0].id;
    const newCustomerId = 999;
    
    // Update it
    const { rows } = await pool.query(
      `UPDATE orders 
       SET "customerId" = $1 
       WHERE id = $2 
       RETURNING id, "customerId"`,
      [newCustomerId, orderId]
    );
    
    if (rows && rows[0] && rows[0].customerId === newCustomerId) {
      testResults.passed.push('UPDATE order with customerId');
      log(`UPDATE successful: order_id=${rows[0].id}, customerId=${rows[0].customerId}`, 'success');
      
      // Cleanup
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      return true;
    } else {
      testResults.failed.push('UPDATE order with customerId - customerId not updated correctly');
      log(`UPDATE failed: customerId mismatch`, 'error');
      return false;
    }
  } catch (error) {
    testResults.failed.push(`UPDATE order with customerId - ${error.message}`);
    log(`UPDATE failed: ${error.message}`, 'error');
    return false;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('Testing customerId Column Alignment Fix');
  console.log('========================================\n');
  
  try {
    await testInsertOrder();
    await testSelectOrder();
    await testUpdateOrder();
    
    console.log('\n========================================');
    console.log('Test Results:');
    console.log('========================================\n');
    
    console.log(`✅ Passed: ${testResults.passed.length} tests`);
    testResults.passed.forEach(test => console.log(`  ✓ ${test}`));
    
    if (testResults.failed.length > 0) {
      console.log(`\n❌ Failed: ${testResults.failed.length} tests`);
      testResults.failed.forEach(test => console.log(`  ✗ ${test}`));
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Test execution error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
