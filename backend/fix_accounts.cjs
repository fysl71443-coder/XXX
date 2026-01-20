const { Client } = require('pg');
require('dotenv').config();

// Database connection string
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ خطأ: يجب توفير DATABASE_URL');
  console.error('❌ Error: DATABASE_URL is required');
  console.error('   Usage: node fix_accounts.cjs');
  console.error('   Or: DATABASE_URL="..." node fix_accounts.cjs');
  process.exit(1);
}

// الحسابات المطلوبة مع معلوماتها الكاملة
// Required accounts with full information
const requiredAccounts = [
  // الحسابات الرئيسية (Parent Accounts)
  { account_number: '0001', name: 'الأصول', name_en: 'Assets', type: 'asset', nature: 'debit', parent_number: null },
  { account_number: '0002', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', nature: 'credit', parent_number: null },
  { account_number: '0004', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', nature: 'credit', parent_number: null },
  { account_number: '1100', name: 'أصول متداولة', name_en: 'Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
  { account_number: '1110', name: 'النقد وما في حكمه', name_en: 'Cash and Cash Equivalents', type: 'cash', nature: 'debit', parent_number: '1100' },
  { account_number: '1120', name: 'بنوك', name_en: 'Banks', type: 'bank', nature: 'debit', parent_number: '1100' },
  { account_number: '2100', name: 'التزامات متداولة', name_en: 'Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
  { account_number: '2140', name: 'ضرائب مستحقة', name_en: 'Tax Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '4100', name: 'الإيرادات التشغيلية حسب الفرع', name_en: 'Operating Revenue by Branch', type: 'revenue', nature: 'credit', parent_number: '0004' },
  
  // الحسابات المطلوبة (Required Accounts)
  { account_number: '1111', name: 'صندوق رئيسي', name_en: 'Main Cash', type: 'cash', nature: 'debit', parent_number: '1110' },
  { account_number: '1121', name: 'بنك الراجحي', name_en: 'Al Rajhi Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '4111', name: 'مبيعات نقدية – China Town', name_en: 'Cash Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4112', name: 'مبيعات آجلة – China Town', name_en: 'Credit Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4121', name: 'مبيعات نقدية – Place India', name_en: 'Cash Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4122', name: 'مبيعات آجلة – Place India', name_en: 'Credit Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '2141', name: 'ضريبة القيمة المضافة – مستحقة', name_en: 'VAT Output', type: 'liability', nature: 'credit', parent_number: '2140' },
];

async function ensureAccount(client, account, accountIdByNumber) {
  const { account_number, name, name_en, type, nature, parent_number } = account;
  
  // Get parent ID if parent_number exists
  const parentId = parent_number ? accountIdByNumber[parent_number] : null;
  
  // Check if account exists
  const { rows: existing } = await client.query(
    'SELECT id, name, name_en FROM accounts WHERE account_number = $1',
    [account_number]
  );
  
  if (existing && existing.length > 0) {
    const existingAccount = existing[0];
    console.log(`✅ موجود: ${account_number} - ${name} (ID: ${existingAccount.id})`);
    accountIdByNumber[account_number] = existingAccount.id;
    return { created: false, id: existingAccount.id };
  }
  
  // Create account
  try {
    const { rows } = await client.query(
      `INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [account_number, account_number, name, name_en, type, nature, parentId, 0, true]
    );
    
    if (rows && rows[0]) {
      const newId = rows[0].id;
      accountIdByNumber[account_number] = newId;
      console.log(`✅ تم الإنشاء: ${account_number} - ${name} (ID: ${newId})`);
      return { created: true, id: newId };
    }
  } catch (error) {
    console.error(`❌ خطأ في إنشاء ${account_number}:`, error.message);
    return { created: false, error: error.message };
  }
}

async function run() {
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    console.log('✅ Connected to database\n');
    
    const accountIdByNumber = {};
    const results = {
      created: [],
      existing: [],
      errors: []
    };
    
    // Process accounts in order (parents first)
    console.log('📋 بدء إضافة الحسابات...\n');
    console.log('📋 Starting to add accounts...\n');
    
    for (const account of requiredAccounts) {
      const result = await ensureAccount(client, account, accountIdByNumber);
      
      if (result.error) {
        results.errors.push({ account: account.account_number, error: result.error });
      } else if (result.created) {
        results.created.push(account.account_number);
      } else {
        results.existing.push(account.account_number);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 تقرير النتائج / Results Summary');
    console.log('='.repeat(60));
    console.log(`✅ تم إنشاؤها: ${results.created.length} حساب`);
    console.log(`✅ Created: ${results.created.length} accounts`);
    if (results.created.length > 0) {
      console.log(`   ${results.created.join(', ')}`);
    }
    
    console.log(`\nℹ️  موجودة مسبقاً: ${results.existing.length} حساب`);
    console.log(`ℹ️  Already existed: ${results.existing.length} accounts`);
    if (results.existing.length > 0) {
      console.log(`   ${results.existing.join(', ')}`);
    }
    
    if (results.errors.length > 0) {
      console.log(`\n❌ أخطاء: ${results.errors.length} خطأ`);
      console.log(`❌ Errors: ${results.errors.length} errors`);
      results.errors.forEach(err => {
        console.log(`   ${err.account}: ${err.error}`);
      });
    }
    
    // Verify required accounts
    console.log('\n' + '='.repeat(60));
    console.log('🔍 التحقق من الحسابات المطلوبة');
    console.log('🔍 Verifying Required Accounts');
    console.log('='.repeat(60));
    
    const { rows: verification } = await client.query(
      `SELECT account_number, account_code, name, name_en, type 
       FROM accounts 
       WHERE account_number IN ('1111', '1121', '4111', '4112', '4121', '4122', '2141')
       ORDER BY account_number`
    );
    
    const requiredNumbers = ['1111', '1121', '4111', '4112', '4121', '4122', '2141'];
    const foundNumbers = verification.map(r => r.account_number);
    const missingNumbers = requiredNumbers.filter(n => !foundNumbers.includes(n));
    
    if (verification.length > 0) {
      console.log('\n✅ الحسابات الموجودة:');
      console.log('✅ Found Accounts:');
      verification.forEach(acc => {
        console.log(`   ${acc.account_number} - ${acc.name} (${acc.name_en})`);
      });
    }
    
    if (missingNumbers.length > 0) {
      console.log('\n❌ الحسابات المفقودة:');
      console.log('❌ Missing Accounts:');
      missingNumbers.forEach(num => {
        console.log(`   ${num}`);
      });
    } else {
      console.log('\n✅ جميع الحسابات المطلوبة موجودة!');
      console.log('✅ All required accounts are present!');
    }
    
    console.log('\n✅ اكتمل التنفيذ بنجاح!');
    console.log('✅ Execution completed successfully!');
    
  } catch (error) {
    console.error('❌ خطأ عام:', error);
    console.error('❌ General error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
