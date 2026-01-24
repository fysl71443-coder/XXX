/**
 * Script to check for orphaned records (records without journal_entry_id)
 * 
 * Rule: أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود
 * 
 * This script checks:
 * 1. expenses with status='posted' or 'reversed' but journal_entry_id IS NULL
 * 2. invoices with status='posted' or 'reversed' but journal_entry_id IS NULL
 * 3. supplier_invoices with status='posted' or 'reversed' but journal_entry_id IS NULL
 * 4. payroll_runs with status='posted' but journal_entry_id IS NULL
 * 5. payments without journal_entry_id (if payments should have journal entries)
 */

import { pool } from '../db.js';

async function checkOrphanedRecords() {
  const client = await pool.connect();
  try {
    console.log('[ORPHANED CHECK] Starting comprehensive orphaned records check...\n');

    // 1. Check expenses
    console.log('1. Checking expenses...');
    const { rows: orphanedExpenses } = await client.query(`
      SELECT id, invoice_number, status, journal_entry_id, total, date, created_at
      FROM expenses
      WHERE (status = 'posted' OR status = 'reversed')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedExpenses.length} orphaned expenses`);
    if (orphanedExpenses.length > 0) {
      console.log('   Orphaned expenses:');
      orphanedExpenses.slice(0, 10).forEach(exp => {
        console.log(`     - ID: ${exp.id}, Invoice: ${exp.invoice_number || 'N/A'}, Status: ${exp.status}, Total: ${exp.total || 0}, Date: ${exp.date}`);
      });
      if (orphanedExpenses.length > 10) {
        console.log(`     ... and ${orphanedExpenses.length - 10} more`);
      }
    }

    // 2. Check invoices
    console.log('\n2. Checking invoices...');
    const { rows: orphanedInvoices } = await client.query(`
      SELECT id, number, status, journal_entry_id, total, date, created_at
      FROM invoices
      WHERE (status = 'posted' OR status = 'reversed' OR status = 'open' OR status = 'partial')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedInvoices.length} orphaned invoices`);
    if (orphanedInvoices.length > 0) {
      console.log('   Orphaned invoices:');
      orphanedInvoices.slice(0, 10).forEach(inv => {
        console.log(`     - ID: ${inv.id}, Number: ${inv.number || 'N/A'}, Status: ${inv.status}, Total: ${inv.total || 0}, Date: ${inv.date}`);
      });
      if (orphanedInvoices.length > 10) {
        console.log(`     ... and ${orphanedInvoices.length - 10} more`);
      }
    }

    // 3. Check supplier_invoices
    console.log('\n3. Checking supplier_invoices...');
    const { rows: orphanedSupplierInvoices } = await client.query(`
      SELECT id, number, status, journal_entry_id, total, date, created_at
      FROM supplier_invoices
      WHERE (status = 'posted' OR status = 'reversed')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedSupplierInvoices.length} orphaned supplier invoices`);
    if (orphanedSupplierInvoices.length > 0) {
      console.log('   Orphaned supplier invoices:');
      orphanedSupplierInvoices.slice(0, 10).forEach(si => {
        console.log(`     - ID: ${si.id}, Number: ${si.number || 'N/A'}, Status: ${si.status}, Total: ${si.total || 0}, Date: ${si.date}`);
      });
      if (orphanedSupplierInvoices.length > 10) {
        console.log(`     ... and ${orphanedSupplierInvoices.length - 10} more`);
      }
    }

    // 4. Check payroll_runs
    console.log('\n4. Checking payroll_runs...');
    const { rows: orphanedPayrollRuns } = await client.query(`
      SELECT id, period, status, journal_entry_id, created_at
      FROM payroll_runs
      WHERE (status = 'posted' OR status = 'approved')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    console.log(`   Found ${orphanedPayrollRuns.length} orphaned payroll runs`);
    if (orphanedPayrollRuns.length > 0) {
      console.log('   Orphaned payroll runs:');
      orphanedPayrollRuns.slice(0, 10).forEach(pr => {
        console.log(`     - ID: ${pr.id}, Period: ${pr.period}, Status: ${pr.status}`);
      });
      if (orphanedPayrollRuns.length > 10) {
        console.log(`     ... and ${orphanedPayrollRuns.length - 10} more`);
      }
    }

    // 5. Check payments (if they should have journal_entry_id)
    console.log('\n5. Checking payments...');
    const { rows: paymentsCheck } = await client.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN journal_entry_id IS NULL THEN 1 END) as without_journal
      FROM payments
    `);
    console.log(`   Total payments: ${paymentsCheck[0]?.total || 0}`);
    console.log(`   Payments without journal_entry_id: ${paymentsCheck[0]?.without_journal || 0}`);
    // Note: Payments might not always have journal_entry_id directly, they might be linked through invoices

    // 6. Summary
    console.log('\n=== SUMMARY ===');
    const totalOrphaned = orphanedExpenses.length + orphanedInvoices.length + orphanedSupplierInvoices.length + orphanedPayrollRuns.length;
    console.log(`Total orphaned records: ${totalOrphaned}`);
    console.log(`  - Expenses: ${orphanedExpenses.length}`);
    console.log(`  - Invoices: ${orphanedInvoices.length}`);
    console.log(`  - Supplier Invoices: ${orphanedSupplierInvoices.length}`);
    console.log(`  - Payroll Runs: ${orphanedPayrollRuns.length}`);

    if (totalOrphaned > 0) {
      console.log('\n⚠️  WARNING: Found orphaned records that violate the rule!');
      console.log('   Rule: أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود');
      console.log('\n   These records should be deleted or linked to journal entries.');
    } else {
      console.log('\n✅ No orphaned records found. System is compliant with the rule.');
    }

    return {
      expenses: orphanedExpenses.length,
      invoices: orphanedInvoices.length,
      supplier_invoices: orphanedSupplierInvoices.length,
      payroll_runs: orphanedPayrollRuns.length,
      total: totalOrphaned,
      details: {
        expenses: orphanedExpenses,
        invoices: orphanedInvoices,
        supplier_invoices: orphanedSupplierInvoices,
        payroll_runs: orphanedPayrollRuns
      }
    };
  } catch (e) {
    console.error('[ORPHANED CHECK] Error:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  checkOrphanedRecords()
    .then(result => {
      console.log('\n[ORPHANED CHECK] Check complete.');
      process.exit(result.total > 0 ? 1 : 0);
    })
    .catch(e => {
      console.error('\n[ORPHANED CHECK] Check failed:', e);
      process.exit(1);
    });
}

export { checkOrphanedRecords };
