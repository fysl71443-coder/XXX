/**
 * Fix Duplicate Accounts
 * يحذف أو يدمج الحسابات المكررة
 */

import { pool } from '../db.js';

async function fixDuplicateAccounts() {
  console.log('🔄 Starting: Fix duplicate accounts...\n');

  try {
    // Step 1: Find duplicates
    console.log('Step 1: Finding duplicate account codes...');
    const { rows: duplicates } = await pool.query(`
      SELECT account_code, COUNT(*) as count, 
             ARRAY_AGG(id ORDER BY id) as account_ids,
             ARRAY_AGG(account_number ORDER BY id) as account_numbers
      FROM accounts
      WHERE account_code IS NOT NULL
      GROUP BY account_code
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    console.log(`Found ${duplicates.length} duplicate account codes\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found. Nothing to fix.');
      return { fixed: 0, deleted: 0, errors: [] };
    }

    let fixed = 0;
    let deleted = 0;
    const errors = [];

    // Step 2: For each duplicate, keep the first one, delete/update others
    for (const dup of duplicates) {
      const accountIds = dup.account_ids;
      const accountNumbers = dup.account_numbers;
      const keepId = accountIds[0]; // Keep the first one
      const deleteIds = accountIds.slice(1); // Delete the rest

      console.log(`\nProcessing account_code: ${dup.account_code}`);
      console.log(`  Keep: ID ${keepId} (account_number: ${accountNumbers[0]})`);
      console.log(`  Delete: ${deleteIds.length} duplicate(s)`);

          // Check if any of the duplicates have journal postings or branch_accounts references
          for (const deleteId of deleteIds) {
            try {
              // Check journal postings
              const { rows: postings } = await pool.query(
                'SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1',
                [deleteId]
              );
              const postingCount = parseInt(postings[0].count);

              // Check branch_accounts references
              let branchAccountsCount = 0;
              try {
                const { rows: branchAccounts } = await pool.query(
                  'SELECT COUNT(*) as count FROM branch_accounts WHERE account_id = $1',
                  [deleteId]
                );
                branchAccountsCount = parseInt(branchAccounts[0].count || 0);
              } catch (e) {
                // Table might not exist or column might be different - ignore
              }

              if (postingCount > 0 || branchAccountsCount > 0) {
                // Has references - cannot delete, update account_code to NULL instead
                console.log(`  ⚠️  Account ID ${deleteId} has ${postingCount} postings, ${branchAccountsCount} branch_accounts - setting account_code to NULL`);
                await pool.query(
                  'UPDATE accounts SET account_code = NULL WHERE id = $1',
                  [deleteId]
                );
                fixed++;
              } else {
                // No references - safe to delete
                console.log(`  ✅ Deleting account ID ${deleteId} (no references)`);
                await pool.query('DELETE FROM accounts WHERE id = $1', [deleteId]);
                deleted++;
              }
            } catch (error) {
              // If deletion fails, try to set account_code to NULL instead
              if (error.message.includes('foreign key')) {
                console.log(`  ⚠️  Account ID ${deleteId} has foreign key references - setting account_code to NULL instead`);
                try {
                  await pool.query(
                    'UPDATE accounts SET account_code = NULL WHERE id = $1',
                    [deleteId]
                  );
                  fixed++;
                } catch (updateError) {
                  errors.push({ accountCode: dup.account_code, accountId: deleteId, error: updateError.message });
                  console.error(`  ❌ Error updating account ID ${deleteId}:`, updateError.message);
                }
              } else {
                errors.push({ accountCode: dup.account_code, accountId: deleteId, error: error.message });
                console.error(`  ❌ Error processing account ID ${deleteId}:`, error.message);
              }
            }
          }
    }

    // Step 3: Create unique constraints if they don't exist
    console.log('\nStep 3: Creating unique constraints...');
    try {
      // Check if constraints exist
      const { rows: existingIndexes } = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'accounts' 
          AND indexname IN ('accounts_account_code_unique', 'accounts_account_number_unique')
      `);

      const existingNames = existingIndexes.map(r => r.indexname);

      if (!existingNames.includes('accounts_account_code_unique')) {
        // First, check if there are still duplicates
        const { rows: stillDuplicates } = await pool.query(`
          SELECT account_code, COUNT(*) as count
          FROM accounts
          WHERE account_code IS NOT NULL
          GROUP BY account_code
          HAVING COUNT(*) > 1
        `);

        if (stillDuplicates.length === 0) {
          await pool.query(`
            CREATE UNIQUE INDEX accounts_account_code_unique 
            ON accounts(account_code) 
            WHERE account_code IS NOT NULL
          `);
          console.log('✅ Created unique constraint on account_code');
        } else {
          console.log(`⚠️  Cannot create constraint - ${stillDuplicates.length} duplicates still exist`);
          console.log('   Run the script again after manually fixing remaining duplicates');
        }
      } else {
        console.log('✅ Unique constraint on account_code already exists');
      }

      if (!existingNames.includes('accounts_account_number_unique')) {
        await pool.query(`
          CREATE UNIQUE INDEX accounts_account_number_unique 
          ON accounts(account_number) 
          WHERE account_number IS NOT NULL
        `);
        console.log('✅ Created unique constraint on account_number');
      } else {
        console.log('✅ Unique constraint on account_number already exists');
      }
    } catch (error) {
      console.error('⚠️  Error creating constraints:', error.message);
      if (!error.message.includes('already exists')) {
        errors.push({ type: 'constraint', error: error.message });
      }
    }

    // Step 4: Summary
    console.log('\n📊 Summary:');
    console.log(`✅ Fixed (set to NULL): ${fixed}`);
    console.log(`✅ Deleted: ${deleted}`);
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      errors.forEach(e => {
        console.log(`   - ${JSON.stringify(e)}`);
      });
    }

    return { fixed, deleted, errors };
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');

if (isMainModule || process.argv[1]?.includes('fix_duplicate_accounts')) {
  fixDuplicateAccounts()
    .then(result => {
      console.log('\n✅ Fix completed successfully!');
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixDuplicateAccounts };
