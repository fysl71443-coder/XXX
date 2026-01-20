const { Client } = require('pg');

// Database connection string - use from environment or command line argument
// Usage: DATABASE_URL="..." node seed_complete_chart_of_accounts.cjs
// Or: node seed_complete_chart_of_accounts.cjs "postgresql://..."
const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a.oregon-postgres.render.com/china_town_db_czwv';

// شجرة الحسابات الكاملة حسب المطلوب
const chartOfAccounts = [
  // ═══════════════════════════════════════════════════════════════
  // 0001 - الأصول (Assets)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0001', name: 'الأصول', type: 'asset', nature: 'debit', parent_number: null },
  
  // 1100 - أصول متداولة
  { account_number: '1100', name: 'أصول متداولة', type: 'asset', nature: 'debit', parent_number: '0001' },
  
  // 1110 - النقد وما في حكمه
  { account_number: '1110', name: 'النقد وما في حكمه', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1111', name: 'صندوق رئيسي', type: 'cash', nature: 'debit', parent_number: '1110' },
  { account_number: '1112', name: 'صندوق فرعي', type: 'cash', nature: 'debit', parent_number: '1110' },
  
  // 1120 - بنوك
  { account_number: '1120', name: 'بنوك', type: 'bank', nature: 'debit', parent_number: '1100' },
  { account_number: '1121', name: 'بنك الراجحي', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1122', name: 'بنك الأهلي', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1123', name: 'بنك الرياض', type: 'bank', nature: 'debit', parent_number: '1120' },
  
  // 1130 - الشيكات
  { account_number: '1130', name: 'الشيكات', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1131', name: 'شيكات واردة', type: 'asset', nature: 'debit', parent_number: '1130' },
  { account_number: '1132', name: 'شيكات تحت التحصيل', type: 'asset', nature: 'debit', parent_number: '1130' },
  
  // 1140 - الذمم المدينة
  { account_number: '1140', name: 'الذمم المدينة', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1141', name: 'عملاء', type: 'asset', nature: 'debit', parent_number: '1140' },
  { account_number: '1141-01', name: 'KEETA (عميل آجِل)', type: 'asset', nature: 'debit', parent_number: '1141' },
  { account_number: '1142', name: 'ذمم مدينة أخرى', type: 'asset', nature: 'debit', parent_number: '1140' },
  
  // 1150 - سلف وعهد
  { account_number: '1150', name: 'سلف وعهد', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1151', name: 'سلف موظفين', type: 'asset', nature: 'debit', parent_number: '1150' },
  { account_number: '1152', name: 'عهد نقدية', type: 'asset', nature: 'debit', parent_number: '1150' },
  
  // 1160 - المخزون
  { account_number: '1160', name: 'المخزون', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1161', name: 'مخزون بضائع', type: 'asset', nature: 'debit', parent_number: '1160' },
  { account_number: '1162', name: 'مخزون مواد', type: 'asset', nature: 'debit', parent_number: '1160' },
  { account_number: '1163', name: 'مشتريات بدون ضريبة', type: 'asset', nature: 'debit', parent_number: '1160' },
  
  // 1170 - ضريبة القيمة المضافة - مدخلات
  { account_number: '1170', name: 'ضريبة القيمة المضافة – مدخلات', type: 'asset', nature: 'debit', parent_number: '1100' },
  
  // 1200 - أصول غير متداولة
  { account_number: '1200', name: 'أصول غير متداولة', type: 'asset', nature: 'debit', parent_number: '0001' },
  
  // 1210 - ممتلكات ومعدات
  { account_number: '1210', name: 'ممتلكات ومعدات', type: 'asset', nature: 'debit', parent_number: '1200' },
  { account_number: '1211', name: 'أجهزة', type: 'asset', nature: 'debit', parent_number: '1210' },
  { account_number: '1212', name: 'أثاث', type: 'asset', nature: 'debit', parent_number: '1210' },
  { account_number: '1213', name: 'سيارات', type: 'asset', nature: 'debit', parent_number: '1210' },
  
  // 1220 - مجمع الإهلاك
  { account_number: '1220', name: 'مجمع الإهلاك', type: 'asset', nature: 'credit', parent_number: '1200' },
  { account_number: '1221', name: 'مجمع إهلاك أجهزة', type: 'asset', nature: 'credit', parent_number: '1220' },
  { account_number: '1222', name: 'مجمع إهلاك سيارات', type: 'asset', nature: 'credit', parent_number: '1220' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0002 - الالتزامات (Liabilities)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0002', name: 'الالتزامات', type: 'liability', nature: 'credit', parent_number: null },
  
  // 2100 - التزامات متداولة
  { account_number: '2100', name: 'الالتزامات متداولة', type: 'liability', nature: 'credit', parent_number: '0002' },
  
  // 2110 - الذمم الدائنة
  { account_number: '2110', name: 'الذمم الدائنة', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2111', name: 'موردون', type: 'liability', nature: 'credit', parent_number: '2110' },
  
  // 2120 - مستحقات موظفين
  { account_number: '2120', name: 'مستحقات موظفين', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2121', name: 'رواتب مستحقة', type: 'liability', nature: 'credit', parent_number: '2120' },
  { account_number: '2122', name: 'بدلات مستحقة', type: 'liability', nature: 'credit', parent_number: '2120' },
  
  // 2130 - مستحقات حكومية
  { account_number: '2130', name: 'مستحقات حكومية', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2131', name: 'التأمينات الاجتماعية (GOSI)', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2132', name: 'رسوم قوى', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2133', name: 'رسوم مقيم', type: 'liability', nature: 'credit', parent_number: '2130' },
  
  // 2140 - ضرائب مستحقة
  { account_number: '2140', name: 'ضرائب مستحقة', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2141', name: 'ضريبة القيمة المضافة – مستحقة', type: 'liability', nature: 'credit', parent_number: '2140' },
  { account_number: '2142', name: 'ضرائب أخرى', type: 'liability', nature: 'credit', parent_number: '2140' },
  
  // 2150 - مصروفات مستحقة حسب الفروع
  { account_number: '2150', name: 'مصروفات مستحقة حسب الفروع', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2151', name: 'كهرباء – China Town', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2152', name: 'ماء – China Town', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2153', name: 'اتصالات – China Town', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2154', name: 'كهرباء – Place India', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2155', name: 'ماء – Place India', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2156', name: 'اتصالات – Place India', type: 'liability', nature: 'credit', parent_number: '2150' },
  
  // 2200 - التزامات غير متداولة
  { account_number: '2200', name: 'الالتزامات غير متداولة', type: 'liability', nature: 'credit', parent_number: '0002' },
  { account_number: '2210', name: 'قروض طويلة الأجل', type: 'liability', nature: 'credit', parent_number: '2200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0003 - حقوق الملكية (Equity)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0003', name: 'حقوق الملكية', type: 'equity', nature: 'credit', parent_number: null },
  { account_number: '3100', name: 'رأس المال', type: 'equity', nature: 'credit', parent_number: '0003' },
  { account_number: '3200', name: 'الأرباح المحتجزة', type: 'equity', nature: 'credit', parent_number: '0003' },
  { account_number: '3300', name: 'جاري المالك', type: 'equity', nature: 'debit', parent_number: '0003' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0004 - الإيرادات (Revenue)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0004', name: 'الإيرادات', type: 'revenue', nature: 'credit', parent_number: null },
  
  // 4100 - الإيرادات التشغيلية حسب الفرع
  { account_number: '4100', name: 'الإيرادات التشغيلية حسب الفرع', type: 'revenue', nature: 'credit', parent_number: '0004' },
  
  // China Town
  { account_number: '4111', name: 'مبيعات نقدية – China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4112', name: 'مبيعات آجلة – China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4113', name: 'إيرادات خدمات – China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  
  // Place India
  { account_number: '4121', name: 'مبيعات نقدية – Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4122', name: 'مبيعات آجلة – Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4123', name: 'إيرادات خدمات – Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  
  // 4200 - إيرادات أخرى
  { account_number: '4200', name: 'إيرادات أخرى', type: 'revenue', nature: 'credit', parent_number: '0004' },
  { account_number: '4210', name: 'إيرادات غير تشغيلية', type: 'revenue', nature: 'credit', parent_number: '4200' },
  { account_number: '4220', name: 'خصم مكتسب من الموردين', type: 'revenue', nature: 'credit', parent_number: '4200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0005 - المصروفات (Expenses)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0005', name: 'المصروفات', type: 'expense', nature: 'debit', parent_number: null },
  
  // 5100 - مصروفات تشغيلية حسب الفروع
  { account_number: '5100', name: 'مصروفات تشغيلية حسب الفروع', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5110', name: 'تكلفة المبيعات', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5120', name: 'مصروف كهرباء – لكل فرع', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5130', name: 'مصروف ماء – لكل فرع', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5140', name: 'مصروف اتصالات – لكل فرع', type: 'expense', nature: 'debit', parent_number: '5100' },
  
  // 5200 - مصروفات إدارية وعمومية
  { account_number: '5200', name: 'مصروفات إدارية وعمومية', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5210', name: 'رواتب وأجور', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5220', name: 'بدلات', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5230', name: 'مصروفات حكومية', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5240', name: 'مصروف غرامات', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5250', name: 'مصروفات بنكية', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5260', name: 'مصروفات متنوعة', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5270', name: 'خصم ممنوح للعملاء', type: 'expense', nature: 'debit', parent_number: '5200' },
  
  // 5300 - مصروفات مالية
  { account_number: '5300', name: 'مصروفات مالية', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5310', name: 'فوائد بنكية', type: 'expense', nature: 'debit', parent_number: '5300' },
  
  // 5400 - مصروفات موحدة
  { account_number: '5400', name: 'مصروفات موحدة', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5410', name: 'صيانة', type: 'expense', nature: 'debit', parent_number: '5400' },
  { account_number: '5420', name: 'مواد استهلاكية', type: 'expense', nature: 'debit', parent_number: '5400' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0006 - الحسابات النظامية / الرقابية
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0006', name: 'الحسابات النظامية / الرقابية', type: 'system', nature: 'debit', parent_number: null },
  { account_number: '6100', name: 'فروقات جرد', type: 'system', nature: 'debit', parent_number: '0006' },
  { account_number: '6200', name: 'فروقات نقدية', type: 'system', nature: 'debit', parent_number: '0006' },
];

async function seedAccounts(client) {
  console.log('📋 زرع شجرة الحسابات الكاملة...');
  
  // Check if accounts exist
  const { rows: existing } = await client.query('SELECT COUNT(*) as count FROM accounts WHERE account_number IS NOT NULL');
  const count = existing && existing[0] ? Number(existing[0].count) : 0;
  
  if (count > 0) {
    console.log(`⚠️  يوجد حسابات موجودة (${count}). سيتم مسح الحسابات القديمة...`);
    // Delete journal postings that reference accounts to be deleted
    await client.query('DELETE FROM journal_postings WHERE account_id IN (SELECT id FROM accounts WHERE account_number IS NOT NULL)');
    // Delete existing accounts
    await client.query('DELETE FROM accounts WHERE account_number IS NOT NULL');
    console.log('✅ تم مسح الحسابات القديمة');
  }
  
  const accountIdByNumber = {};
  
  // First pass: Create all accounts without parent_id
  for (const acc of chartOfAccounts) {
    const parentId = acc.parent_number && accountIdByNumber[acc.parent_number] ? accountIdByNumber[acc.parent_number] : null;
    
    try {
      const { rows } = await client.query(
        'INSERT INTO accounts(account_number, account_code, name, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [acc.account_number, acc.account_number, acc.name, acc.type, acc.nature, parentId, 0, true]
      );
      if (rows && rows[0]) {
        accountIdByNumber[acc.account_number] = rows[0].id;
        console.log(`  ✅ تم إنشاء حساب ${acc.account_number}: ${acc.name}`);
      }
    } catch (e) {
      console.error(`  ❌ خطأ في إنشاء حساب ${acc.account_number}: ${e.message}`);
      throw e;
    }
  }
  
  console.log(`\n✅ تم زرع ${chartOfAccounts.length} حساب بنجاح!`);
  return accountIdByNumber;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    await seedAccounts(client);
    
    console.log('\n✅ اكتملت عملية الزرع بنجاح!');
  } catch (e) {
    console.error('❌ خطأ:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();