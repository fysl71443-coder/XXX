/**
 * Script to add database constraints to prevent orphaned records
 * 
 * Rule: أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود
 * 
 * This script adds CHECK constraints to enforce the rule at database level
 */

import { pool } from '../db.js';

async function addDatabaseConstraints() {
  const client = await pool.connect();
  try {
    console.log('[CONSTRAINTS] Starting to add database constraints...\n');

    // 1. Add constraint for expenses
    console.log('1. Adding constraint for expenses...');
    try {
      await client.query(`
        ALTER TABLE expenses 
        DROP CONSTRAINT IF EXISTS check_expense_journal_entry
      `);
      await client.query(`
        ALTER TABLE expenses 
        ADD CONSTRAINT check_expense_journal_entry 
        CHECK (
          (status != 'posted' AND status != 'reversed') 
          OR journal_entry_id IS NOT NULL
        )
      `);
      console.log('   ✅ Added constraint for expenses');
    } catch (e) {
      console.error('   ❌ Error adding constraint for expenses:', e.message);
      throw e;
    }

    // 2. Add constraint for invoices
    console.log('\n2. Adding constraint for invoices...');
    try {
      await client.query(`
        ALTER TABLE invoices 
        DROP CONSTRAINT IF EXISTS check_invoice_journal_entry
      `);
      await client.query(`
        ALTER TABLE invoices 
        ADD CONSTRAINT check_invoice_journal_entry 
        CHECK (
          (status NOT IN ('posted', 'reversed', 'open', 'partial')) 
          OR journal_entry_id IS NOT NULL
        )
      `);
      console.log('   ✅ Added constraint for invoices');
    } catch (e) {
      console.error('   ❌ Error adding constraint for invoices:', e.message);
      throw e;
    }

    // 3. Add constraint for supplier_invoices
    console.log('\n3. Adding constraint for supplier_invoices...');
    try {
      await client.query(`
        ALTER TABLE supplier_invoices 
        DROP CONSTRAINT IF EXISTS check_supplier_invoice_journal_entry
      `);
      await client.query(`
        ALTER TABLE supplier_invoices 
        ADD CONSTRAINT check_supplier_invoice_journal_entry 
        CHECK (
          (status != 'posted' AND status != 'reversed') 
          OR journal_entry_id IS NOT NULL
        )
      `);
      console.log('   ✅ Added constraint for supplier_invoices');
    } catch (e) {
      console.error('   ❌ Error adding constraint for supplier_invoices:', e.message);
      throw e;
    }

    // 4. Add constraint for payroll_runs
    console.log('\n4. Adding constraint for payroll_runs...');
    try {
      await client.query(`
        ALTER TABLE payroll_runs 
        DROP CONSTRAINT IF EXISTS check_payroll_run_journal_entry
      `);
      await client.query(`
        ALTER TABLE payroll_runs 
        ADD CONSTRAINT check_payroll_run_journal_entry 
        CHECK (
          (status != 'posted' AND status != 'approved') 
          OR journal_entry_id IS NOT NULL
        )
      `);
      console.log('   ✅ Added constraint for payroll_runs');
    } catch (e) {
      console.error('   ❌ Error adding constraint for payroll_runs:', e.message);
      throw e;
    }

    console.log('\n✅ All database constraints added successfully!');
    console.log('\n⚠️  NOTE: If there are existing orphaned records, this script will fail.');
    console.log('   Please run check_orphaned_records.js first and clean up any orphaned records.');
    
    return { success: true };
  } catch (e) {
    console.error('\n[CONSTRAINTS] Error adding constraints:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  addDatabaseConstraints()
    .then(() => {
      console.log('\n[CONSTRAINTS] Constraints setup complete.');
      process.exit(0);
    })
    .catch(e => {
      console.error('\n[CONSTRAINTS] Constraints setup failed:', e);
      process.exit(1);
    });
}

export { addDatabaseConstraints };
