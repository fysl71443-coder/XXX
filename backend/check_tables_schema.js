import { pool } from './db.js';

async function checkSchema() {
  try {
    // Check pos_tables structure
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='pos_tables'
    `);
    console.log('pos_tables columns:');
    console.table(result.rows);

    // Check tables structure
    const result2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='tables'
    `);
    console.log('\ntables columns:');
    console.table(result2.rows);

    // Check orders structure for table_code
    const result3 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name IN ('table_code', 'branch')
    `);
    console.log('\norders table_code/branch columns:');
    console.table(result3.rows);

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkSchema();
