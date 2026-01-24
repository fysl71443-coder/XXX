/**
 * Script to add database indexes for performance optimization
 * 
 * This script adds indexes on journal_entry_id columns and status columns
 * to improve query performance
 */

import { pool } from '../db.js';

async function addDatabaseIndexes() {
  const client = await pool.connect();
  try {
    console.log('[INDEXES] Starting to add database indexes...\n');

    // 1. Add indexes for journal_entry_id
    console.log('1. Adding indexes for journal_entry_id...');
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_expenses_journal_entry_id 
        ON expenses(journal_entry_id)
      `);
      console.log('   ✅ Added index for expenses.journal_entry_id');
    } catch (e) {
      console.error('   ❌ Error adding index for expenses:', e.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_invoices_journal_entry_id 
        ON invoices(journal_entry_id)
      `);
      console.log('   ✅ Added index for invoices.journal_entry_id');
    } catch (e) {
      console.error('   ❌ Error adding index for invoices:', e.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_invoices_journal_entry_id 
        ON supplier_invoices(journal_entry_id)
      `);
      console.log('   ✅ Added index for supplier_invoices.journal_entry_id');
    } catch (e) {
      console.error('   ❌ Error adding index for supplier_invoices:', e.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payroll_runs_journal_entry_id 
        ON payroll_runs(journal_entry_id)
      `);
      console.log('   ✅ Added index for payroll_runs.journal_entry_id');
    } catch (e) {
      console.error('   ❌ Error adding index for payroll_runs:', e.message);
    }

    // 2. Add composite indexes for status + journal_entry_id (for filtering queries)
    console.log('\n2. Adding composite indexes for status + journal_entry_id...');
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_expenses_status_journal_entry 
        ON expenses(status, journal_entry_id) 
        WHERE journal_entry_id IS NOT NULL
      `);
      console.log('   ✅ Added composite index for expenses(status, journal_entry_id)');
    } catch (e) {
      console.error('   ❌ Error adding composite index for expenses:', e.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_invoices_status_journal_entry 
        ON invoices(status, journal_entry_id) 
        WHERE journal_entry_id IS NOT NULL
      `);
      console.log('   ✅ Added composite index for invoices(status, journal_entry_id)');
    } catch (e) {
      console.error('   ❌ Error adding composite index for invoices:', e.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status_journal_entry 
        ON supplier_invoices(status, journal_entry_id) 
        WHERE journal_entry_id IS NOT NULL
      `);
      console.log('   ✅ Added composite index for supplier_invoices(status, journal_entry_id)');
    } catch (e) {
      console.error('   ❌ Error adding composite index for supplier_invoices:', e.message);
    }

    // 3. Add indexes for reference_type and reference_id in journal_entries (for reverse lookups)
    console.log('\n3. Adding indexes for journal_entries reference columns...');
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
        ON journal_entries(reference_type, reference_id)
      `);
      console.log('   ✅ Added index for journal_entries(reference_type, reference_id)');
    } catch (e) {
      console.error('   ❌ Error adding index for journal_entries:', e.message);
    }

    console.log('\n✅ All database indexes added successfully!');
    
    return { success: true };
  } catch (e) {
    console.error('\n[INDEXES] Error adding indexes:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  addDatabaseIndexes()
    .then(() => {
      console.log('\n[INDEXES] Indexes setup complete.');
      process.exit(0);
    })
    .catch(e => {
      console.error('\n[INDEXES] Indexes setup failed:', e);
      process.exit(1);
    });
}

export { addDatabaseIndexes };
