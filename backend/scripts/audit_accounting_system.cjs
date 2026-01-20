/**
 * مراجعة شاملة للنظام المحاسبي
 * يتحقق من:
 * 1. توازن جميع القيود المنشورة
 * 2. عدم وجود قيود غير متوازنة
 * 3. أن جميع التقارير تعتمد على القيود فقط
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load .env
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch (e) {}

async function auditAccountingSystem() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) {
    console.error('❌ DATABASE_URL required');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. التحقق من توازن جميع القيود المنشورة
    console.log('🔍 1. التحقق من توازن القيود المنشورة...\n');
    const balanceCheck = await client.query(`
      SELECT 
        je.id,
        je.entry_number,
        je.date,
        je.description,
        je.status,
        COALESCE(SUM(jp.debit), 0) as total_debit,
        COALESCE(SUM(jp.credit), 0) as total_credit,
        ABS(COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0)) as difference
      FROM journal_entries je
      LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE je.status = 'posted'
      GROUP BY je.id, je.entry_number, je.date, je.description, je.status
      HAVING ABS(COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0)) > 0.01
      ORDER BY je.date DESC, je.entry_number DESC
    `);

    if (balanceCheck.rows.length > 0) {
      console.log(`❌ وجد ${balanceCheck.rows.length} قيد غير متوازن:\n`);
      balanceCheck.rows.forEach(row => {
        console.log(`  ❌ القيد #${row.entry_number} (ID: ${row.id})`);
        console.log(`     التاريخ: ${row.date}`);
        console.log(`     الوصف: ${row.description}`);
        console.log(`     المدين: ${Number(row.total_debit).toFixed(2)}`);
        console.log(`     الدائن: ${Number(row.total_credit).toFixed(2)}`);
        console.log(`     الفرق: ${Number(row.difference).toFixed(2)}\n`);
      });
    } else {
      console.log('✅ جميع القيود المنشورة متوازنة\n');
    }

    // 2. إحصائيات القيود
    const stats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'posted') as posted_count,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) as total_count
      FROM journal_entries
    `);
    console.log('📊 إحصائيات القيود:');
    console.log(`   إجمالي القيود: ${stats.rows[0].total_count}`);
    console.log(`   القيود المنشورة: ${stats.rows[0].posted_count}`);
    console.log(`   القيود المسودة: ${stats.rows[0].draft_count}\n`);

    // 3. التحقق من ميزان المراجعة
    console.log('🔍 2. التحقق من ميزان المراجعة...\n');
    const trialBalance = await client.query(`
      WITH account_balances AS (
        SELECT 
          a.id,
          a.nature,
          COALESCE(a.opening_balance, 0) as opening_balance,
          COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jp.debit ELSE 0 END), 0) as total_debit,
          COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jp.credit ELSE 0 END), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_postings jp ON jp.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
        GROUP BY a.id, a.nature, a.opening_balance
      )
      SELECT 
        COALESCE(SUM(CASE WHEN nature = 'debit' THEN opening_balance + total_debit - total_credit ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(CASE WHEN nature = 'credit' THEN opening_balance + total_credit - total_debit ELSE 0 END), 0) as total_credit
      FROM account_balances
    `);

    const totalDebit = Number(trialBalance.rows[0]?.total_debit || 0);
    const totalCredit = Number(trialBalance.rows[0]?.total_credit || 0);
    const difference = Math.abs(totalDebit - totalCredit);

    console.log(`   إجمالي المدين: ${totalDebit.toFixed(2)}`);
    console.log(`   إجمالي الدائن: ${totalCredit.toFixed(2)}`);
    console.log(`   الفرق: ${difference.toFixed(2)}`);
    if (difference > 0.01) {
      console.log(`   ❌ ميزان المراجعة غير متوازن!\n`);
    } else {
      console.log(`   ✅ ميزان المراجعة متوازن\n`);
    }

    // 4. التحقق من ضريبة القيمة المضافة
    console.log('🔍 3. التحقق من ضريبة القيمة المضافة...\n');
    const vatCheck = await client.query(`
      SELECT 
        a.account_code,
        a.name,
        COALESCE(SUM(jp.debit), 0) as total_debit,
        COALESCE(SUM(jp.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_postings jp ON jp.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
      WHERE a.account_code IN ('1150', '2141')
      GROUP BY a.id, a.account_code, a.name
    `);

    console.log('   حسابات الضريبة:');
    vatCheck.rows.forEach(row => {
      const net = Number(row.account_code) === 1150 
        ? Number(row.total_debit) - Number(row.total_credit)
        : Number(row.total_credit) - Number(row.total_debit);
      console.log(`   [${row.account_code}] ${row.name}: ${net.toFixed(2)}`);
    });
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

auditAccountingSystem().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
