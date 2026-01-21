import { pool } from '../db.js';

async function check() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invoices' 
      ORDER BY ordinal_position
    `);
    
    console.log('Invoices table columns:');
    rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if type column exists
    const hasType = rows.some(r => r.column_name === 'type');
    console.log(`\nHas 'type' column: ${hasType}`);
    
    // Check existing invoices
    const { rows: invoices } = await pool.query('SELECT id, number, type, payment_method, status FROM invoices LIMIT 5');
    console.log('\nSample invoices:');
    invoices.forEach(inv => {
      console.log(`  - ID: ${inv.id}, Number: ${inv.number}, Type: ${inv.type || 'NULL'}, Payment: ${inv.payment_method}, Status: ${inv.status}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

check();
