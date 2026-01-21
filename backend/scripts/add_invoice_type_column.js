import { pool } from '../db.js';

async function addColumn() {
  try {
    // Add type column if not exists
    await pool.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'sale'
    `);
    console.log('✅ Added type column to invoices table');
    
    // Update existing invoices to have type = 'sale'
    const { rowCount } = await pool.query(`
      UPDATE invoices 
      SET type = 'sale' 
      WHERE type IS NULL
    `);
    console.log(`✅ Updated ${rowCount} existing invoices to type = 'sale'`);
    
    // Verify
    const { rows } = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN type = 'sale' THEN 1 END) as sale_count,
             COUNT(CASE WHEN type IS NULL THEN 1 END) as null_count
      FROM invoices
    `);
    console.log('\nVerification:');
    console.log(`  Total invoices: ${rows[0].total}`);
    console.log(`  Type = 'sale': ${rows[0].sale_count}`);
    console.log(`  Type IS NULL: ${rows[0].null_count}`);
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await pool.end();
  }
}

addColumn();
