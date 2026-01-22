/**
 * Cleanup Orphaned Expenses Script
 * تنظيف فواتير المصروفات التي لا تحتوي على قيود
 * 
 * Rule: كل عملية لها قيد، وحذف القيد يعني حذف العملية كاملة
 * إذا كانت فاتورة المصروف بحالة posted أو reversed ولكن لا تحتوي على journal_entry_id
 * فهذا يعني أن القيد تم حذفه، وبالتالي يجب حذف الفاتورة أيضاً
 */

const { pool } = require('../db.js');

async function cleanupOrphanedExpenses() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('[CLEANUP] Starting cleanup of orphaned expenses...');
    
    // Find expenses that are posted/reversed but have no journal_entry_id
    // These are orphaned because their journal entries were deleted
    const { rows: orphanedExpenses } = await client.query(`
      SELECT id, invoice_number, status, journal_entry_id, amount, total, date
      FROM expenses
      WHERE (status = 'posted' OR status = 'reversed')
        AND journal_entry_id IS NULL
      ORDER BY id DESC
    `);
    
    console.log(`[CLEANUP] Found ${orphanedExpenses.length} orphaned expenses`);
    
    if (orphanedExpenses.length === 0) {
      await client.query('COMMIT');
      console.log('[CLEANUP] No orphaned expenses found. Cleanup complete.');
      return { deleted: 0, items: [] };
    }
    
    // Show what will be deleted
    console.log('[CLEANUP] Orphaned expenses to delete:');
    orphanedExpenses.forEach(exp => {
      console.log(`  - EXP-${exp.id} (${exp.status}): ${exp.total || exp.amount} SAR - ${exp.date}`);
    });
    
    // Delete orphaned expenses
    const deletedIds = orphanedExpenses.map(e => e.id);
    if (deletedIds.length > 0) {
      await client.query(
        `DELETE FROM expenses WHERE id = ANY($1::int[])`,
        [deletedIds]
      );
      console.log(`[CLEANUP] Deleted ${deletedIds.length} orphaned expenses`);
    }
    
    await client.query('COMMIT');
    
    return {
      deleted: deletedIds.length,
      items: orphanedExpenses.map(e => ({
        id: e.id,
        invoice_number: e.invoice_number || `EXP-${e.id}`,
        status: e.status,
        amount: e.total || e.amount,
        date: e.date
      }))
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[CLEANUP] Error cleaning up orphaned expenses:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  cleanupOrphanedExpenses()
    .then(result => {
      console.log('\n[CLEANUP] Cleanup complete:', result);
      process.exit(0);
    })
    .catch(e => {
      console.error('\n[CLEANUP] Cleanup failed:', e);
      process.exit(1);
    });
}

module.exports = { cleanupOrphanedExpenses };
