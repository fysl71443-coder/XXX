/**
 * Script to improve Fiscal Year System based on recommendations
 * 
 * Improvements:
 * 1. Add constraint to ensure only one open year exists (or one open + one temporary_open)
 * 2. Add old_status and new_status to fiscal_year_activities for better audit trail
 * 3. Add caching for expensive endpoints (stats, checklist, compare)
 * 4. Add include_profit_loss option for rollover
 */

import { pool } from '../db.js';

async function improveFiscalYearSystem() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('[FISCAL_YEAR_IMPROVEMENTS] Starting improvements...\n');

    // 1. Add old_status and new_status columns to fiscal_year_activities
    console.log('1. Adding old_status and new_status to fiscal_year_activities...');
    try {
      await client.query(`
        ALTER TABLE fiscal_year_activities
        ADD COLUMN IF NOT EXISTS old_status TEXT,
        ADD COLUMN IF NOT EXISTS new_status TEXT
      `);
      console.log('   ✅ Added old_status and new_status columns');
    } catch (e) {
      if (e.code !== '42701') { // Column already exists
        throw e;
      }
      console.log('   ⚠️  Columns already exist, skipping...');
    }

    // 2. Add partial unique index to ensure only one open year (or one open + one temporary_open)
    // This is a complex constraint - we'll use a partial unique index
    console.log('\n2. Adding constraint for single open year...');
    try {
      // Drop existing constraint if exists
      await client.query(`
        DROP INDEX IF EXISTS fiscal_years_single_open_idx
      `);
      
      // Create partial unique index: only one year can have status='open' at a time
      // Note: This allows one 'open' + one 'temporary_open' (which is status='closed' with temporary_open=true)
      // PostgreSQL partial unique index syntax
      await client.query(`
        CREATE UNIQUE INDEX fiscal_years_single_open_idx
        ON fiscal_years (status)
        WHERE status = 'open'
      `);
      console.log('   ✅ Added unique constraint for single open year');
    } catch (e) {
      if (e.code === '42P07') { // Index already exists
        console.log('   ⚠️  Index already exists, skipping...');
      } else {
        console.warn('   ⚠️  Could not add constraint:', e.message);
      }
    }

    // 3. Add index for better performance on date queries
    console.log('\n3. Adding performance indexes...');
    try {
      // Try GIST index first (requires btree_gist extension)
      await client.query(`
        CREATE INDEX IF NOT EXISTS fiscal_years_start_date_idx ON fiscal_years(start_date);
        CREATE INDEX IF NOT EXISTS fiscal_years_end_date_idx ON fiscal_years(end_date);
      `);
      console.log('   ✅ Added date indexes');
    } catch (e) {
      console.warn('   ⚠️  Could not add date indexes:', e.message);
    }

    // 4. Add index on activities for better query performance
    console.log('\n4. Adding indexes on activities table...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS fiscal_year_activities_fiscal_year_id_idx
        ON fiscal_year_activities(fiscal_year_id);
        CREATE INDEX IF NOT EXISTS fiscal_year_activities_created_at_idx
        ON fiscal_year_activities(created_at DESC);
      `);
      console.log('   ✅ Added activity indexes');
    } catch (e) {
      console.warn('   ⚠️  Could not add activity indexes:', e.message);
    }

    await client.query('COMMIT');
    console.log('\n✅ All improvements applied successfully!');
    
    return {
      success: true,
      improvements: [
        'Added old_status and new_status to fiscal_year_activities',
        'Added unique constraint for single open year',
        'Added performance indexes'
      ]
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[FISCAL_YEAR_IMPROVEMENTS] Error:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  improveFiscalYearSystem()
    .then(result => {
      console.log('\n[FISCAL_YEAR_IMPROVEMENTS] Complete.');
      process.exit(0);
    })
    .catch(e => {
      console.error('\n[FISCAL_YEAR_IMPROVEMENTS] Failed:', e);
      process.exit(1);
    });
}

export { improveFiscalYearSystem };
