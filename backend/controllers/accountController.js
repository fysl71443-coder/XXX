import { pool } from '../db.js';

/**
 * List accounts (tree structure)
 * GET /api/accounts
 */
export async function list(req, res) {
  try {
    const { rows } = await pool.query('SELECT id, account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry, created_at FROM accounts ORDER BY account_number ASC');
    const accounts = rows || [];
    const byId = new Map(accounts.map(a => [a.id, { ...a, children: [] }]));
    const roots = [];
    for (const a of byId.values()) {
      if (a.parent_id) {
        const p = byId.get(a.parent_id);
        if (p) p.children.push(a);
        else roots.push(a);
      } else {
        roots.push(a);
      }
    }
    res.json(roots);
  } catch (e) {
    console.error('[ACCOUNTS] Error fetching accounts tree:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get single account
 * GET /api/accounts/:id
 */
export async function get(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry, created_at, updated_at FROM accounts WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Account not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error getting account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Create account
 * POST /api/accounts
 */
export async function create(req, res) {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [b.account_number||null, b.account_code||b.account_number||null, b.name||'', b.name_en||'', b.type||'asset', b.nature||'debit', b.parent_id||null, Number(b.opening_balance||0), b.allow_manual_entry!==false]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error creating account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Update account
 * PUT /api/accounts/:id
 */
export async function update(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE accounts SET name=COALESCE($1,name), name_en=COALESCE($2,name_en), type=COALESCE($3,type), nature=COALESCE($4,nature), opening_balance=COALESCE($5,opening_balance), allow_manual_entry=COALESCE($6,allow_manual_entry), updated_at=NOW() WHERE id=$7 RETURNING *',
      [b.name||null, b.name_en||null, b.type||null, b.nature||null, b.opening_balance!=null?Number(b.opening_balance):null, b.allow_manual_entry, id]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error updating account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Delete account
 * DELETE /api/accounts/:id
 */
export async function remove(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const force = req.query.force === '1' || req.query.force === 'true';
    // Check if account has journal postings
    const { rows: postings } = await pool.query('SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1', [id]);
    if (!force && postings && postings[0] && Number(postings[0].count) > 0) {
      return res.status(400).json({ error: "account_has_postings", message: "Cannot delete account with journal postings" });
    }
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ACCOUNTS] Error deleting account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Seed default accounts tree
 * POST /api/accounts/seed-default
 */
export async function seedDefault(req, res) {
  try {
    // Check if accounts already exist - allow force recreate
    const forceRecreate = req.body?.force === true;
    const { rows: existing } = await pool.query('SELECT COUNT(*) as count FROM accounts');
    if (!forceRecreate && existing && existing[0] && Number(existing[0].count) > 0) {
      return res.status(400).json({ error: "accounts_exist", message: "Accounts already exist. Use force=true to recreate." });
    }
    
    // Clear existing accounts if force recreate
    if (forceRecreate) {
      await pool.query('DELETE FROM journal_postings');
      await pool.query('DELETE FROM accounts');
    }
    
    // شجرة حسابات كاملة متوافقة مع النظام السعودي - الهيكل النهائي
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
      { account_number: '2131', name: 'التأمينات الاجتماعية (GOSI)', name_en: 'GOSI Payable', type: 'liability', nature: 'credit', parent_number: '2130' },
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
      { account_number: '3300', name: 'جاري المالك', name_en: 'Owner Current Account', type: 'equity', nature: 'credit', parent_number: '0003' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0004 - الإيرادات (Revenue)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0004', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', nature: 'credit' },
      
      // 4100 - الإيرادات التشغيلية حسب الفرع
      { account_number: '4100', name: 'الإيرادات التشغيلية', name_en: 'Operating Revenue', type: 'revenue', nature: 'credit', parent_number: '0004' },
      
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
      { account_number: '4220', name: 'خصم مكتسب من الموردين', name_en: 'Discount Received from Suppliers', type: 'revenue', nature: 'credit', parent_number: '4200' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0005 - المصروفات (Expenses)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0005', name: 'المصروفات', name_en: 'Expenses', type: 'expense', nature: 'debit' },
      
      // 5100 - مصروفات تشغيلية
      { account_number: '5100', name: 'مصروفات تشغيلية', name_en: 'Operating Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
      { account_number: '5110', name: 'تكلفة مبيعات', name_en: 'Cost of Goods Sold', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5120', name: 'مصروف كهرباء', name_en: 'Electricity Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5130', name: 'مصروف ماء', name_en: 'Water Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5140', name: 'مصروف اتصالات', name_en: 'Telecom Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
      
      // 5200 - مصروفات إدارية وعمومية
      { account_number: '5200', name: 'مصروفات إدارية وعمومية', name_en: 'Administrative and General Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
      { account_number: '5210', name: 'رواتب وأجور', name_en: 'Salaries and Wages', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5220', name: 'بدلات', name_en: 'Allowances', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5230', name: 'مصروفات حكومية', name_en: 'Government Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5240', name: 'مصروف غرامات', name_en: 'Fines Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5250', name: 'مصروفات بنكية', name_en: 'Bank Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5260', name: 'مصروفات متنوعة', name_en: 'Miscellaneous Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5270', name: 'خصم ممنوح للعملاء', name_en: 'Discount Given to Customers', type: 'expense', nature: 'debit', parent_number: '5200' },
      
      // 5300 - مصروفات مالية
      { account_number: '5300', name: 'مصروفات مالية', name_en: 'Financial Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
      { account_number: '5310', name: 'فوائد بنكية', name_en: 'Bank Interest', type: 'expense', nature: 'debit', parent_number: '5300' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0006 - حسابات نظامية / رقابية (اختيارية)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0006', name: 'حسابات نظامية / رقابية', name_en: 'System/Control Accounts', type: 'asset', nature: 'debit' },
      { account_number: '6100', name: 'فروقات جرد', name_en: 'Inventory Differences', type: 'asset', nature: 'debit', parent_number: '0006' },
      { account_number: '6200', name: 'فروقات نقدية', name_en: 'Cash Differences', type: 'asset', nature: 'debit', parent_number: '0006' },
    ];
    
    // Insert accounts
    const accountIdByNumber = {};
    for (const acc of defaultAccounts) {
      const parentId = acc.parent_number ? accountIdByNumber[acc.parent_number] : null;
      const { rows } = await pool.query(
        'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [acc.account_number, acc.account_number, acc.name, acc.name_en, acc.type, acc.nature, parentId, 0, true]
      );
      if (rows && rows[0]) {
        accountIdByNumber[acc.account_number] = rows[0].id;
      }
    }
    
    console.log(`[ACCOUNTS] Seeded ${defaultAccounts.length} accounts successfully`);
    res.json({ ok: true, count: defaultAccounts.length });
  } catch (e) {
    console.error('[ACCOUNTS] Error seeding default accounts:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}
