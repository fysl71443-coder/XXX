const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection string
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';

// شجرة الحسابات الكاملة (نفس الكود من server.js)
const defaultAccounts = [
  // ═══════════════════════════════════════════════════════════════
  // 0001 - الأصول (Assets)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0001', name: 'الأصول', name_en: 'Assets', type: 'asset', nature: 'debit' },
  
  // 1100 - أصول متداولة
  { account_number: '1100', name: 'أصول متداولة', name_en: 'Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
  
  // 1110 - النقد وما في حكمه
  { account_number: '1110', name: 'النقد وما في حكمه', name_en: 'Cash and Cash Equivalents', type: 'cash', nature: 'debit', parent_number: '1100' },
  { account_number: '1111', name: 'صندوق رئيسي', name_en: 'Main Cash', type: 'cash', nature: 'debit', parent_number: '1110' },
  { account_number: '1112', name: 'صندوق فرعي', name_en: 'Sub Cash', type: 'cash', nature: 'debit', parent_number: '1110' },
  
  // 1120 - بنوك
  { account_number: '1120', name: 'بنوك', name_en: 'Banks', type: 'bank', nature: 'debit', parent_number: '1100' },
  { account_number: '1121', name: 'بنك الراجحي', name_en: 'Al Rajhi Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1122', name: 'بنك الأهلي', name_en: 'Al Ahli Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  { account_number: '1123', name: 'بنك الرياض', name_en: 'Riyad Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
  
  // 1130 - الشيكات
  { account_number: '1130', name: 'الشيكات', name_en: 'Checks', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1131', name: 'شيكات واردة', name_en: 'Incoming Checks', type: 'asset', nature: 'debit', parent_number: '1130' },
  { account_number: '1132', name: 'شيكات تحت التحصيل', name_en: 'Checks Under Collection', type: 'asset', nature: 'debit', parent_number: '1130' },
  
  // 1140 - الذمم المدينة
  { account_number: '1140', name: 'الذمم المدينة', name_en: 'Accounts Receivable', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1141', name: 'عملاء', name_en: 'Customers', type: 'asset', nature: 'debit', parent_number: '1140' },
  { account_number: '1142', name: 'ذمم مدينة أخرى', name_en: 'Other Receivables', type: 'asset', nature: 'debit', parent_number: '1140' },
  
  // 1150 - سلف وعهد
  { account_number: '1150', name: 'سلف وعهد', name_en: 'Advances and Deposits', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1151', name: 'سلف موظفين', name_en: 'Employee Advances', type: 'asset', nature: 'debit', parent_number: '1150' },
  { account_number: '1152', name: 'عهد نقدية', name_en: 'Cash Deposits', type: 'asset', nature: 'debit', parent_number: '1150' },
  
  // 1160 - المخزون
  { account_number: '1160', name: 'المخزون', name_en: 'Inventory', type: 'asset', nature: 'debit', parent_number: '1100' },
  { account_number: '1161', name: 'مخزون بضائع', name_en: 'Merchandise Inventory', type: 'asset', nature: 'debit', parent_number: '1160' },
  { account_number: '1162', name: 'مخزون مواد', name_en: 'Materials Inventory', type: 'asset', nature: 'debit', parent_number: '1160' },
  
  // 1170 - ضريبة القيمة المضافة - مدخلات (VAT Input)
  { account_number: '1170', name: 'ضريبة القيمة المضافة – مدخلات', name_en: 'VAT Input', type: 'asset', nature: 'debit', parent_number: '1100' },
  
  // 1200 - أصول غير متداولة
  { account_number: '1200', name: 'أصول غير متداولة', name_en: 'Non-Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
  
  // 1210 - ممتلكات ومعدات
  { account_number: '1210', name: 'ممتلكات ومعدات', name_en: 'Property and Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
  { account_number: '1211', name: 'أجهزة', name_en: 'Equipment', type: 'asset', nature: 'debit', parent_number: '1210' },
  { account_number: '1212', name: 'أثاث', name_en: 'Furniture', type: 'asset', nature: 'debit', parent_number: '1210' },
  { account_number: '1213', name: 'سيارات', name_en: 'Vehicles', type: 'asset', nature: 'debit', parent_number: '1210' },
  
  // 1220 - مجمع الإهلاك
  { account_number: '1220', name: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'asset', nature: 'credit', parent_number: '1200' },
  { account_number: '1221', name: 'مجمع إهلاك أجهزة', name_en: 'Accumulated Depreciation - Equipment', type: 'asset', nature: 'credit', parent_number: '1220' },
  { account_number: '1222', name: 'مجمع إهلاك سيارات', name_en: 'Accumulated Depreciation - Vehicles', type: 'asset', nature: 'credit', parent_number: '1220' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0002 - الالتزامات (Liabilities)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0002', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', nature: 'credit' },
  
  // 2100 - التزامات متداولة
  { account_number: '2100', name: 'التزامات متداولة', name_en: 'Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
  
  // 2110 - الذمم الدائنة
  { account_number: '2110', name: 'الذمم الدائنة', name_en: 'Accounts Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2111', name: 'موردون', name_en: 'Suppliers', type: 'liability', nature: 'credit', parent_number: '2110' },
  
  // 2120 - مستحقات موظفين
  { account_number: '2120', name: 'مستحقات موظفين', name_en: 'Employee Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2121', name: 'رواتب مستحقة', name_en: 'Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2120' },
  { account_number: '2122', name: 'بدلات مستحقة', name_en: 'Allowances Payable', type: 'liability', nature: 'credit', parent_number: '2120' },
  
  // 2130 - مستحقات حكومية
  { account_number: '2130', name: 'مستحقات حكومية', name_en: 'Government Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2131', name: 'التأمينات الاجتماعية (GOSI)', name_en: 'GOSI', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2132', name: 'رسوم قوى', name_en: 'Labor Fees', type: 'liability', nature: 'credit', parent_number: '2130' },
  { account_number: '2133', name: 'رسوم مقيم', name_en: 'Residency Fees', type: 'liability', nature: 'credit', parent_number: '2130' },
  
  // 2140 - ضرائب مستحقة
  { account_number: '2140', name: 'ضرائب مستحقة', name_en: 'Tax Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2141', name: 'ضريبة القيمة المضافة – مستحقة', name_en: 'VAT Output', type: 'liability', nature: 'credit', parent_number: '2140' },
  { account_number: '2142', name: 'ضرائب أخرى', name_en: 'Other Taxes', type: 'liability', nature: 'credit', parent_number: '2140' },
  
  // 2150 - مصروفات مستحقة
  { account_number: '2150', name: 'مصروفات مستحقة', name_en: 'Accrued Expenses', type: 'liability', nature: 'credit', parent_number: '2100' },
  { account_number: '2151', name: 'كهرباء مستحقة', name_en: 'Electricity Payable', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2152', name: 'ماء مستحق', name_en: 'Water Payable', type: 'liability', nature: 'credit', parent_number: '2150' },
  { account_number: '2153', name: 'اتصالات مستحقة', name_en: 'Telecom Payable', type: 'liability', nature: 'credit', parent_number: '2150' },
  
  // 2200 - التزامات غير متداولة
  { account_number: '2200', name: 'التزامات غير متداولة', name_en: 'Non-Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
  { account_number: '2210', name: 'قروض طويلة الأجل', name_en: 'Long-term Loans', type: 'liability', nature: 'credit', parent_number: '2200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0003 - حقوق الملكية (Equity)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0003', name: 'حقوق الملكية', name_en: 'Equity', type: 'equity', nature: 'credit' },
  { account_number: '3100', name: 'رأس المال', name_en: 'Capital', type: 'equity', nature: 'credit', parent_number: '0003' },
  { account_number: '3200', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', nature: 'credit', parent_number: '0003' },
  { account_number: '3300', name: 'جاري المالك', name_en: 'Owner Current Account', type: 'equity', nature: 'debit', parent_number: '0003' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0004 - الإيرادات (Revenue)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0004', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', nature: 'credit' },
  
  // 4100 - الإيرادات التشغيلية حسب الفرع
  { account_number: '4100', name: 'الإيرادات التشغيلية حسب الفرع', name_en: 'Operating Revenue by Branch', type: 'revenue', nature: 'credit', parent_number: '0004' },
  
  // China Town
  { account_number: '4111', name: 'مبيعات نقدية – China Town', name_en: 'Cash Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4112', name: 'مبيعات آجلة – China Town', name_en: 'Credit Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4113', name: 'إيرادات خدمات – China Town', name_en: 'Service Revenue - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
  
  // Place India
  { account_number: '4121', name: 'مبيعات نقدية – Place India', name_en: 'Cash Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4122', name: 'مبيعات آجلة – Place India', name_en: 'Credit Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  { account_number: '4123', name: 'إيرادات خدمات – Place India', name_en: 'Service Revenue - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
  
  // 4200 - إيرادات أخرى
  { account_number: '4200', name: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', nature: 'credit', parent_number: '0004' },
  { account_number: '4210', name: 'إيرادات غير تشغيلية', name_en: 'Non-Operating Revenue', type: 'revenue', nature: 'credit', parent_number: '4200' },
  { account_number: '4220', name: 'خصم مكتسب من الموردين', name_en: 'Discount Earned from Suppliers', type: 'revenue', nature: 'credit', parent_number: '4200' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0005 - المصروفات (Expenses)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0005', name: 'المصروفات', name_en: 'Expenses', type: 'expense', nature: 'debit' },
  
  // 5100 - مصروفات تشغيلية
  { account_number: '5100', name: 'مصروفات تشغيلية', name_en: 'Operating Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5110', name: 'تكلفة مبيعات', name_en: 'Cost of Sales', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5120', name: 'مصروف كهرباء', name_en: 'Electricity Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5130', name: 'مصروف ماء', name_en: 'Water Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
  { account_number: '5140', name: 'مصروف اتصالات', name_en: 'Telecom Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
  
  // 5200 - مصروفات إدارية وعمومية
  { account_number: '5200', name: 'مصروفات إدارية وعمومية', name_en: 'Administrative Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5210', name: 'رواتب وأجور', name_en: 'Salaries and Wages', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5220', name: 'بدلات', name_en: 'Allowances', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5230', name: 'مصروفات حكومية', name_en: 'Government Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5240', name: 'مصروف غرامات', name_en: 'Fines Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5250', name: 'مصروفات بنكية', name_en: 'Bank Charges', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5260', name: 'مصروفات متنوعة', name_en: 'Miscellaneous Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
  { account_number: '5270', name: 'خصم ممنوح للعملاء', name_en: 'Discount Given to Customers', type: 'expense', nature: 'debit', parent_number: '5200' },
  
  // 5300 - مصروفات مالية
  { account_number: '5300', name: 'مصروفات مالية', name_en: 'Financial Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
  { account_number: '5310', name: 'فوائد بنكية', name_en: 'Bank Interest', type: 'expense', nature: 'debit', parent_number: '5300' },
  
  // ═══════════════════════════════════════════════════════════════
  // 0006 - حسابات نظامية / رقابية (اختيارية)
  // ═══════════════════════════════════════════════════════════════
  { account_number: '0006', name: 'حسابات نظامية / رقابية', name_en: 'System / Control Accounts', type: 'system', nature: 'debit' },
  { account_number: '6100', name: 'فروقات جرد', name_en: 'Inventory Differences', type: 'system', nature: 'debit', parent_number: '0006' },
  { account_number: '6200', name: 'فروقات نقدية', name_en: 'Cash Differences', type: 'system', nature: 'debit', parent_number: '0006' },
];

async function seedAccounts(client) {
  console.log('📋 Seeding accounts...');
  
  // Check if accounts exist
  const { rows: existing } = await client.query('SELECT COUNT(*) as count FROM accounts');
  const count = existing && existing[0] ? Number(existing[0].count) : 0;
  
  if (count > 0) {
    console.log(`⚠️  Accounts already exist (${count}). Clearing...`);
    await client.query('DELETE FROM journal_postings');
    await client.query('DELETE FROM accounts');
  }
  
  const accountIdByNumber = {};
  
  for (const acc of defaultAccounts) {
    const parentId = acc.parent_number ? accountIdByNumber[acc.parent_number] : null;
    const { rows } = await client.query(
      'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [acc.account_number, acc.account_number, acc.name, acc.name_en, acc.type, acc.nature, parentId, 0, true]
    );
    if (rows && rows[0]) {
      accountIdByNumber[acc.account_number] = rows[0].id;
    }
  }
  
  console.log(`✅ Seeded ${defaultAccounts.length} accounts`);
}

async function seedProducts(client) {
  console.log('📋 Seeding products...');
  
  // Read products from JSON file
  const productsPath = path.join(__dirname, '../../products-import.json');
  let sections = [];
  
  try {
    const content = fs.readFileSync(productsPath, 'utf8');
    sections = JSON.parse(content);
  } catch (e) {
    console.error('❌ Error reading products-import.json:', e.message);
    return;
  }
  
  if (!Array.isArray(sections) || sections.length === 0) {
    console.log('⚠️  No products found in products-import.json');
    return;
  }
  
  let totalCreated = 0;
  let totalUpdated = 0;
  let errors = [];
  
  for (const section of sections) {
    const sectionName = String(section.section_name || '').trim();
    const items = Array.isArray(section.items) ? section.items : [];
    
    if (!sectionName || items.length === 0) continue;
    
    for (const item of items) {
      try {
        const itemName = String(item.name || '').trim();
        const itemPrice = Number(item.price || 0);
        
        if (!itemName || itemPrice <= 0) {
          errors.push({ item: itemName || 'unknown', error: 'Invalid name or price' });
          continue;
        }
        
        // Parse name: "English / Arabic" format
        let nameEn = '';
        let nameAr = '';
        const nameParts = itemName.split('/').map(s => s.trim()).filter(Boolean);
        if (nameParts.length >= 2) {
          nameEn = nameParts[0];
          nameAr = nameParts.slice(1).join('/');
        } else if (nameParts.length === 1) {
          const hasArabic = /[\u0600-\u06FF]/.test(nameParts[0]);
          if (hasArabic) {
            nameAr = nameParts[0];
          } else {
            nameEn = nameParts[0];
          }
        }
        
        // Check if product exists
        const { rows: existing } = await client.query(
          'SELECT id FROM products WHERE name = $1 OR name_en = $2 LIMIT 1',
          [nameAr || nameEn, nameEn || nameAr]
        );
        
        if (existing && existing[0]) {
          // Update existing
          await client.query(
            'UPDATE products SET name=$1, name_en=$2, category=$3, price=$4, updated_at=NOW() WHERE id=$5',
            [nameAr || nameEn, nameEn || nameAr, sectionName, itemPrice, existing[0].id]
          );
          totalUpdated++;
        } else {
          // Create new
          await client.query(
            'INSERT INTO products(name, name_en, category, unit, price, cost, tax_rate, stock_quantity, min_stock, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [nameAr || nameEn, nameEn || nameAr, sectionName, 'unit', itemPrice, 0, 15, 0, 0, true]
          );
          totalCreated++;
        }
      } catch (itemError) {
        console.error('[PRODUCTS] Error processing item:', item, itemError.message);
        errors.push({ item: item.name || 'unknown', error: itemError.message });
      }
    }
  }
  
  console.log(`✅ Products: ${totalCreated} created, ${totalUpdated} updated, ${errors.length} errors`);
  if (errors.length > 0) {
    console.log('❌ Errors:', errors.slice(0, 5));
  }
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    await seedAccounts(client);
    await seedProducts(client);
    
    console.log('✅ Seeding completed!');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
