import { pool } from '../db.js';

async function checkColumns() {
  try {
    console.log('🔍 Checking database columns...\n');
    
    // Check invoices table
    const invoicesCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invoices' 
      AND column_name IN ('journal_entry_id', 'status', 'branch', 'type')
      ORDER BY column_name
    `);
    console.log('📋 invoices table:');
    console.log('  journal_entry_id:', invoicesCheck.rows.find(r => r.column_name === 'journal_entry_id') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  status:', invoicesCheck.rows.find(r => r.column_name === 'status') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  branch:', invoicesCheck.rows.find(r => r.column_name === 'branch') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  type:', invoicesCheck.rows.find(r => r.column_name === 'type') ? '✅ EXISTS' : '❌ MISSING');
    
    // Check expenses table
    const expensesCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'expenses' 
      AND column_name IN ('journal_entry_id', 'status', 'branch')
      ORDER BY column_name
    `);
    console.log('\n📋 expenses table:');
    console.log('  journal_entry_id:', expensesCheck.rows.find(r => r.column_name === 'journal_entry_id') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  status:', expensesCheck.rows.find(r => r.column_name === 'status') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  branch:', expensesCheck.rows.find(r => r.column_name === 'branch') ? '✅ EXISTS' : '❌ MISSING');
    
    // Check supplier_invoices table
    const supplierInvoicesCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_invoices' 
      AND column_name IN ('journal_entry_id', 'status', 'branch')
      ORDER BY column_name
    `);
    console.log('\n📋 supplier_invoices table:');
    console.log('  journal_entry_id:', supplierInvoicesCheck.rows.find(r => r.column_name === 'journal_entry_id') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  status:', supplierInvoicesCheck.rows.find(r => r.column_name === 'status') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  branch:', supplierInvoicesCheck.rows.find(r => r.column_name === 'branch') ? '✅ EXISTS' : '❌ MISSING');
    
    // Check journal_entries table
    const journalEntriesCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'journal_entries' 
      AND column_name IN ('status', 'period', 'branch', 'reference_type', 'reference_id')
      ORDER BY column_name
    `);
    console.log('\n📋 journal_entries table:');
    console.log('  status:', journalEntriesCheck.rows.find(r => r.column_name === 'status') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  period:', journalEntriesCheck.rows.find(r => r.column_name === 'period') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  branch:', journalEntriesCheck.rows.find(r => r.column_name === 'branch') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  reference_type:', journalEntriesCheck.rows.find(r => r.column_name === 'reference_type') ? '✅ EXISTS' : '❌ MISSING');
    console.log('  reference_id:', journalEntriesCheck.rows.find(r => r.column_name === 'reference_id') ? '✅ EXISTS' : '❌ MISSING');
    
    // Check posted entries count
    const postedCount = await pool.query(`
      SELECT COUNT(*) as count FROM journal_entries WHERE status = 'posted'
    `);
    console.log('\n📊 Statistics:');
    console.log('  Posted journal entries:', postedCount.rows[0]?.count || 0);
    
    // Check invoices with journal entries
    const invoicesWithJournal = await pool.query(`
      SELECT COUNT(*) as count FROM invoices WHERE journal_entry_id IS NOT NULL
    `);
    console.log('  Invoices with journal_entry_id:', invoicesWithJournal.rows[0]?.count || 0);
    
    // Check expenses with journal entries
    const expensesWithJournal = await pool.query(`
      SELECT COUNT(*) as count FROM expenses WHERE journal_entry_id IS NOT NULL
    `);
    console.log('  Expenses with journal_entry_id:', expensesWithJournal.rows[0]?.count || 0);
    
    // Check supplier_invoices with journal entries
    const supplierInvoicesWithJournal = await pool.query(`
      SELECT COUNT(*) as count FROM supplier_invoices WHERE journal_entry_id IS NOT NULL
    `);
    console.log('  Supplier invoices with journal_entry_id:', supplierInvoicesWithJournal.rows[0]?.count || 0);
    
    console.log('\n✅ Check complete!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

checkColumns();
