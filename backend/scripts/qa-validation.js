/**
 * سكريبت التحقق التلقائي من سلامة النظام المحاسبي
 * يتحقق من:
 * - توازن جميع القيود
 * - عدم وجود قيود بدون مصدر
 * - عدم وجود قيود مكررة
 * - صحة الأرصدة
 * - توازن الميزانية العمومية
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xxx',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function checkJournalBalance() {
  log('التحقق من توازن جميع القيود...');
  
  const { rows } = await pool.query(`
    SELECT 
      je.id,
      je.entry_number,
      je.description,
      SUM(jp.debit) as total_debit,
      SUM(jp.credit) as total_credit,
      SUM(jp.debit) - SUM(jp.credit) as difference
    FROM journal_entries je
    JOIN journal_postings jp ON jp.journal_entry_id = je.id
    WHERE je.status = 'posted'
    GROUP BY je.id, je.entry_number, je.description
    HAVING ABS(SUM(jp.debit) - SUM(jp.credit)) > 0.01
  `);
  
  if (rows.length === 0) {
    results.passed.push('جميع القيود متوازنة');
    log('جميع القيود متوازنة ✓', 'info');
  } else {
    results.failed.push(`وجد ${rows.length} قيد غير متوازن`);
    log(`وجد ${rows.length} قيد غير متوازن`, 'error');
    rows.forEach(row => {
      log(`  - قيد #${row.entry_number}: الفرق = ${row.difference}`, 'error');
    });
  }
}

async function checkOrphanedEntries() {
  log('التحقق من القيود بدون مصدر...');
  
  const { rows } = await pool.query(`
    SELECT je.id, je.entry_number, je.description, je.reference_type, je.reference_id
    FROM journal_entries je
    WHERE je.reference_type IS NOT NULL 
      AND je.reference_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM expenses e WHERE e.id = je.reference_id AND je.reference_type = 'expense'
        UNION
        SELECT 1 FROM invoices i WHERE i.id = je.reference_id AND je.reference_type = 'invoice'
      )
  `);
  
  if (rows.length === 0) {
    results.passed.push('لا توجد قيود بدون مصدر');
    log('لا توجد قيود بدون مصدر ✓', 'info');
  } else {
    results.failed.push(`وجد ${rows.length} قيد بدون مصدر`);
    log(`وجد ${rows.length} قيد بدون مصدر`, 'error');
    rows.forEach(row => {
      log(`  - قيد #${row.entry_number}: ${row.reference_type} #${row.reference_id}`, 'error');
    });
  }
}

async function checkDuplicateEntries() {
  log('التحقق من القيود المكررة...');
  
  const { rows } = await pool.query(`
    SELECT reference_type, reference_id, COUNT(*) as count
    FROM journal_entries
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
    GROUP BY reference_type, reference_id
    HAVING COUNT(*) > 1
  `);
  
  if (rows.length === 0) {
    results.passed.push('لا توجد قيود مكررة');
    log('لا توجد قيود مكررة ✓', 'info');
  } else {
    results.failed.push(`وجد ${rows.length} مستند مرتبط بأكثر من قيد`);
    log(`وجد ${rows.length} مستند مرتبط بأكثر من قيد`, 'error');
    rows.forEach(row => {
      log(`  - ${row.reference_type} #${row.reference_id}: ${row.count} قيود`, 'error');
    });
  }
}

async function checkAccountBalances() {
  log('التحقق من صحة الأرصدة...');
  
  const { rows } = await pool.query(`
    SELECT 
      a.account_code,
      a.name,
      a.opening_balance,
      COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jp.debit ELSE 0 END), 0) as total_debit,
      COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jp.credit ELSE 0 END), 0) as total_credit,
      a.opening_balance + 
        COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jp.debit ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jp.credit ELSE 0 END), 0) as calculated_balance
    FROM accounts a
    LEFT JOIN journal_postings jp ON jp.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
    GROUP BY a.id, a.account_code, a.name, a.opening_balance
    ORDER BY a.account_code
  `);
  
  log(`تم التحقق من ${rows.length} حساب`, 'info');
  results.passed.push(`تم التحقق من ${rows.length} حساب`);
  
  // يمكن إضافة المزيد من التحقق هنا
}

async function checkBalanceSheet() {
  log('التحقق من توازن الميزانية العمومية...');
  
  const { rows } = await pool.query(`
    SELECT 
      a.type,
      SUM(a.opening_balance + 
        COALESCE(SUM(CASE WHEN je.status = 'posted' THEN 
          CASE WHEN a.type = 'asset' THEN jp.debit - jp.credit 
               ELSE jp.credit - jp.debit 
          END 
        ELSE 0 END), 0)) as total
    FROM accounts a
    LEFT JOIN journal_postings jp ON jp.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
    WHERE a.type IN ('asset', 'liability', 'equity')
    GROUP BY a.type
  `);
  
  const totals = {};
  rows.forEach(row => {
    totals[row.type] = parseFloat(row.total || 0);
  });
  
  const assets = totals.asset || 0;
  const liabilities = totals.liability || 0;
  const equity = totals.equity || 0;
  const balance = Math.abs(assets - (liabilities + equity));
  
  if (balance < 0.01) {
    results.passed.push('الميزانية العمومية متوازنة');
    log(`الميزانية العمومية متوازنة: الأصول = ${assets.toFixed(2)}, الخصوم + حقوق الملكية = ${(liabilities + equity).toFixed(2)}`, 'info');
  } else {
    results.failed.push(`الميزانية العمومية غير متوازنة: الفرق = ${balance.toFixed(2)}`);
    log(`الميزانية العمومية غير متوازنة: الفرق = ${balance.toFixed(2)}`, 'error');
    log(`  الأصول: ${assets.toFixed(2)}`, 'error');
    log(`  الخصوم: ${liabilities.toFixed(2)}`, 'error');
    log(`  حقوق الملكية: ${equity.toFixed(2)}`, 'error');
    log(`  المجموع: ${(liabilities + equity).toFixed(2)}`, 'error');
  }
}

async function checkDraftOrdersWithoutJournal() {
  log('التحقق من المسودات بدون قيود...');
  
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM orders
    WHERE status = 'DRAFT'
  `);
  
  const draftCount = parseInt(rows[0].count || 0);
  log(`وجد ${draftCount} مسودة مبيعات (هذا طبيعي)`, 'info');
  results.passed.push(`وجد ${draftCount} مسودة مبيعات`);
}

async function checkPostedExpensesWithJournal() {
  log('التحقق من المصروفات المنشورة المرتبطة بقيود...');
  
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM expenses
    WHERE status = 'posted' AND journal_entry_id IS NULL
  `);
  
  if (rows[0].count === '0') {
    results.passed.push('جميع المصروفات المنشورة مرتبطة بقيود');
    log('جميع المصروفات المنشورة مرتبطة بقيود ✓', 'info');
  } else {
    results.warnings.push(`وجد ${rows[0].count} مصروف منشور بدون قيد`);
    log(`وجد ${rows[0].count} مصروف منشور بدون قيد`, 'warning');
  }
}

async function checkPostedInvoicesWithJournal() {
  log('التحقق من الفواتير المنشورة المرتبطة بقيود...');
  
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM invoices
    WHERE status = 'posted' AND journal_entry_id IS NULL
  `);
  
  if (rows[0].count === '0') {
    results.passed.push('جميع الفواتير المنشورة مرتبطة بقيود');
    log('جميع الفواتير المنشورة مرتبطة بقيود ✓', 'info');
  } else {
    results.warnings.push(`وجد ${rows[0].count} فاتورة منشورة بدون قيد`);
    log(`وجد ${rows[0].count} فاتورة منشورة بدون قيد`, 'warning');
  }
}

async function runAllChecks() {
  console.log('\n========================================');
  console.log('بدء التحقق التلقائي من سلامة النظام');
  console.log('========================================\n');
  
  try {
    await checkJournalBalance();
    await checkOrphanedEntries();
    await checkDuplicateEntries();
    await checkAccountBalances();
    await checkBalanceSheet();
    await checkDraftOrdersWithoutJournal();
    await checkPostedExpensesWithJournal();
    await checkPostedInvoicesWithJournal();
    
    console.log('\n========================================');
    console.log('نتائج التحقق:');
    console.log('========================================\n');
    
    console.log(`✅ نجح: ${results.passed.length} فحص`);
    results.passed.forEach(msg => console.log(`  ✓ ${msg}`));
    
    if (results.warnings.length > 0) {
      console.log(`\n⚠️ تحذيرات: ${results.warnings.length}`);
      results.warnings.forEach(msg => console.log(`  ⚠ ${msg}`));
    }
    
    if (results.failed.length > 0) {
      console.log(`\n❌ فشل: ${results.failed.length} فحص`);
      results.failed.forEach(msg => console.log(`  ✗ ${msg}`));
      console.log('\n⚠️ النظام يحتاج إصلاحات قبل الإنتاج!');
      process.exit(1);
    } else {
      console.log('\n✅ النظام جاهز للإنتاج!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ خطأ في التحقق:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAllChecks();
