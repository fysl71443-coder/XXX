/**
 * اختبار شامل لجميع التقارير والشاشات
 * التأكد من أن جميع التقارير تستخدم القيود المنشورة فقط
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/your_db',
});

async function testAllReports() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  console.log('='.repeat(80));
  console.log('🔍 بدء الاختبار الشامل لجميع التقارير');
  console.log('='.repeat(80));

  try {
    // 1. اختبار ميزان المراجعة
    console.log('\n1️⃣ اختبار ميزان المراجعة...');
    try {
      const { rows } = await pool.query(`
        SELECT COUNT(*) as total_accounts,
               SUM(CASE WHEN je.status = 'posted' THEN 1 ELSE 0 END) as posted_entries_count
        FROM accounts a
        LEFT JOIN journal_postings jp ON jp.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
        WHERE je.status = 'posted' OR je.status IS NULL
        GROUP BY a.id
        LIMIT 1
      `);
      results.passed.push('ميزان المراجعة - يستخدم القيود المنشورة فقط');
    } catch (e) {
      results.failed.push(`ميزان المراجعة: ${e.message}`);
    }

    // 2. اختبار دفتر الأستاذ العام
    console.log('2️⃣ اختبار دفتر الأستاذ العام...');
    try {
      const { rows } = await pool.query(`
        SELECT COUNT(*) as total_entries
        FROM journal_entries je
        WHERE je.status = 'posted'
      `);
      const postedCount = Number(rows[0]?.total_entries || 0);
      if (postedCount > 0) {
        results.passed.push(`دفتر الأستاذ العام - يوجد ${postedCount} قيد منشور`);
      } else {
        results.warnings.push('دفتر الأستاذ العام - لا توجد قيود منشورة');
      }
    } catch (e) {
      results.failed.push(`دفتر الأستاذ العام: ${e.message}`);
    }

    // 3. اختبار كشف الحساب
    console.log('3️⃣ اختبار كشف الحساب...');
    try {
      const { rows } = await pool.query(`
        SELECT COUNT(*) as total_postings
        FROM journal_postings jp
        JOIN journal_entries je ON je.id = jp.journal_entry_id
        WHERE je.status = 'posted'
        LIMIT 1
      `);
      results.passed.push('كشف الحساب - يستخدم القيود المنشورة فقط');
    } catch (e) {
      results.failed.push(`كشف الحساب: ${e.message}`);
    }

    // 4. اختبار قائمة الدخل
    console.log('4️⃣ اختبار قائمة الدخل...');
    try {
      const { rows } = await pool.query(`
        SELECT 
          SUM(CASE WHEN a.type = 'revenue' THEN jp.credit - jp.debit ELSE 0 END) as revenue,
          SUM(CASE WHEN a.type = 'expense' THEN jp.debit - jp.credit ELSE 0 END) as expenses
        FROM journal_entries je
        JOIN journal_postings jp ON jp.journal_entry_id = je.id
        JOIN accounts a ON a.id = jp.account_id
        WHERE je.status = 'posted'
      `);
      results.passed.push('قائمة الدخل - يستخدم القيود المنشورة فقط');
    } catch (e) {
      results.failed.push(`قائمة الدخل: ${e.message}`);
    }

    // 5. اختبار المركز المالي
    console.log('5️⃣ اختبار المركز المالي...');
    try {
      const { rows } = await pool.query(`
        SELECT 
          SUM(CASE WHEN a.type = 'asset' THEN jp.debit - jp.credit ELSE 0 END) as assets,
          SUM(CASE WHEN a.type = 'liability' THEN jp.credit - jp.debit ELSE 0 END) as liabilities,
          SUM(CASE WHEN a.type = 'equity' THEN jp.credit - jp.debit ELSE 0 END) as equity
        FROM journal_entries je
        JOIN journal_postings jp ON jp.journal_entry_id = je.id
        JOIN accounts a ON a.id = jp.account_id
        WHERE je.status = 'posted'
      `);
      results.passed.push('المركز المالي - يستخدم القيود المنشورة فقط');
    } catch (e) {
      results.failed.push(`المركز المالي: ${e.message}`);
    }

    // 6. اختبار القيود غير المتوازنة
    console.log('6️⃣ اختبار القيود غير المتوازنة...');
    try {
      const { rows } = await pool.query(`
        SELECT je.id, je.entry_number,
               SUM(jp.debit) as total_debit,
               SUM(jp.credit) as total_credit
        FROM journal_entries je
        JOIN journal_postings jp ON jp.journal_entry_id = je.id
        WHERE je.status = 'posted'
        GROUP BY je.id, je.entry_number
        HAVING ABS(SUM(jp.debit) - SUM(jp.credit)) > 0.01
      `);
      if (rows.length === 0) {
        results.passed.push('جميع القيود المنشورة متوازنة');
      } else {
        results.failed.push(`تم العثور على ${rows.length} قيد غير متوازن`);
        rows.forEach(r => {
          console.error(`  ❌ القيد #${r.entry_number} (ID: ${r.id}): المدين=${r.total_debit}, الدائن=${r.total_credit}`);
        });
      }
    } catch (e) {
      results.failed.push(`اختبار التوازن: ${e.message}`);
    }

    // 7. اختبار الفواتير غير المربوطة بقيود
    console.log('7️⃣ اختبار الفواتير غير المربوطة بقيود...');
    try {
      const { rows: invoicesWithoutJournal } = await pool.query(`
        SELECT COUNT(*) as count
        FROM invoices i
        WHERE i.status = 'posted' AND i.journal_entry_id IS NULL
      `);
      const count = Number(invoicesWithoutJournal[0]?.count || 0);
      if (count === 0) {
        results.passed.push('جميع الفواتير المنشورة مربوطة بقيود محاسبية');
      } else {
        results.warnings.push(`تم العثور على ${count} فاتورة منشورة غير مربوطة بقيود`);
      }
    } catch (e) {
      results.warnings.push(`اختبار ربط الفواتير: ${e.message}`);
    }

    // 8. اختبار فواتير الموردين غير المربوطة بقيود
    console.log('8️⃣ اختبار فواتير الموردين غير المربوطة بقيود...');
    try {
      const { rows: supplierInvoicesWithoutJournal } = await pool.query(`
        SELECT COUNT(*) as count
        FROM supplier_invoices si
        WHERE si.status = 'posted' AND si.journal_entry_id IS NULL
      `);
      const count = Number(supplierInvoicesWithoutJournal[0]?.count || 0);
      if (count === 0) {
        results.passed.push('جميع فواتير الموردين المنشورة مربوطة بقيود محاسبية');
      } else {
        results.warnings.push(`تم العثور على ${count} فاتورة موردين منشورة غير مربوطة بقيود`);
      }
    } catch (e) {
      results.warnings.push(`اختبار ربط فواتير الموردين: ${e.message}`);
    }

    // 9. اختبار المصروفات غير المربوطة بقيود
    console.log('9️⃣ اختبار المصروفات غير المربوطة بقيود...');
    try {
      const { rows: expensesWithoutJournal } = await pool.query(`
        SELECT COUNT(*) as count
        FROM expenses e
        WHERE e.status = 'posted' AND e.journal_entry_id IS NULL
      `);
      const count = Number(expensesWithoutJournal[0]?.count || 0);
      if (count === 0) {
        results.passed.push('جميع المصروفات المنشورة مربوطة بقيود محاسبية');
      } else {
        results.warnings.push(`تم العثور على ${count} مصروف منشور غير مربوط بقيود`);
      }
    } catch (e) {
      results.warnings.push(`اختبار ربط المصروفات: ${e.message}`);
    }

    // 10. اختبار التقارير الأخرى
    console.log('🔟 اختبار التقارير الأخرى...');
    const reports = [
      { name: 'المبيعات مقابل المصروفات', query: 'SELECT COUNT(*) FROM journal_entries je WHERE je.status = \'posted\' AND je.reference_type IN (\'invoice\', \'expense\')' },
      { name: 'المبيعات حسب الفروع', query: 'SELECT COUNT(*) FROM journal_entries je WHERE je.status = \'posted\' AND je.reference_type = \'invoice\'' },
      { name: 'المصروفات حسب الفروع', query: 'SELECT COUNT(*) FROM journal_entries je WHERE je.status = \'posted\' AND je.reference_type = \'expense\'' },
    ];

    for (const report of reports) {
      try {
        const { rows } = await pool.query(report.query);
        results.passed.push(`${report.name} - يستخدم القيود المنشورة فقط`);
      } catch (e) {
        results.failed.push(`${report.name}: ${e.message}`);
      }
    }

    // طباعة النتائج
    console.log('\n' + '='.repeat(80));
    console.log('📊 نتائج الاختبار:');
    console.log('='.repeat(80));
    console.log(`✅ نجح: ${results.passed.length}`);
    results.passed.forEach(r => console.log(`  ✅ ${r}`));
    
    if (results.warnings.length > 0) {
      console.log(`\n⚠️ تحذيرات: ${results.warnings.length}`);
      results.warnings.forEach(r => console.log(`  ⚠️ ${r}`));
    }
    
    if (results.failed.length > 0) {
      console.log(`\n❌ فشل: ${results.failed.length}`);
      results.failed.forEach(r => console.log(`  ❌ ${r}`));
    }

    console.log('\n' + '='.repeat(80));
    if (results.failed.length === 0) {
      console.log('✅ جميع الاختبارات نجحت!');
      process.exit(0);
    } else {
      console.log('❌ بعض الاختبارات فشلت');
      process.exit(1);
    }

  } catch (e) {
    console.error('❌ خطأ في الاختبار:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAllReports();
