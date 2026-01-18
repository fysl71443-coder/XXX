#!/usr/bin/env node
/**
 * سكريبت للتحقق من سلامة Foreign Keys والبيانات
 * 
 * يتحقق من:
 * - Foreign Keys integrity
 * - Orphaned records
 * - Missing relationships
 * - Data consistency
 * 
 * الاستخدام:
 *   node backend/scripts/check-integrity.js
 */

import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// Check Functions
// ============================================

async function checkExpenseJournalLinks() {
  console.log('\n🔍 التحقق من ربط المصروفات بالقيود...');
  
  const result = await pool.query(`
    SELECT 
      e.id,
      e.description,
      e.status,
      e.journal_entry_id,
      CASE 
        WHEN e.journal_entry_id IS NULL THEN 'غير مربوط'
        WHEN je.id IS NULL THEN 'قيد غير موجود'
        ELSE 'مربوط'
      END AS link_status
    FROM expenses e
    LEFT JOIN journal_entries je ON je.id = e.journal_entry_id
    WHERE e.status = 'posted'
    ORDER BY e.id
  `);
  
  const broken = result.rows.filter(r => r.link_status !== 'مربوط');
  const linked = result.rows.filter(r => r.link_status === 'مربوط');
  
  console.log(`   ✅ مصروفات مربوطة: ${linked.length}`);
  console.log(`   ⚠️ مصروفات غير مربوطة: ${broken.length}`);
  
  if (broken.length > 0) {
    console.log('\n   ⚠️ المصروفات غير المربوطة:');
    broken.forEach(exp => {
      console.log(`      - #${exp.id}: ${exp.description} (${exp.link_status})`);
    });
  }
  
  return broken.length === 0;
}

async function checkInvoiceJournalLinks() {
  console.log('\n🔍 التحقق من ربط الفواتير بالقيود...');
  
  const result = await pool.query(`
    SELECT 
      i.id,
      i.number,
      i.status,
      i.journal_entry_id,
      CASE 
        WHEN i.journal_entry_id IS NULL THEN 'غير مربوط'
        WHEN je.id IS NULL THEN 'قيد غير موجود'
        ELSE 'مربوط'
      END AS link_status
    FROM invoices i
    LEFT JOIN journal_entries je ON je.id = i.journal_entry_id
    WHERE i.status = 'posted'
    ORDER BY i.id
  `);
  
  const broken = result.rows.filter(r => r.link_status !== 'مربوط');
  const linked = result.rows.filter(r => r.link_status === 'مربوط');
  
  console.log(`   ✅ فواتير مربوطة: ${linked.length}`);
  console.log(`   ⚠️ فواتير غير مربوطة: ${broken.length}`);
  
  if (broken.length > 0) {
    console.log('\n   ⚠️ الفواتير غير المربوطة:');
    broken.forEach(inv => {
      console.log(`      - #${inv.id}: ${inv.number} (${inv.link_status})`);
    });
  }
  
  return broken.length === 0;
}

async function checkJournalPostings() {
  console.log('\n🔍 التحقق من سطور القيود...');
  
  const result = await pool.query(`
    SELECT 
      jp.id,
      jp.journal_entry_id,
      jp.account_id,
      CASE 
        WHEN je.id IS NULL THEN 'قيد غير موجود'
        WHEN a.id IS NULL THEN 'حساب غير موجود'
        ELSE 'صحيح'
      END AS status
    FROM journal_postings jp
    LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
    LEFT JOIN accounts a ON a.id = jp.account_id
    WHERE je.id IS NULL OR a.id IS NULL
    LIMIT 10
  `);
  
  if (result.rows.length === 0) {
    console.log('   ✅ جميع سطور القيود صحيحة');
    return true;
  } else {
    console.log(`   ❌ وجدت ${result.rows.length} سطر غير صحيح`);
    return false;
  }
}

async function checkJournalBalance() {
  console.log('\n🔍 التحقق من توازن القيود (المدين = الدائن)...');
  
  const result = await pool.query(`
    SELECT 
      je.id,
      je.entry_number,
      je.description,
      SUM(jp.debit) AS total_debit,
      SUM(jp.credit) AS total_credit,
      SUM(jp.debit) - SUM(jp.credit) AS balance
    FROM journal_entries je
    LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
    WHERE je.status = 'posted'
    GROUP BY je.id, je.entry_number, je.description
    HAVING ABS(SUM(jp.debit) - SUM(jp.credit)) > 0.01
  `);
  
  if (result.rows.length === 0) {
    console.log('   ✅ جميع القيود متوازنة');
    return true;
  } else {
    console.log(`   ❌ وجدت ${result.rows.length} قيد غير متوازن:`);
    result.rows.forEach(row => {
      console.log(`      - قيد #${row.id}: المدين=${row.total_debit}, الدائن=${row.total_credit}, الفرق=${row.balance}`);
    });
    return false;
  }
}

async function checkOrphanedRecords() {
  console.log('\n🔍 التحقق من السجلات المفقودة (Orphaned)...');
  
  // Check expenses with invalid journal_entry_id
  const orphanedExpenses = await pool.query(`
    SELECT COUNT(*) as count
    FROM expenses
    WHERE journal_entry_id IS NOT NULL
      AND journal_entry_id NOT IN (SELECT id FROM journal_entries)
  `);
  
  // Check invoices with invalid journal_entry_id
  const orphanedInvoices = await pool.query(`
    SELECT COUNT(*) as count
    FROM invoices
    WHERE journal_entry_id IS NOT NULL
      AND journal_entry_id NOT IN (SELECT id FROM journal_entries)
  `);
  
  const expCount = parseInt(orphanedExpenses.rows[0].count);
  const invCount = parseInt(orphanedInvoices.rows[0].count);
  
  if (expCount === 0 && invCount === 0) {
    console.log('   ✅ لا توجد سجلات مفقودة');
    return true;
  } else {
    console.log(`   ⚠️ وجدت ${expCount} مصروف و ${invCount} فاتورة بروابط غير صحيحة`);
    return false;
  }
}

// ============================================
// Main Check Function
// ============================================

async function runAllChecks() {
  console.log('🔍 بدء التحقق من سلامة قاعدة البيانات...');
  console.log('='.repeat(60));
  
  const results = {
    expenseLinks: await checkExpenseJournalLinks(),
    invoiceLinks: await checkInvoiceJournalLinks(),
    journalPostings: await checkJournalPostings(),
    journalBalance: await checkJournalBalance(),
    orphanedRecords: await checkOrphanedRecords()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ملخص النتائج:');
  console.log('='.repeat(60));
  console.log(`   ربط المصروفات: ${results.expenseLinks ? '✅' : '❌'}`);
  console.log(`   ربط الفواتير: ${results.invoiceLinks ? '✅' : '❌'}`);
  console.log(`   سطور القيود: ${results.journalPostings ? '✅' : '❌'}`);
  console.log(`   توازن القيود: ${results.journalBalance ? '✅' : '❌'}`);
  console.log(`   السجلات المفقودة: ${results.orphanedRecords ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n✅✅ جميع الفحوصات نجحت!');
  } else {
    console.log('\n⚠️ بعض الفحوصات فشلت - راجع التفاصيل أعلاه');
  }
  
  return allPassed;
}

// Run checks
runAllChecks()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ خطأ في الفحص:', error.message);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
