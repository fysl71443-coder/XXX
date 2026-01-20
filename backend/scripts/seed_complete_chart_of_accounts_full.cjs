const { Client } = require('pg');

// Database connection string - use from environment or command line argument
// Usage: DATABASE_URL="..." node seed_complete_chart_of_accounts_full.cjs
// Or: node seed_complete_chart_of_accounts_full.cjs "postgresql://..."
const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a.oregon-postgres.render.com/china_town_db_czwv';

// شجرة الحسابات الكاملة حسب الصور المرفقة
const chartOfAccounts = [
  // ═══════════════════════════════════════════════════════════════
  // 0001 - الأصول (Assets)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0001', name: 'الأصول', name_en: 'Assets', type: 'asset', nature: 'debit', parent_number: null },
  
  // 1100 - أصول متداولة
  { account_number: '1100', name: 'أصول متداولة', name_en: 'Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
  
  // 1110 - النقد وما في حكمه
  { account_number: '1110', name: 'النقد وما في حكمه', name_en: 'Cash and Cash Equivalents', type: 'cash', nature: 'debit', parent_number: '1100' },
  { account_number: '1111', name: 'الصندوق', name_en: 'Cash Box', type: 'cash', nature: 'debit', parent_number: '1110' },
  { account_number: '1112', name: 'صندوق ثانوي', name_en: 'Secondary Cash Box', type: 'cash', nature: 'debit', parent_number: '1110' },
  
  // 1120 - بنوك
  { account_number: '1120', name: 'بنوك', name_en: 'Banks', type: 'bank', nature: 'debit', parent_number: '1100' },
  { account_number: '1121', name: 'بنك / بطاقة', name_en: 'Bank / Card', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1122', name: 'بنك الأهلي', name_en: 'Al-Ahli Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1123', name: 'بنك الراجحي', name_en: 'Al-Rajhi Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1124', name: 'بنك الرياض', name_en: 'Riyadh Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  
  // 1150 - ضريبة القيمة المضافة - مدخلات
  { account_number: '1150', name: 'ضريبة القيمة المضافة - مدخلات', name_en: 'VAT - Input', type: 'asset', nature: 'debit', parent_number: '1100' },
  
  // 1160 - سلف وموردين
  { account_number: '1160', name: 'سلف وموردين', name_en: 'Advances and Suppliers', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1161', name: 'سلف موظفين', name_en: 'Employee Advances', type: 'asset', nature: 'debit', parent_number: '1160' },
  { account_number: '1162', name: 'عهد نقدية', name_en: 'Cash Advance / Custody', type: 'asset', nature: 'debit', parent_number: '1160' },
  { account_number: '1167', name: 'سلفاء', name_en: 'Advances', type: 'asset', nature: 'debit', parent_number: '1160' },
  
  // 1170 - المدينون
  { account_number: '1170', name: 'المدينون', name_en: 'Debtors', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1171', name: 'مدينون بضمان', name_en: 'Guaranteed Debtors', type: 'asset', nature: 'debit', parent_number: '1170' },
  { account_number: '1172', name: 'مدينون مواد', name_en: 'Material Debtors', type: 'asset', nature: 'debit', parent_number: '1170' },
  { account_number: '1173', name: 'مشتريات بدون ضريبة', name_en: 'Tax-Free Purchases', type: 'asset', nature: 'debit', parent_number: '1170' },
  
  // 1180 - الشيكات
  { account_number: '1180', name: 'الشيكات', name_en: 'Checks', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1181', name: 'شيكات واردة', name_en: 'Incoming Checks', type: 'asset', nature: 'debit', parent_number: '1180' },
  { account_number: '1182', name: 'شيكات تحت التحصيل', name_en: 'Checks Under Collection', type: 'asset', nature: 'debit', parent_number: '1180' },
  
  // 1200 - أصول غير متداولة
  { account_number: '1200', name: 'أصول غير متداولة', name_en: 'Non-Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
  
  // 1210 - ممتلكات ومعدات
  { account_number: '1210', name: 'ممتلكات ومعدات', name_en: 'Property, Plant, and Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
  { account_number: '1211', name: 'أجهزة', name_en: 'Equipment', type: 'asset', nature: 'debit', parent_number: '1210' },
  { account_number: '1212', name: 'آلات', name_en: 'Machinery', type: 'asset', nature: 'debit', parent_number: '1210' },
  { account_number: '1213', name: 'سيارات', name_en: 'Vehicles', type: 'asset', nature: 'debit', parent_number: '1210' },
  
  // 1230 - مجمع الإستهلاك
  { account_number: '1230', name: 'مجمع الإستهلاك', name_en: 'Accumulated Depreciation', type: 'asset', nature: 'credit', parent_number: '1200' },
  { account_number: '1231', name: 'مجمع إستهلاك أجهزة', name_en: 'Accumulated Depreciation - Equipment', type: 'asset', nature: 'credit', parent_number: '1230' },
  { account_number: '1232', name: 'مجمع إستهلاك سيارات', name_en: 'Accumulated Depreciation - Vehicles', type: 'asset', nature: 'credit', parent_number: '1230' },
  
  // 1310 - ممتلكات ومعدات (مستوى آخر)
  { account_number: '1310', name: 'ممتلكات ومعدات', name_en: 'Property, Plant, and Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0002 - الالتزامات (Liabilities)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0002', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', nature: 'credit', parent_number: null },
  
  // 2100 - التزامات متداولة
  { account_number: '2100', name: 'التزامات متداولة', name_en: 'Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
  
  // 2110 - الذمم الدائنة
  { account_number: '2110', name: 'الذمم الدائنة', name_en: 'Accounts Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2111', name: 'موردون', name_en: 'Suppliers', type: 'liability', nature: 'credit', parent_number: '2110' },
  
  // 2120 - مستحقات موظفين
  { account_number: '2120', name: 'مستحقات موظفين', name_en: 'Employee Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2121', name: 'رواتب مستحقة', name_en: 'Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2120' },
  { account_number: '2122', name: 'بدلات مستحقة', name_en: 'Allowances Payable', type: 'liability', nature: 'credit', parent_number: '2120' },
  
  // 2130 - مخصصات مدفوعة
  { account_number: '2130', name: 'مخصصات مدفوعة', name_en: 'Paid Provisions', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2131', name: 'تأمينات اجتماعية', name_en: 'Social Security', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2132', name: 'رسوم مهن', name_en: 'Professional Fees', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2133', name: 'رسوم مقيم', name_en: 'Resident Fees', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2137', name: 'مخصصات فواتير', name_en: 'Invoice Provisions', type: 'liability', nature: 'credit', parent_number: '2130' },
  
  // 2141 - ضريبة القيمة المضافة - مستحقة
  { account_number: '2141', name: 'ضريبة القيمة المضافة', name_en: 'VAT Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
  
  // 2160 - حوالات مستلمة
  { account_number: '2160', name: 'حوالات مستلمة', name_en: 'Received Transfers', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2162', name: 'حوالات إلى', name_en: 'Transfers To', type: 'liability', nature: 'credit', parent_number: '2160' },
  
  // 2211 - الضريبة المستحقة
  { account_number: '2211', name: 'الضريبة المستحقة', name_en: 'Tax Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
  
  // 2760 - مخصصات مبيعات حسب النوع
  { account_number: '2760', name: 'مخصصات مبيعات حسب النوع', name_en: 'Sales Provisions by Type', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2763', name: 'كهرباء - China Town', name_en: 'Electricity - China Town', type: 'liability', nature: 'credit', parent_number: '2760' },
  { account_number: '2764', name: 'مياه - China Town', name_en: 'Water - China Town', type: 'liability', nature: 'credit', parent_number: '2760' },
  { account_number: '2765', name: 'إيجار - China Town', name_en: 'Rent - China Town', type: 'liability', nature: 'credit', parent_number: '2760' },
  { account_number: '2766', name: 'كهرباء - Place India', name_en: 'Electricity - Place India', type: 'liability', nature: 'credit', parent_number: '2760' },
  { account_number: '2767', name: 'مياه - Place India', name_en: 'Water - Place India', type: 'liability', nature: 'credit', parent_number: '2760' },
  { account_number: '2768', name: 'إيجار - Place India', name_en: 'Rent - Place India', type: 'liability', nature: 'credit', parent_number: '2760' },
  
  // 2200 - التزامات غير متداولة
  { account_number: '2200', name: 'التزامات غير متداولة', name_en: 'Non-Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
  { account_number: '2210', name: 'قروض طويلة الأجل', name_en: 'Long-term Loans', type: 'liability', nature: 'credit', parent_number: '2200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0003 - حقوق الملكية (Equity)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0003', name: 'حقوق الملكية', name_en: 'Equity', type: 'equity', nature: 'credit', parent_number: null },
  { account_number: '3100', name: 'رأس المال', name_en: 'Capital', type: 'equity', nature: 'credit', parent_number: '0003' },
  { account_number: '3200', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', nature: 'credit', parent_number: '0003' },
  { account_number: '3300', name: 'جاري المالك', name_en: 'Owner Current Account', type: 'equity', nature: 'debit', parent_number: '0003' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0004 - الإيرادات (Revenue)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0004', name: 'الإيرادات', name_en: 'Revenues', type: 'revenue', nature: 'credit', parent_number: null },
  
  // 4000 - الإيرادات
  { account_number: '4000', name: 'الإيرادات', name_en: 'Revenues', type: 'revenue', nature: 'credit', parent_number: '0004' },
  { account_number: '4131', name: 'إيجار', name_en: 'Rent', type: 'revenue', nature: 'credit', parent_number: '4000' },
  
  // 4100 - الإيرادات التشغيلية حسب النوع
  { account_number: '4100', name: 'الإيرادات التشغيلية حسب النوع', name_en: 'Operating Revenues by Type', type: 'revenue', nature: 'credit', parent_number: '0004' },
  
  // China Town
  { account_number: '4111', name: 'مبيعات نقدية - China Town', name_en: 'Cash Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4112', name: 'مبيعات آجلة - China Town', name_en: 'Credit Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  
  // Place India
  { account_number: '4121', name: 'مبيعات نقدية - Place India', name_en: 'Cash Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4122', name: 'مبيعات آجلة - Place India', name_en: 'Credit Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  
  // 4200 - إيرادات أخرى
  { account_number: '4200', name: 'إيرادات أخرى', name_en: 'Other Revenues', type: 'revenue', nature: 'credit', parent_number: '0004' },
  { account_number: '4210', name: 'إيرادات غير تشغيلية', name_en: 'Non-operating Revenues', type: 'revenue', nature: 'credit', parent_number: '4200' },
  { account_number: '4220', name: 'خصم مكتسب من الموردين', name_en: 'Discount Earned from Suppliers', type: 'revenue', nature: 'credit', parent_number: '4200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0005 - المصروفات العمومية والإدارية (General and Administrative Expenses)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0005', name: 'المصروفات العمومية والإدارية', name_en: 'General and Administrative Expenses', type: 'expense', nature: 'debit', parent_number: null },
  
  // 5100 - مصروفات تشغيلية حسب الفروع
  { account_number: '5100', name: 'مصروفات تشغيلية حسب الفروع', name_en: 'Operating Expenses by Branch', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5110', name: 'تكلفة المبيعات', name_en: 'Cost of Goods Sold', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5120', name: 'مصروف كهرباء - لكل فرع', name_en: 'Electricity Expense - Per Branch', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5130', name: 'مصروف ماء - لكل فرع', name_en: 'Water Expense - Per Branch', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5140', name: 'مصروف اتصالات - لكل فرع', name_en: 'Telecom Expense - Per Branch', type: 'expense', nature: 'debit', parent_number: '5100' },
  
  // 5200 - مصروفات إدارية وعمومية
  { account_number: '5200', name: 'مصروفات إدارية وعمومية', name_en: 'Administrative and General Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5210', name: 'مشتريات', name_en: 'Purchases', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5220', name: 'رواتب وأجور', name_en: 'Salaries and Wages', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5230', name: 'مصروفات حكومية', name_en: 'Government Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5240', name: 'مصروف غرامات', name_en: 'Fines Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5250', name: 'مصروفات بنكية', name_en: 'Bank Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5260', name: 'مصروفات متنوعة', name_en: 'Miscellaneous Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5270', name: 'خصم ممنوح للعملاء', name_en: 'Discount Given to Customers', type: 'expense', nature: 'debit', parent_number: '5200' },
  
  // 6000 - المصروفات الإدارية والعمومية
  { account_number: '6000', name: 'المصروفات الإدارية والعمومية', name_en: 'Administrative and General Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
  
  // 6100 - مصروفات عمومية
  { account_number: '6100', name: 'مصروفات عمومية', name_en: 'General Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6200 - مصروفات نقدية
  { account_number: '6200', name: 'مصروفات نقدية', name_en: 'Cash Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6300 - مصروفات بنكية
  { account_number: '6300', name: 'مصروفات بنكية', name_en: 'Bank Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6400 - مصروفات بيع
  { account_number: '6400', name: 'مصروفات بيع', name_en: 'Selling Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6500 - مصروفات تسويق
  { account_number: '6500', name: 'مصروفات تسويق', name_en: 'Marketing Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6600 - مصروفات صيانة
  { account_number: '6600', name: 'مصروفات صيانة', name_en: 'Maintenance Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6700 - مصروفات نقل
  { account_number: '6700', name: 'مصروفات نقل', name_en: 'Transportation Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6800 - مصروفات سفر
  { account_number: '6800', name: 'مصروفات سفر', name_en: 'Travel Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6900 - مصروفات كهرباء
  { account_number: '6900', name: 'مصروفات كهرباء', name_en: 'Electricity Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6910 - مصروفات مياه
  { account_number: '6910', name: 'مصروفات مياه', name_en: 'Water Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6920 - مصروفات إيجار
  { account_number: '6920', name: 'مصروفات إيجار', name_en: 'Rent Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6930 - مصروفات رواتب
  { account_number: '6930', name: 'مصروفات رواتب', name_en: 'Salary Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6940 - مصروفات هاتف
  { account_number: '6940', name: 'مصروفات هاتف', name_en: 'Telephone Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6950 - مصروفات انترنت
  { account_number: '6950', name: 'مصروفات انترنت', name_en: 'Internet Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6960 - مصروفات طباعة
  { account_number: '6960', name: 'مصروفات طباعة', name_en: 'Printing Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6970 - مصروفات قرطاسية
  { account_number: '6970', name: 'مصروفات قرطاسية', name_en: 'Stationery Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6980 - مصروفات تدريب
  { account_number: '6980', name: 'مصروفات تدريب', name_en: 'Training Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6990 - مصروفات ضيافة
  { account_number: '6990', name: 'مصروفات ضيافة', name_en: 'Hospitality Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
  
  // 6999 - مصروفات أخرى
  { account_number: '6999', name: 'مصروفات أخرى', name_en: 'Other Expenses', type: 'expense', nature: 'debit', parent_number: '6000' },
];

async function seedAccounts(client) {
  console.log('📋 زرع شجرة الحسابات الكاملة...');
  
  // Check if accounts exist
  const { rows: existing } = await client.query('SELECT COUNT(*) as count FROM accounts WHERE account_number IS NOT NULL');
  const count = existing && existing[0] ? Number(existing[0].count) : 0;
  
  if (count > 0) {
    console.log(`⚠️  يوجد حسابات موجودة (${count}). سيتم مسح الحسابات القديمة...`);
    // Delete related records first
    await client.query('DELETE FROM branch_accounts WHERE account_id IN (SELECT id FROM accounts WHERE account_number IS NOT NULL)');
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
        'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [acc.account_number, acc.account_number, acc.name, acc.name_en || acc.name, acc.type, acc.nature, parentId, 0, true]
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
