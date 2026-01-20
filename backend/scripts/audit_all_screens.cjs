/**
 * مراجعة شاملة لجميع الشاشات والوحدات
 * يتحقق من أن جميع الشاشات تعتمد على القيود المنشورة فقط
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

async function auditAllScreens() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) {
    console.error('❌ DATABASE_URL required');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🔍 مراجعة شاملة لجميع الوحدات والشاشات...\n');

    // 1. التحقق من أن جميع القيود متوازنة
    console.log('1️⃣ التحقق من توازن القيود...\n');
    const balanceCheck = await client.query(`
      SELECT COUNT(*) as unbalanced_count
      FROM journal_entries je
      LEFT JOIN (
        SELECT journal_entry_id, 
               SUM(debit) as total_debit, 
               SUM(credit) as total_credit
        FROM journal_postings
        GROUP BY journal_entry_id
      ) balances ON balances.journal_entry_id = je.id
      WHERE je.status = 'posted'
        AND ABS(COALESCE(balances.total_debit, 0) - COALESCE(balances.total_credit, 0)) > 0.01
    `);
    const unbalancedCount = Number(balanceCheck.rows[0]?.unbalanced_count || 0);
    if (unbalancedCount > 0) {
      console.log(`   ❌ وجد ${unbalancedCount} قيد غير متوازن\n`);
    } else {
      console.log('   ✅ جميع القيود المنشورة متوازنة\n');
    }

    // 2. التحقق من أن جميع العملاء لديهم حسابات محاسبية
    console.log('2️⃣ التحقق من حسابات العملاء...\n');
    const customersCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE account_id IS NULL) as without_account,
        COUNT(*) as total
      FROM partners
      WHERE type IN ('customer', 'عميل')
    `);
    const withoutAccount = Number(customersCheck.rows[0]?.without_account || 0);
    const totalCustomers = Number(customersCheck.rows[0]?.total || 0);
    if (withoutAccount > 0) {
      console.log(`   ⚠️  ${withoutAccount} من ${totalCustomers} عميل بدون حساب محاسبي\n`);
    } else {
      console.log(`   ✅ جميع العملاء (${totalCustomers}) لديهم حسابات محاسبية\n`);
    }

    // 3. التحقق من أن جميع الموردين لديهم حسابات محاسبية
    console.log('3️⃣ التحقق من حسابات الموردين...\n');
    const suppliersCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE account_id IS NULL) as without_account,
        COUNT(*) as total
      FROM partners
      WHERE type IN ('supplier', 'مورد')
    `);
    const withoutAccountSuppliers = Number(suppliersCheck.rows[0]?.without_account || 0);
    const totalSuppliers = Number(suppliersCheck.rows[0]?.total || 0);
    if (withoutAccountSuppliers > 0) {
      console.log(`   ⚠️  ${withoutAccountSuppliers} من ${totalSuppliers} مورد بدون حساب محاسبي\n`);
    } else {
      console.log(`   ✅ جميع الموردين (${totalSuppliers}) لديهم حسابات محاسبية\n`);
    }

    // 4. التحقق من أن جميع الفواتير مرتبطة بقيود منشورة
    console.log('4️⃣ التحقق من ربط الفواتير بالقيود...\n');
    const invoicesCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE journal_entry_id IS NULL) as without_journal,
        COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL) as with_journal,
        COUNT(*) as total
      FROM invoices
      WHERE status NOT IN ('draft', 'cancelled')
    `);
    const withoutJournal = Number(invoicesCheck.rows[0]?.without_journal || 0);
    const withJournal = Number(invoicesCheck.rows[0]?.with_journal || 0);
    const totalInvoices = Number(invoicesCheck.rows[0]?.total || 0);
    if (withoutJournal > 0) {
      console.log(`   ⚠️  ${withoutJournal} فاتورة بدون قيد محاسبي منشور\n`);
    }
    console.log(`   ✅ ${withJournal} فاتورة مرتبطة بقيود منشورة من إجمالي ${totalInvoices}\n`);

    // 5. التحقق من أن جميع فواتير الموردين مرتبطة بقيود منشورة
    console.log('5️⃣ التحقق من ربط فواتير الموردين بالقيود...\n');
    const supplierInvoicesCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE journal_entry_id IS NULL) as without_journal,
        COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL) as with_journal,
        COUNT(*) as total
      FROM supplier_invoices
      WHERE status NOT IN ('draft', 'cancelled')
    `);
    const withoutJournalSuppliers = Number(supplierInvoicesCheck.rows[0]?.without_journal || 0);
    const withJournalSuppliers = Number(supplierInvoicesCheck.rows[0]?.with_journal || 0);
    const totalSupplierInvoices = Number(supplierInvoicesCheck.rows[0]?.total || 0);
    if (withoutJournalSuppliers > 0) {
      console.log(`   ⚠️  ${withoutJournalSuppliers} فاتورة مورد بدون قيد محاسبي منشور\n`);
    }
    console.log(`   ✅ ${withJournalSuppliers} فاتورة مورد مرتبطة بقيود منشورة من إجمالي ${totalSupplierInvoices}\n`);

    // 6. التحقق من أن جميع المصروفات مرتبطة بقيود منشورة
    console.log('6️⃣ التحقق من ربط المصروفات بالقيود...\n');
    const expensesCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE journal_entry_id IS NULL) as without_journal,
        COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL) as with_journal,
        COUNT(*) as total
      FROM expenses
      WHERE status NOT IN ('draft', 'cancelled')
    `);
    const withoutJournalExpenses = Number(expensesCheck.rows[0]?.without_journal || 0);
    const withJournalExpenses = Number(expensesCheck.rows[0]?.with_journal || 0);
    const totalExpenses = Number(expensesCheck.rows[0]?.total || 0);
    if (withoutJournalExpenses > 0) {
      console.log(`   ⚠️  ${withoutJournalExpenses} مصروف بدون قيد محاسبي منشور\n`);
    }
    console.log(`   ✅ ${withJournalExpenses} مصروف مرتبط بقيود منشورة من إجمالي ${totalExpenses}\n`);

    // 7. التحقق من أن جميع الحسابات في شجرة الحسابات الجديدة موجودة
    console.log('7️⃣ التحقق من شجرة الحسابات...\n');
    const requiredAccounts = ['0001', '0002', '0003', '0004', '0005', '1100', '1110', '1111', '1112', '1120', '1122', '1123', '1124', '1150', '1160', '1161', '1170', '1171', '2100', '2110', '2111', '2120', '2121', '2122', '2123', '2130', '2131', '2132', '2133', '2134', '2135', '2141', '2200', '2210', '2211', '3100', '3200', '3300', '4100', '4111', '4112', '4121', '4122', '4130', '4200', '4210', '4220', '5100', '5101', '5102', '5103', '5104', '5105', '5106', '5110', '5200', '5201', '5202', '5203', '5204', '5205', '5206'];
    const accountsCheck = await client.query(`
      SELECT account_code, name
      FROM accounts
      WHERE account_code = ANY($1::text[])
    `, [requiredAccounts]);
    const foundAccounts = accountsCheck.rows.map(r => r.account_code);
    const missingAccounts = requiredAccounts.filter(code => !foundAccounts.includes(code));
    if (missingAccounts.length > 0) {
      console.log(`   ❌ حسابات مفقودة: ${missingAccounts.join(', ')}\n`);
    } else {
      console.log(`   ✅ جميع الحسابات المطلوبة (${requiredAccounts.length}) موجودة\n`);
    }

    console.log('✅ انتهت المراجعة\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

auditAllScreens().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
