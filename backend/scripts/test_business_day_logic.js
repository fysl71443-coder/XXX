/**
 * Test Business Day Logic
 * يختبر منطق Business Day للتأكد من صحته
 */

import { pool } from '../db.js';

async function testBusinessDayLogic() {
  console.log('🧪 Testing Business Day Logic...\n');

  const testDate = '2026-01-19';
  
  // Test 1: Calculate Business Day Range
  console.log('Test 1: Business Day Range Calculation');
  console.log(`Input date: ${testDate}`);
  
  const startTime = `${testDate} 09:00:00`;
  const endTime = `${testDate} 02:00:00`; // Next day
  
  console.log(`Expected start: ${testDate} 09:00:00`);
  console.log(`Expected end: ${testDate} 02:00:00 (next day)`);
  
  // Test 2: PostgreSQL INTERVAL Query
  console.log('\nTest 2: PostgreSQL INTERVAL Query');
  try {
    const { rows } = await pool.query(`
      SELECT 
        ($1::date + INTERVAL '9 hours') as business_day_start,
        ($1::date + INTERVAL '1 day 2 hours') as business_day_end
    `, [testDate]);
    
    console.log('✅ Query executed successfully');
    console.log(`Business Day Start: ${rows[0].business_day_start}`);
    console.log(`Business Day End: ${rows[0].business_day_end}`);
  } catch (e) {
    console.error('❌ Query failed:', e.message);
    return false;
  }

  // Test 3: Check Journal Entries in Business Day
  console.log('\nTest 3: Journal Entries in Business Day');
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count
      FROM journal_entries je
      WHERE je.status = 'posted'
        AND je.reference_type = 'invoice'
        AND je.date >= ($1::date + INTERVAL '9 hours')
        AND je.date < ($1::date + INTERVAL '1 day 2 hours')
    `, [testDate]);
    
    console.log(`✅ Found ${rows[0].count} journal entries in business day`);
  } catch (e) {
    console.error('❌ Query failed:', e.message);
    return false;
  }

  // Test 4: Sample Entries
  console.log('\nTest 4: Sample Journal Entries');
  try {
    const { rows } = await pool.query(`
      SELECT id, date, status, reference_type, reference_id, branch
      FROM journal_entries
      WHERE status = 'posted'
        AND reference_type = 'invoice'
      ORDER BY date DESC
      LIMIT 5
    `);
    
    console.log(`Found ${rows.length} recent entries:`);
    rows.forEach((row, i) => {
      console.log(`  ${i + 1}. Entry #${row.id}: ${row.date} | Branch: ${row.branch || 'NULL'}`);
    });
  } catch (e) {
    console.error('❌ Query failed:', e.message);
    return false;
  }

  console.log('\n✅ All tests completed!');
  return true;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBusinessDayLogic()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(e => {
      console.error('Fatal error:', e);
      process.exit(1);
    });
}

export { testBusinessDayLogic };
