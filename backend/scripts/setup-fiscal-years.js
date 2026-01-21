/**
 * Setup Fiscal Years Table
 * نظام إدارة السنوات المالية
 */

import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function setup() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('          FISCAL YEARS SETUP');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Create fiscal_years table
    console.log('1. Creating fiscal_years table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fiscal_years (
        id SERIAL PRIMARY KEY,
        year INT NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'rollover')),
        temporary_open BOOLEAN DEFAULT FALSE,
        temporary_open_by INT,
        temporary_open_at TIMESTAMP,
        temporary_open_reason TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        notes TEXT,
        closed_by INT,
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ fiscal_years table created');

    // 2. Create fiscal_year_activities table
    console.log('2. Creating fiscal_year_activities table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fiscal_year_activities (
        id SERIAL PRIMARY KEY,
        fiscal_year_id INT,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        details JSONB,
        user_id INT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ fiscal_year_activities table created');

    // 3. Add fiscal_year_id columns
    console.log('3. Adding fiscal_year_id columns...');
    
    const tables = ['journal_entries', 'invoices', 'expenses'];
    for (const table of tables) {
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS fiscal_year_id INT`);
        console.log(`   ✅ Added fiscal_year_id to ${table}`);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.log(`   ⚠️ ${table}: ${e.message}`);
        }
      }
    }

    // 4. Create indexes
    console.log('4. Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_fiscal_years_year ON fiscal_years(year)',
      'CREATE INDEX IF NOT EXISTS idx_fiscal_years_status ON fiscal_years(status)',
      'CREATE INDEX IF NOT EXISTS idx_fiscal_year_activities_fiscal_year ON fiscal_year_activities(fiscal_year_id)',
      'CREATE INDEX IF NOT EXISTS idx_fiscal_year_activities_action ON fiscal_year_activities(action)',
    ];
    
    for (const idx of indexes) {
      try {
        await pool.query(idx);
      } catch (e) {
        // Ignore if already exists
      }
    }
    console.log('   ✅ Indexes created');

    // 5. Insert current year
    console.log('5. Inserting fiscal years...');
    const currentYear = new Date().getFullYear();
    
    // Current year
    await pool.query(`
      INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
      VALUES ($1, 'open', $2, $3, $4)
      ON CONFLICT (year) DO NOTHING
    `, [
      currentYear,
      `${currentYear}-01-01`,
      `${currentYear}-12-31`,
      'السنة المالية الحالية'
    ]);
    
    // Previous year
    await pool.query(`
      INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
      VALUES ($1, 'closed', $2, $3, $4)
      ON CONFLICT (year) DO NOTHING
    `, [
      currentYear - 1,
      `${currentYear - 1}-01-01`,
      `${currentYear - 1}-12-31`,
      'السنة المالية السابقة'
    ]);
    
    console.log('   ✅ Fiscal years inserted');

    // 6. Show result
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                   FISCAL YEARS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const { rows } = await pool.query(`
      SELECT year, status, temporary_open, start_date, end_date, notes
      FROM fiscal_years
      ORDER BY year DESC
    `);
    
    for (const row of rows) {
      const statusIcon = row.status === 'open' ? '✅' : row.status === 'closed' ? '🔒' : '🔄';
      console.log(`${statusIcon} ${row.year}: ${row.status}${row.temporary_open ? ' (مفتوحة مؤقتاً)' : ''}`);
      console.log(`   ${row.start_date} → ${row.end_date}`);
      console.log(`   ${row.notes || ''}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                   SETUP COMPLETE ✅');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (e) {
    console.error('❌ Error:', e.message);
    throw e;
  } finally {
    await pool.end();
  }
}

setup().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
