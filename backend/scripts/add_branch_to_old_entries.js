/**
 * Add Branch to Old Journal Entries
 * يضيف branch للقيود المحاسبية القديمة التي لا تحتوي على branch
 */

import { pool } from '../db.js';

async function addBranchToOldEntries() {
  console.log('🔄 Starting migration: Add branch to old journal entries...\n');

  try {
    // Step 1: Find journal entries without branch
    console.log('Step 1: Finding journal entries without branch...');
    const { rows: entriesWithoutBranch } = await pool.query(`
      SELECT id, date, reference_type, reference_id, branch
      FROM journal_entries
      WHERE branch IS NULL 
        AND reference_type = 'invoice'
      ORDER BY date DESC
    `);

    console.log(`Found ${entriesWithoutBranch.length} entries without branch`);

    if (entriesWithoutBranch.length === 0) {
      console.log('✅ No entries need updating. Migration complete.');
      return { updated: 0, skipped: 0, errors: [] };
    }

    // Step 2: Update each entry by getting branch from invoice
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const entry of entriesWithoutBranch) {
      try {
        // Get branch from invoice
        const { rows: invoiceRows } = await pool.query(
          'SELECT branch FROM invoices WHERE id = $1',
          [entry.reference_id]
        );

        if (invoiceRows && invoiceRows.length > 0 && invoiceRows[0].branch) {
          const branch = invoiceRows[0].branch;
          
          // Update journal entry
          await pool.query(
            'UPDATE journal_entries SET branch = $1 WHERE id = $2',
            [branch, entry.id]
          );
          
          updated++;
          console.log(`✅ Updated entry #${entry.id}: branch = ${branch}`);
        } else {
          // Try to get from order if invoice doesn't have branch
          const { rows: orderRows } = await pool.query(
            `SELECT o.branch 
             FROM orders o 
             JOIN invoices i ON i.id = $1 
             WHERE o.id = i.id OR o.invoice_id = $1
             LIMIT 1`,
            [entry.reference_id]
          );

          if (orderRows && orderRows.length > 0 && orderRows[0].branch) {
            const branch = orderRows[0].branch;
            await pool.query(
              'UPDATE journal_entries SET branch = $1 WHERE id = $2',
              [branch, entry.id]
            );
            updated++;
            console.log(`✅ Updated entry #${entry.id} from order: branch = ${branch}`);
          } else {
            // Default to china_town if no branch found
            await pool.query(
              'UPDATE journal_entries SET branch = $1 WHERE id = $2',
              ['china_town', entry.id]
            );
            updated++;
            console.log(`⚠️  Updated entry #${entry.id} with default branch: china_town`);
          }
        }
      } catch (error) {
        skipped++;
        errors.push({ entryId: entry.id, error: error.message });
        console.error(`❌ Error updating entry #${entry.id}:`, error.message);
      }
    }

    // Step 3: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⚠️  Skipped: ${skipped}`);
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      errors.forEach(e => {
        console.log(`   - Entry #${e.entryId}: ${e.error}`);
      });
    }

    return { updated, skipped, errors };
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule || process.argv[1]?.includes('add_branch_to_old_entries')) {
  addBranchToOldEntries()
    .then(result => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { addBranchToOldEntries };
