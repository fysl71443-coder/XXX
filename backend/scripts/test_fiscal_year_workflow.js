/**
 * Test script to verify fiscal year workflow:
 * 1. Open a past fiscal year (2025) temporarily
 * 2. Create journal entries (opening balances) for that year
 * 3. Close the temporary opening
 * 4. Verify entries appear in correct year's lists
 */

import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFiscalYearWorkflow() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing Fiscal Year Workflow...\n');

    // Step 1: Find or create fiscal year 2025
    console.log('1️⃣ Finding fiscal year 2025...');
    const { rows: fy2025 } = await client.query(`
      SELECT * FROM fiscal_years WHERE year = 2025
    `);

    let fiscalYear2025;
    if (!fy2025 || fy2025.length === 0) {
      console.log('   ⚠️  Fiscal year 2025 not found, creating...');
      const { rows: newFY } = await client.query(`
        INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
        VALUES (2025, 'closed', '2025-01-01', '2025-12-31', 'السنة المالية 2025')
        RETURNING *
      `);
      fiscalYear2025 = newFY[0];
      console.log('   ✅ Created fiscal year 2025');
    } else {
      fiscalYear2025 = fy2025[0];
      console.log(`   ✅ Found fiscal year 2025 (ID: ${fiscalYear2025.id}, Status: ${fiscalYear2025.status})`);
    }

    // Step 2: Temporarily open 2025
    console.log('\n2️⃣ Temporarily opening fiscal year 2025...');
    const { rows: tempOpen } = await client.query(`
      UPDATE fiscal_years
      SET 
        temporary_open = TRUE,
        temporary_open_by = 1,
        temporary_open_at = NOW(),
        temporary_open_reason = 'إدخال أرصدة مرحلة من 2025',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [fiscalYear2025.id]);

    if (!tempOpen || tempOpen.length === 0) {
      throw new Error('Failed to temporarily open fiscal year');
    }
    console.log('   ✅ Fiscal year 2025 temporarily opened');

    // Step 3: Verify we can create entries for 2025 dates
    console.log('\n3️⃣ Testing fiscal year validation for 2025-12-31...');
    const { checkFiscalYearForDate } = await import('../middleware/fiscalYearCheck.js');
    const check = await checkFiscalYearForDate('2025-12-31');
    
    if (!check.canCreate) {
      throw new Error(`Cannot create entries for 2025-12-31: ${check.reason}`);
    }
    console.log(`   ✅ Can create entries for 2025-12-31 (Year: ${check.fiscalYear.year}, Status: ${check.fiscalYear.status}, Temp Open: ${check.fiscalYear.temporary_open})`);

    // Step 4: Create a test journal entry for 2025
    console.log('\n4️⃣ Creating test journal entry for 2025-12-31...');
    await client.query('BEGIN');

    // Get next entry number
    const { rows: maxEntry } = await client.query(`
      SELECT COALESCE(MAX(entry_number), 0) + 1 as next_num FROM journal_entries
    `);
    const entryNumber = maxEntry[0].next_num;

    // Create entry
    const { rows: entryRows } = await client.query(`
      INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [
      entryNumber,
      'قيد تجريبي - أرصدة مرحلة من 2025',
      '2025-12-31',
      '2025-12',
      'opening',
      null,
      'posted'
    ]);

    const entryId = entryRows[0].id;
    console.log(`   ✅ Created journal entry #${entryNumber} (ID: ${entryId})`);

    // Create test postings (balanced)
    // Get first two accounts for balanced entry
    const { rows: accounts } = await client.query(`
      SELECT id FROM accounts ORDER BY id LIMIT 2
    `);
    
    if (!accounts || accounts.length < 2) {
      throw new Error('Need at least 2 accounts for balanced entry');
    }
    
    const account1Id = accounts[0].id;
    const account2Id = accounts[1].id;
    
    await client.query(`
      INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
      VALUES ($1, $2, $3, 0)
    `, [entryId, account1Id, 1000.00]);

    await client.query(`
      INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
      VALUES ($1, $2, 0, $3)
    `, [entryId, account2Id, 1000.00]);

    await client.query('COMMIT');
    console.log('   ✅ Created balanced postings');

    // Step 5: Verify entry appears when filtering by 2025 date range
    console.log('\n5️⃣ Verifying entry appears in 2025 date range...');
    const { rows: entries2025 } = await client.query(`
      SELECT je.*, 
             COALESCE(SUM(jp.debit), 0) as total_debit,
             COALESCE(SUM(jp.credit), 0) as total_credit
      FROM journal_entries je
      LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE je.date BETWEEN '2025-01-01' AND '2025-12-31'
        AND je.status = 'posted'
      GROUP BY je.id
      ORDER BY je.date DESC
    `);

    const foundEntry = entries2025.find(e => e.id === entryId);
    if (!foundEntry) {
      throw new Error('Entry not found when filtering by 2025 date range');
    }
    console.log(`   ✅ Entry found in 2025 range (Total entries: ${entries2025.length})`);

    // Step 6: Verify entry does NOT appear in 2026 date range
    console.log('\n6️⃣ Verifying entry does NOT appear in 2026 date range...');
    const { rows: entries2026 } = await client.query(`
      SELECT je.*
      FROM journal_entries je
      WHERE je.date BETWEEN '2026-01-01' AND '2026-12-31'
        AND je.status = 'posted'
    `);

    const foundIn2026 = entries2026.find(e => e.id === entryId);
    if (foundIn2026) {
      throw new Error('Entry incorrectly appears in 2026 range');
    }
    console.log(`   ✅ Entry correctly excluded from 2026 range`);

    // Step 7: Close temporary opening
    console.log('\n7️⃣ Closing temporary opening...');
    await client.query(`
      UPDATE fiscal_years
      SET 
        temporary_open = FALSE,
        updated_at = NOW()
      WHERE id = $1
    `, [fiscalYear2025.id]);
    console.log('   ✅ Temporary opening closed');

    // Step 8: Verify we can no longer create entries for 2025
    console.log('\n8️⃣ Verifying entries can no longer be created for 2025...');
    const checkAfterClose = await checkFiscalYearForDate('2025-12-31');
    if (checkAfterClose.canCreate) {
      throw new Error('Should not be able to create entries after closing temporary opening');
    }
    console.log(`   ✅ Correctly prevents entry creation: ${checkAfterClose.reason}`);

    // Step 9: Verify entry still appears in lists (it should, based on date)
    console.log('\n9️⃣ Verifying entry still appears in date-filtered lists...');
    const { rows: entriesStillVisible } = await client.query(`
      SELECT je.*
      FROM journal_entries je
      WHERE je.date BETWEEN '2025-01-01' AND '2025-12-31'
        AND je.status = 'posted'
    `);

    const stillFound = entriesStillVisible.find(e => e.id === entryId);
    if (!stillFound) {
      throw new Error('Entry should still be visible in date-filtered lists');
    }
    console.log(`   ✅ Entry still visible in date-filtered lists`);

    // Cleanup: Delete test entry
    console.log('\n🧹 Cleaning up test entry...');
    await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [entryId]);
    await client.query('DELETE FROM journal_entries WHERE id = $1', [entryId]);
    console.log('   ✅ Test entry deleted');

    console.log('\n✅ All tests passed! Fiscal year workflow is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   ✅ Can temporarily open past fiscal year');
    console.log('   ✅ Can create journal entries in temporarily opened year');
    console.log('   ✅ Entries appear in correct year when filtering by date');
    console.log('   ✅ Entries do NOT appear in wrong year');
    console.log('   ✅ Cannot create entries after closing temporary opening');
    console.log('   ✅ Existing entries remain visible after closing');

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Test failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  testFiscalYearWorkflow()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch(e => {
      console.error('\n❌ Test failed:', e);
      process.exit(1);
    });
}

export { testFiscalYearWorkflow };
