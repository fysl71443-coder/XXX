import { pool } from '../db.js';

/**
 * Trial balance report
 * GET /api/reports/trial-balance
 */
export async function trialBalance(req, res) {
  try {
    const { from, to, period } = req.query || {};
    
    // Convert empty strings to null - CRITICAL for PostgreSQL type resolution
    const fromDate = from?.trim() || null;
    const toDate = to?.trim() || null;
    
    // Validate dates if provided
    if (fromDate && isNaN(Date.parse(fromDate))) {
      return res.status(400).json({ error: "invalid_date", details: "Invalid from date format" });
    }
    if (toDate && isNaN(Date.parse(toDate))) {
      return res.status(400).json({ error: "invalid_date", details: "Invalid to date format" });
    }
    
    // Use a very early date as default for beginning balance calculation if fromDate is null
    const effectiveFromDate = fromDate || '1970-01-01';
    
    let query = `
      SELECT 
        a.id as account_id,
        a.account_number,
        a.account_code,
        COALESCE(a.name, a.name_en, '') as account_name,
        COALESCE(a.name_en, a.name, '') as account_name_en,
        a.type as account_type,
        COALESCE(SUM(CASE WHEN je.date < $1::date THEN jp.debit - jp.credit ELSE 0 END), 0) as beginning,
        COALESCE(SUM(CASE WHEN je.date >= $1::date AND ($2::date IS NULL OR je.date <= $2::date) THEN jp.debit ELSE 0 END), 0) as debit,
        COALESCE(SUM(CASE WHEN je.date >= $1::date AND ($2::date IS NULL OR je.date <= $2::date) THEN jp.credit ELSE 0 END), 0) as credit,
        COALESCE(SUM(CASE WHEN $2::date IS NULL OR je.date <= $2::date THEN jp.debit - jp.credit ELSE 0 END), 0) as ending
      FROM accounts a
      LEFT JOIN journal_postings jp ON jp.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
      WHERE 1=1
    `;
    const params = [effectiveFromDate, toDate];
    
    query += ` GROUP BY a.id, a.account_number, a.name
               HAVING COALESCE(SUM(jp.debit), 0) + COALESCE(SUM(jp.credit), 0) > 0
               ORDER BY a.account_number`;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      account_id: row.account_id,
      account_number: row.account_number,
      account_name: row.account_name,
      beginning: Number(row.beginning || 0),
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      ending: Number(row.ending || 0)
    }));
    
    const totals = items.reduce((acc, item) => ({
      debit: acc.debit + item.debit,
      credit: acc.credit + item.credit,
      beginning: acc.beginning + item.beginning,
      ending: acc.ending + item.ending
    }), { debit: 0, credit: 0, beginning: 0, ending: 0 });
    
    res.json({ items, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 });
  } catch (e) {
    console.error('[REPORTS] Error getting trial balance:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Sales vs expenses report
 * GET /api/reports/sales-vs-expenses
 */
export async function salesVsExpenses(req, res) {
  try {
    const { from, to, period, branch } = req.query || {};
    
    // CRITICAL: Use journal entries (posted) instead of invoices/expenses directly
    // Sales revenue account codes: 4111, 4112 (china_town), 4121, 4122 (place_india)
    const salesAccountCodes = ['4111', '4112', '4121', '4122'];
    
    // Get account IDs
    const { rows: salesAccountRows } = await pool.query(
      `SELECT id FROM accounts WHERE account_code = ANY($1) OR account_number = ANY($1)`,
      [salesAccountCodes]
    );
    const salesAccountIds = salesAccountRows.map(r => r.id);
    
    const { rows: expenseAccountRows } = await pool.query(
      `SELECT id FROM accounts WHERE type = 'expense' OR account_code LIKE '5%' OR account_number LIKE '5%'`
    );
    const expenseAccountIds = expenseAccountRows.map(r => r.id);
    
    let salesWhere = [`je.status = 'posted'`, `jp.account_id = ANY($1::int[])`];
    let expensesWhere = [`je.status = 'posted'`, `jp.account_id = ANY($1::int[])`];
    const salesParams = [salesAccountIds];
    const expensesParams = [expenseAccountIds];
    let salesParamIndex = 2;
    let expensesParamIndex = 2;
    
    if (from) {
      salesWhere.push(`je.date >= $${salesParamIndex++}::date`);
      expensesWhere.push(`je.date >= $${expensesParamIndex++}::date`);
      salesParams.push(from);
      expensesParams.push(from);
    }
    if (to) {
      salesWhere.push(`je.date <= $${salesParamIndex++}::date`);
      expensesWhere.push(`je.date <= $${expensesParamIndex++}::date`);
      salesParams.push(to);
      expensesParams.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      salesWhere.push(`je.branch = $${salesParamIndex++}`);
      expensesWhere.push(`je.branch = $${expensesParamIndex++}`);
      salesParams.push(branch);
      expensesParams.push(branch);
    }
    
    // Get sales by date from journal entries (credit side)
    const salesQuery = `
      SELECT DATE(je.date) as date, COALESCE(SUM(jp.credit), 0) as total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${salesWhere.join(' AND ')}
      GROUP BY DATE(je.date)
      ORDER BY DATE(je.date)
    `;
    
    // Get expenses by date from journal entries (debit side)
    const expensesQuery = `
      SELECT DATE(je.date) as date, COALESCE(SUM(jp.debit), 0) as total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${expensesWhere.join(' AND ')}
      GROUP BY DATE(je.date)
      ORDER BY DATE(je.date)
    `;
    
    const [salesResult, expensesResult] = await Promise.all([
      pool.query(salesQuery, salesParams),
      pool.query(expensesQuery, expensesParams)
    ]);
    
    // Combine sales and expenses by date
    const dateMap = new Map();
    
    (salesResult.rows || []).forEach(row => {
      const date = row.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, sales: 0, expenses: 0 });
      }
      dateMap.get(date).sales = Number(row.total || 0);
    });
    
    (expensesResult.rows || []).forEach(row => {
      const date = row.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, sales: 0, expenses: 0 });
      }
      dateMap.get(date).expenses = Number(row.total || 0);
    });
    
    const items = Array.from(dateMap.values()).map(item => ({
      date: item.date,
      sales: item.sales,
      expenses: item.expenses,
      net: item.sales - item.expenses
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const totals = items.reduce((acc, item) => ({
      sales: acc.sales + item.sales,
      expenses: acc.expenses + item.expenses,
      net: acc.net + item.net
    }), { sales: 0, expenses: 0, net: 0 });
    
    res.json({ items, totals });
  } catch (e) {
    console.error('[REPORTS] Error getting sales vs expenses:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Sales by branch report
 * GET /api/reports/sales-by-branch
 */
export async function salesByBranch(req, res) {
  try {
    const { from, to, period, branch } = req.query || {};
    
    // CRITICAL: Use journal entries (posted) instead of invoices directly
    // Sales revenue account codes: 4111, 4112 (china_town), 4121, 4122 (place_india)
    const salesAccountCodes = ['4111', '4112', '4121', '4122'];
    
    let whereConditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Get account IDs for sales accounts
    const { rows: accountRows } = await pool.query(
      `SELECT id, account_code, account_number FROM accounts WHERE account_code = ANY($1) OR account_number = ANY($1)`,
      [salesAccountCodes]
    );
    const salesAccountIds = accountRows.map(r => r.id);
    
    if (salesAccountIds.length === 0) {
      return res.json({ items: [], totals: { invoice_count: 0, total_sales: 0, gross_total: 0, net_total: 0, tax_total: 0, discount_total: 0 } });
    }
    
    // Build query using journal entries (posted only)
    whereConditions.push(`je.status = 'posted'`);
    whereConditions.push(`jp.account_id = ANY($${paramIndex++}::int[])`);
    params.push(salesAccountIds);
    
    if (from) {
      whereConditions.push(`je.date >= $${paramIndex++}::date`);
      params.push(from);
    }
    if (to) {
      whereConditions.push(`je.date <= $${paramIndex++}::date`);
      params.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      whereConditions.push(`je.branch = $${paramIndex++}`);
      params.push(branch);
    }
    
    // Get sales from journal entries - credit side of sales accounts
    const query = `
      SELECT 
        COALESCE(je.branch, 'unknown') as branch,
        COUNT(DISTINCT je.id) as invoice_count,
        COALESCE(SUM(jp.credit), 0) as net_total,
        COALESCE(SUM(jp.credit), 0) as gross_total,
        0 as tax_total,
        0 as discount_total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY je.branch
      ORDER BY je.branch
    `;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      branch: row.branch || 'unknown',
      invoice_count: Number(row.invoice_count || 0),
      gross_total: Number(row.gross_total || 0),
      net_total: Number(row.net_total || 0),
      tax_total: Number(row.tax_total || 0),
      discount_total: Number(row.discount_total || 0),
      total_sales: Number(row.gross_total || 0) // For backward compatibility
    }));
    
    const totals = items.reduce((acc, item) => ({
      invoice_count: acc.invoice_count + item.invoice_count,
      total_sales: acc.total_sales + item.total_sales,
      gross_total: acc.gross_total + (item.gross_total || 0),
      net_total: acc.net_total + (item.net_total || 0),
      tax_total: acc.tax_total + (item.tax_total || 0),
      discount_total: acc.discount_total + (item.discount_total || 0)
    }), { invoice_count: 0, total_sales: 0, gross_total: 0, net_total: 0, tax_total: 0, discount_total: 0 });
    
    res.json({ items, totals });
  } catch (e) {
    console.error('[REPORTS] Error getting sales by branch:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Expenses by branch report
 * GET /api/reports/expenses-by-branch
 */
export async function expensesByBranch(req, res) {
  try {
    const { from, to, period, branch } = req.query || {};
    
    // CRITICAL: Use journal entries (posted) instead of expenses directly
    // Expense account codes typically start with 5xxx
    const expenseAccountCodes = ['5110', '5210', '5220', '5230', '5240', '5250'];
    
    let whereConditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Get account IDs for expense accounts (accounts with type='expense' or codes starting with 5)
    const { rows: accountRows } = await pool.query(
      `SELECT id, account_code, account_number FROM accounts 
       WHERE type = 'expense' OR account_code LIKE '5%' OR account_number LIKE '5%'`
    );
    const expenseAccountIds = accountRows.map(r => r.id);
    
    if (expenseAccountIds.length === 0) {
      return res.json({ items: [], total: 0 });
    }
    
    // Build query using journal entries (posted only)
    whereConditions.push(`je.status = 'posted'`);
    whereConditions.push(`jp.account_id = ANY($${paramIndex++}::int[])`);
    params.push(expenseAccountIds);
    
    if (from) {
      whereConditions.push(`je.date >= $${paramIndex++}::date`);
      params.push(from);
    }
    if (to) {
      whereConditions.push(`je.date <= $${paramIndex++}::date`);
      params.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      whereConditions.push(`je.branch = $${paramIndex++}`);
      params.push(branch);
    }
    
    // Get expenses from journal entries - debit side of expense accounts
    const query = `
      SELECT 
        COALESCE(je.branch, 'unknown') as branch,
        COUNT(DISTINCT je.id) as expense_count,
        COALESCE(SUM(jp.debit), 0) as total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY je.branch
      ORDER BY je.branch
    `;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      branch: row.branch || 'unknown',
      expense_count: Number(row.expense_count || 0),
      total: Number(row.total || 0)
    }));
    
    const total = items.reduce((acc, item) => acc + (item.total || 0), 0);
    
    const totals = {
      expense_count: items.reduce((acc, item) => acc + (item.expense_count || 0), 0),
      total_expenses: total
    };
    
    res.json({ items, totals, total });
  } catch (e) {
    console.error('[REPORTS] Error getting expenses by branch:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}
