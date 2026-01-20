/**
 * Debug Journal Entries
 * يفحص القيود المحاسبية الموجودة في قاعدة البيانات
 */

import { pool } from '../db.js';

async function debugJournalEntries() {
  console.log('🔍 Debugging Journal Entries...\n');

  try {
    // 1. فحص جميع القيود المحاسبية
    console.log('1️⃣ All Journal Entries:');
    const { rows: allEntries } = await pool.query(`
      SELECT 
        id,
        entry_number,
        date,
        description,
        status,
        reference_type,
        reference_id,
        branch,
        period
      FROM journal_entries
      ORDER BY date DESC, entry_number DESC
      LIMIT 20
    `);
    console.log(`Found ${allEntries.length} entries:\n`);
    allEntries.forEach(entry => {
      console.log(`  Entry #${entry.entry_number}:`);
      console.log(`    ID: ${entry.id}`);
      console.log(`    Date: ${entry.date}`);
      console.log(`    Status: ${entry.status}`);
      console.log(`    Reference Type: ${entry.reference_type}`);
      console.log(`    Reference ID: ${entry.reference_id}`);
      console.log(`    Branch: ${entry.branch || 'NULL'}`);
      console.log(`    Description: ${entry.description}`);
      console.log('');
    });

    // 2. فحص القيود المنشورة للفواتير
    console.log('\n2️⃣ Posted Invoice Entries:');
    const { rows: postedInvoices } = await pool.query(`
      SELECT 
        id,
        entry_number,
        date,
        description,
        status,
        reference_type,
        reference_id,
        branch
      FROM journal_entries
      WHERE status = 'posted'
        AND reference_type = 'invoice'
      ORDER BY date DESC
      LIMIT 10
    `);
    console.log(`Found ${postedInvoices.length} posted invoice entries:\n`);
    postedInvoices.forEach(entry => {
      console.log(`  Entry #${entry.entry_number} (Invoice #${entry.reference_id}):`);
      console.log(`    Date: ${entry.date}`);
      console.log(`    Branch: ${entry.branch || 'NULL'}`);
      console.log('');
    });

    // 3. فحص القيود في نطاق Business Day لـ 2026-01-19
    console.log('\n3️⃣ Journal Entries for Business Day 2026-01-19:');
    console.log('   Business Day: 2026-01-19 09:00:00 to 2026-01-20 02:00:00');
    const { rows: businessDayEntries } = await pool.query(`
      SELECT 
        id,
        entry_number,
        date,
        description,
        status,
        reference_type,
        reference_id,
        branch
      FROM journal_entries
      WHERE date >= ('2026-01-19'::date + INTERVAL '9 hours')
        AND date < ('2026-01-19'::date + INTERVAL '1 day 2 hours')
      ORDER BY date DESC
    `);
    console.log(`Found ${businessDayEntries.length} entries in business day range:\n`);
    businessDayEntries.forEach(entry => {
      console.log(`  Entry #${entry.entry_number}:`);
      console.log(`    Date: ${entry.date}`);
      console.log(`    Status: ${entry.status}`);
      console.log(`    Reference Type: ${entry.reference_type}`);
      console.log(`    Branch: ${entry.branch || 'NULL'}`);
      console.log('');
    });

    // 4. فحص القيود المنشورة للفواتير في نطاق Business Day
    console.log('\n4️⃣ Posted Invoice Entries for Business Day 2026-01-19:');
    const { rows: postedInBusinessDay } = await pool.query(`
      SELECT 
        id,
        entry_number,
        date,
        description,
        status,
        reference_type,
        reference_id,
        branch
      FROM journal_entries
      WHERE status = 'posted'
        AND reference_type = 'invoice'
        AND date >= ('2026-01-19'::date + INTERVAL '9 hours')
        AND date < ('2026-01-19'::date + INTERVAL '1 day 2 hours')
      ORDER BY date DESC
    `);
    console.log(`Found ${postedInBusinessDay.length} posted invoice entries:\n`);
    postedInBusinessDay.forEach(entry => {
      console.log(`  Entry #${entry.entry_number} (Invoice #${entry.reference_id}):`);
      console.log(`    Date: ${entry.date}`);
      console.log(`    Branch: ${entry.branch || 'NULL'}`);
      console.log('');
    });

    // 5. فحص Postings للقيود الموجودة
    console.log('\n5️⃣ Postings for Posted Invoice Entries:');
    const { rows: postings } = await pool.query(`
      SELECT 
        je.id as journal_entry_id,
        je.entry_number,
        je.date,
        je.branch,
        jp.account_id,
        a.account_code,
        a.account_number,
        a.name as account_name,
        jp.debit,
        jp.credit
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      JOIN accounts a ON a.id = jp.account_id
      WHERE je.status = 'posted'
        AND je.reference_type = 'invoice'
      ORDER BY je.date DESC, je.entry_number DESC
      LIMIT 30
    `);
    console.log(`Found ${postings.length} postings:\n`);
    const groupedByEntry = {};
    postings.forEach(p => {
      if (!groupedByEntry[p.journal_entry_id]) {
        groupedByEntry[p.journal_entry_id] = {
          entry_number: p.entry_number,
          date: p.date,
          branch: p.branch,
          postings: []
        };
      }
      groupedByEntry[p.journal_entry_id].postings.push({
        account_code: p.account_code,
        account_number: p.account_number,
        account_name: p.account_name,
        debit: p.debit,
        credit: p.credit
      });
    });
    Object.values(groupedByEntry).forEach(entry => {
      console.log(`  Entry #${entry.entry_number} (Date: ${entry.date}, Branch: ${entry.branch || 'NULL'}):`);
      entry.postings.forEach(p => {
        console.log(`    ${p.account_code || p.account_number || 'N/A'} (${p.account_name}): Debit: ${p.debit}, Credit: ${p.credit}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');

if (isMainModule || process.argv[1]?.includes('debug_journal_entries')) {
  debugJournalEntries()
    .then(() => {
      console.log('\n✅ Debug completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugJournalEntries };
