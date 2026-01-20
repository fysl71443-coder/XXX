/**
 * System Health Verification Script
 * يتحقق من صحة النظام بعد الإصلاحات
 */

import { pool } from '../db.js';

async function verifySystemHealth() {
  const results = {
    database: { status: 'unknown', details: [] },
    accounts: { status: 'unknown', details: [] },
    journalEntries: { status: 'unknown', details: [] },
    apiEndpoints: { status: 'unknown', details: [] },
    schema: { status: 'unknown', details: [] }
  };

  console.log('🔍 Starting System Health Verification...\n');

  // 1. Database Connection
  try {
    const { rows } = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    results.database.status = 'ok';
    results.database.details.push(`Connected to PostgreSQL: ${rows[0].pg_version.split(' ')[0]} ${rows[0].pg_version.split(' ')[1]}`);
    console.log('✅ Database connection: OK');
  } catch (e) {
    results.database.status = 'error';
    results.database.details.push(`Connection failed: ${e.message}`);
    console.error('❌ Database connection: FAILED');
    return results;
  }

  // 2. Accounts Table - Check for duplicates
  try {
    const { rows: duplicates } = await pool.query(`
      SELECT account_code, COUNT(*) as count
      FROM accounts
      WHERE account_code IS NOT NULL
      GROUP BY account_code
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      results.accounts.status = 'ok';
      results.accounts.details.push('No duplicate account codes found');
      console.log('✅ Accounts: No duplicates');
    } else {
      results.accounts.status = 'warning';
      results.accounts.details.push(`Found ${duplicates.length} duplicate account codes`);
      duplicates.forEach(d => {
        results.accounts.details.push(`  - ${d.account_code}: ${d.count} occurrences`);
      });
      console.warn(`⚠️  Accounts: Found ${duplicates.length} duplicates`);
    }
  } catch (e) {
    results.accounts.status = 'error';
    results.accounts.details.push(`Check failed: ${e.message}`);
    console.error('❌ Accounts check: FAILED');
  }

  // 3. Journal Entries - Check for missing branch
  try {
    const { rows: missingBranch } = await pool.query(`
      SELECT COUNT(*) as count
      FROM journal_entries
      WHERE branch IS NULL AND reference_type = 'invoice'
    `);
    
    if (missingBranch[0].count === '0') {
      results.journalEntries.status = 'ok';
      results.journalEntries.details.push('All invoice journal entries have branch');
      console.log('✅ Journal Entries: All have branch');
    } else {
      results.journalEntries.status = 'warning';
      results.journalEntries.details.push(`${missingBranch[0].count} entries missing branch`);
      console.warn(`⚠️  Journal Entries: ${missingBranch[0].count} missing branch`);
    }
  } catch (e) {
    results.journalEntries.status = 'error';
    results.journalEntries.details.push(`Check failed: ${e.message}`);
    console.error('❌ Journal Entries check: FAILED');
  }

  // 4. Schema - Check for updated_at in pos_tables
  try {
    const { rows: columns } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pos_tables' AND column_name = 'updated_at'
    `);
    
    if (columns.length > 0) {
      results.schema.status = 'ok';
      results.schema.details.push('pos_tables.updated_at column exists');
      console.log('✅ Schema: pos_tables.updated_at exists');
    } else {
      results.schema.status = 'error';
      results.schema.details.push('pos_tables.updated_at column missing');
      console.error('❌ Schema: pos_tables.updated_at missing');
    }
  } catch (e) {
    results.schema.status = 'error';
    results.schema.details.push(`Check failed: ${e.message}`);
    console.error('❌ Schema check: FAILED');
  }

  // 5. Unique Constraints
  try {
    const { rows: indexes } = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'accounts' 
        AND indexname IN ('accounts_account_code_unique', 'accounts_account_number_unique')
    `);
    
    if (indexes.length === 2) {
      results.schema.status = results.schema.status === 'ok' ? 'ok' : 'warning';
      results.schema.details.push('Unique constraints on accounts exist');
      console.log('✅ Schema: Unique constraints exist');
    } else {
      results.schema.status = 'warning';
      results.schema.details.push(`Only ${indexes.length}/2 unique constraints found`);
      console.warn(`⚠️  Schema: Only ${indexes.length}/2 unique constraints`);
    }
  } catch (e) {
    results.schema.status = 'error';
    results.schema.details.push(`Check failed: ${e.message}`);
    console.error('❌ Schema constraints check: FAILED');
  }

  // Summary
  console.log('\n📊 Summary:');
  const allOk = Object.values(results).every(r => r.status === 'ok');
  const hasErrors = Object.values(results).some(r => r.status === 'error');
  
  if (allOk) {
    console.log('✅ All checks passed!');
  } else if (hasErrors) {
    console.error('❌ Some checks failed - review details above');
  } else {
    console.warn('⚠️  Some warnings - system functional but needs attention');
  }

  return results;
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');

if (isMainModule || process.argv[1]?.includes('verify_system_health')) {
  verifySystemHealth()
    .then(results => {
      console.log('\n📋 Detailed Results:');
      console.log(JSON.stringify(results, null, 2));
      process.exit(results.database.status === 'error' ? 1 : 0);
    })
    .catch(e => {
      console.error('Fatal error:', e);
      process.exit(1);
    });
}

export { verifySystemHealth };
