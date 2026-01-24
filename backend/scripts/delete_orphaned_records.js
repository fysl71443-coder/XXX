/**
 * Script to delete orphaned records (records without journal_entry_id)
 * 
 * Rule: أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود
 * 
 * This script deletes:
 * 1. expenses with status='posted' or 'reversed' but journal_entry_id IS NULL
 * 2. invoices with status='posted' or 'reversed' or 'open' or 'partial' but journal_entry_id IS NULL
 * 3. supplier_invoices with status='posted' or 'reversed' but journal_entry_id IS NULL
 * 4. payroll_runs with status='posted' or 'approved' but journal_entry_id IS NULL
 * 
 * WARNING: This script will PERMANENTLY DELETE records. Use with caution.
 * Run check_orphaned_records.js first to see what will be deleted.
 */

import { pool } from '../db.js';

async function deleteOrphanedRecords(dryRun = true) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log(`[DELETE ORPHANED] Starting ${dryRun ? 'DRY RUN' : 'ACTUAL DELETION'}...\n`);

    let deletedCount = {
      expenses: 0,
      invoices: 0,
      supplier_invoices: 0,
      payroll_runs: 0
    };

    // 1. Delete orphaned expenses
    console.log('1. Processing expenses...');
    const { rows: orphanedExpenses } = await client.query(`
      SELECT id, invoice_number, status, total, date
      FROM expenses
      WHERE (status = 'posted' OR status = 'reversed')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedExpenses.length} orphaned expenses`);
    if (orphanedExpenses.length > 0) {
      orphanedExpenses.forEach(exp => {
        console.log(`     - ID: ${exp.id}, Invoice: ${exp.invoice_number || 'N/A'}, Status: ${exp.status}, Total: ${exp.total || 0}`);
      });
      if (!dryRun) {
        const { rowCount } = await client.query(`
          DELETE FROM expenses
          WHERE (status = 'posted' OR status = 'reversed')
            AND journal_entry_id IS NULL
        `);
        deletedCount.expenses = rowCount;
        console.log(`   ✅ Deleted ${rowCount} expenses`);
      } else {
        deletedCount.expenses = orphanedExpenses.length;
        console.log(`   [DRY RUN] Would delete ${orphanedExpenses.length} expenses`);
      }
    }

    // 2. Delete orphaned invoices
    console.log('\n2. Processing invoices...');
    const { rows: orphanedInvoices } = await client.query(`
      SELECT id, number, status, total, date
      FROM invoices
      WHERE (status = 'posted' OR status = 'reversed' OR status = 'open' OR status = 'partial')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedInvoices.length} orphaned invoices`);
    if (orphanedInvoices.length > 0) {
      orphanedInvoices.forEach(inv => {
        console.log(`     - ID: ${inv.id}, Number: ${inv.number || 'N/A'}, Status: ${inv.status}, Total: ${inv.total || 0}`);
      });
      if (!dryRun) {
        const { rowCount } = await client.query(`
          DELETE FROM invoices
          WHERE (status = 'posted' OR status = 'reversed' OR status = 'open' OR status = 'partial')
            AND journal_entry_id IS NULL
        `);
        deletedCount.invoices = rowCount;
        console.log(`   ✅ Deleted ${rowCount} invoices`);
      } else {
        deletedCount.invoices = orphanedInvoices.length;
        console.log(`   [DRY RUN] Would delete ${orphanedInvoices.length} invoices`);
      }
    }

    // 3. Delete orphaned supplier_invoices
    console.log('\n3. Processing supplier_invoices...');
    const { rows: orphanedSupplierInvoices } = await client.query(`
      SELECT id, number, status, total, date
      FROM supplier_invoices
      WHERE (status = 'posted' OR status = 'reversed')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedSupplierInvoices.length} orphaned supplier invoices`);
    if (orphanedSupplierInvoices.length > 0) {
      orphanedSupplierInvoices.forEach(si => {
        console.log(`     - ID: ${si.id}, Number: ${si.number || 'N/A'}, Status: ${si.status}, Total: ${si.total || 0}`);
      });
      if (!dryRun) {
        const { rowCount } = await client.query(`
          DELETE FROM supplier_invoices
          WHERE (status = 'posted' OR status = 'reversed')
            AND journal_entry_id IS NULL
        `);
        deletedCount.supplier_invoices = rowCount;
        console.log(`   ✅ Deleted ${rowCount} supplier invoices`);
      } else {
        deletedCount.supplier_invoices = orphanedSupplierInvoices.length;
        console.log(`   [DRY RUN] Would delete ${orphanedSupplierInvoices.length} supplier invoices`);
      }
    }

    // 4. Delete orphaned payroll_runs
    console.log('\n4. Processing payroll_runs...');
    const { rows: orphanedPayrollRuns } = await client.query(`
      SELECT id, period, status
      FROM payroll_runs
      WHERE (status = 'posted' OR status = 'approved')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedPayrollRuns.length} orphaned payroll runs`);
    if (orphanedPayrollRuns.length > 0) {
      orphanedPayrollRuns.forEach(pr => {
        console.log(`     - ID: ${pr.id}, Period: ${pr.period}, Status: ${pr.status}`);
      });
      if (!dryRun) {
        const { rowCount } = await client.query(`
          DELETE FROM payroll_runs
          WHERE (status = 'posted' OR status = 'approved')
            AND journal_entry_id IS NULL
        `);
        deletedCount.payroll_runs = rowCount;
        console.log(`   ✅ Deleted ${rowCount} payroll runs`);
      } else {
        deletedCount.payroll_runs = orphanedPayrollRuns.length;
        console.log(`   [DRY RUN] Would delete ${orphanedPayrollRuns.length} payroll runs`);
      }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const total = deletedCount.expenses + deletedCount.invoices + deletedCount.supplier_invoices + deletedCount.payroll_runs;
    console.log(`Total records ${dryRun ? 'that would be deleted' : 'deleted'}: ${total}`);
    console.log(`  - Expenses: ${deletedCount.expenses}`);
    console.log(`  - Invoices: ${deletedCount.invoices}`);
    console.log(`  - Supplier Invoices: ${deletedCount.supplier_invoices}`);
    console.log(`  - Payroll Runs: ${deletedCount.payroll_runs}`);

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No records were actually deleted.');
      console.log('   To actually delete these records, run: node scripts/delete_orphaned_records.js --execute');
    } else {
      await client.query('COMMIT');
      console.log('\n✅ Deletion complete. Transaction committed.');
    }

    return deletedCount;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[DELETE ORPHANED] Error:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]) ||
                     process.argv[1]?.endsWith('delete_orphaned_records.js');

if (isMainModule) {
  const dryRun = !process.argv.includes('--execute');
  deleteOrphanedRecords(dryRun)
    .then(result => {
      console.log('\n[DELETE ORPHANED] Operation complete.');
      process.exit(0);
    })
    .catch(e => {
      console.error('\n[DELETE ORPHANED] Operation failed:', e);
      process.exit(1);
    });
}

export { deleteOrphanedRecords };
