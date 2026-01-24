/**
 * Script to ensure journal_entry_id columns exist in all required tables
 * 
 * Rule: أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود
 * 
 * This script ensures that:
 * 1. expenses table has journal_entry_id column
 * 2. invoices table has journal_entry_id column
 * 3. supplier_invoices table has journal_entry_id column
 * 4. payroll_runs table has journal_entry_id column (already exists)
 */

import { pool } from '../db.js';

async function ensureJournalEntryIdColumns() {
  const client = await pool.connect();
  try {
    console.log('[SCHEMA] Ensuring journal_entry_id columns exist in all required tables...\n');

    // 1. Check and add to expenses
    console.log('1. Checking expenses table...');
    const { rows: expensesCheck } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='expenses' AND column_name='journal_entry_id'
    `);
    if (!expensesCheck || expensesCheck.length === 0) {
      await client.query(`
        ALTER TABLE expenses 
        ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Added journal_entry_id column to expenses table');
    } else {
      console.log('   ✅ journal_entry_id column already exists in expenses table');
    }

    // 2. Check and add to invoices
    console.log('\n2. Checking invoices table...');
    const { rows: invoicesCheck } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='invoices' AND column_name='journal_entry_id'
    `);
    if (!invoicesCheck || invoicesCheck.length === 0) {
      await client.query(`
        ALTER TABLE invoices 
        ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Added journal_entry_id column to invoices table');
    } else {
      console.log('   ✅ journal_entry_id column already exists in invoices table');
    }

    // 3. Check and add to supplier_invoices
    console.log('\n3. Checking supplier_invoices table...');
    const { rows: supplierInvoicesCheck } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='supplier_invoices' AND column_name='journal_entry_id'
    `);
    if (!supplierInvoicesCheck || supplierInvoicesCheck.length === 0) {
      await client.query(`
        ALTER TABLE supplier_invoices 
        ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Added journal_entry_id column to supplier_invoices table');
    } else {
      console.log('   ✅ journal_entry_id column already exists in supplier_invoices table');
    }

    // 4. Check payroll_runs (should already exist)
    console.log('\n4. Checking payroll_runs table...');
    const { rows: payrollRunsCheck } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='payroll_runs' AND column_name='journal_entry_id'
    `);
    if (!payrollRunsCheck || payrollRunsCheck.length === 0) {
      await client.query(`
        ALTER TABLE payroll_runs 
        ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Added journal_entry_id column to payroll_runs table');
    } else {
      console.log('   ✅ journal_entry_id column already exists in payroll_runs table');
    }

    console.log('\n✅ All journal_entry_id columns verified/added successfully!');
    return { success: true };
  } catch (e) {
    console.error('[SCHEMA] Error ensuring journal_entry_id columns:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ensureJournalEntryIdColumns()
    .then(() => {
      console.log('\n[SCHEMA] Schema check complete.');
      process.exit(0);
    })
    .catch(e => {
      console.error('\n[SCHEMA] Schema check failed:', e);
      process.exit(1);
    });
}

export { ensureJournalEntryIdColumns };
