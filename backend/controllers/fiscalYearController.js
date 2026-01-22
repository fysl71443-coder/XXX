/**
 * Fiscal Year Controller
 * إدارة السنوات المالية
 */

import { pool } from '../db.js';
import { cache } from '../utils/cache.js';

const FISCAL_YEAR_CACHE_KEY = 'fiscal_year_current';
const FISCAL_YEARS_CACHE_KEY = 'fiscal_years_all';

/**
 * Get current fiscal year
 * GET /api/fiscal-years/current
 */
export async function getCurrent(req, res) {
  try {
    // Check cache first
    const cached = cache.get(FISCAL_YEAR_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    const currentYear = new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT 
        id, year, status, temporary_open, temporary_open_by, temporary_open_at,
        temporary_open_reason, start_date, end_date, notes, closed_by, closed_at,
        created_at, updated_at
      FROM fiscal_years
      WHERE year = $1
    `, [currentYear]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'السنة المالية الحالية غير موجودة' });
    }

    const fiscalYear = rows[0];
    
    // Determine if entries can be created
    fiscalYear.canCreateEntries = fiscalYear.status === 'open' || fiscalYear.temporary_open;
    
    // Add status info
    fiscalYear.statusInfo = getStatusInfo(fiscalYear);
    
    // Cache for 2 minutes
    cache.set(FISCAL_YEAR_CACHE_KEY, fiscalYear, 2 * 60 * 1000);

    res.json(fiscalYear);
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting current:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * List all fiscal years
 * GET /api/fiscal-years
 */
export async function list(req, res) {
  try {
    // Check cache first
    const cached = cache.get(FISCAL_YEARS_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    const { rows } = await pool.query(`
      SELECT 
        fy.id, fy.year, fy.status, fy.temporary_open, fy.start_date, fy.end_date,
        fy.notes, fy.closed_at, fy.created_at,
        u.email as closed_by_email
      FROM fiscal_years fy
      LEFT JOIN users u ON fy.closed_by = u.id
      ORDER BY fy.year DESC
    `);

    const result = rows.map(fy => ({
      ...fy,
      canCreateEntries: fy.status === 'open' || fy.temporary_open,
      statusInfo: getStatusInfo(fy)
    }));

    // Cache for 5 minutes
    cache.set(FISCAL_YEARS_CACHE_KEY, result, 5 * 60 * 1000);

    res.json(result);
  } catch (e) {
    console.error('[FISCAL_YEAR] Error listing:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get fiscal year by ID or year number
 * GET /api/fiscal-years/:id
 */
export async function get(req, res) {
  try {
    const param = req.params.id;
    let query, params;

    if (isNaN(param) || param.length === 4) {
      // It's a year number
      query = 'SELECT * FROM fiscal_years WHERE year = $1';
      params = [parseInt(param, 10)];
    } else {
      // It's an ID
      query = 'SELECT * FROM fiscal_years WHERE id = $1';
      params = [parseInt(param, 10)];
    }

    const { rows } = await pool.query(query, params);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'السنة المالية غير موجودة' });
    }

    const fiscalYear = rows[0];
    fiscalYear.canCreateEntries = fiscalYear.status === 'open' || fiscalYear.temporary_open;
    fiscalYear.statusInfo = getStatusInfo(fiscalYear);

    res.json(fiscalYear);
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Open fiscal year
 * POST /api/fiscal-years/:id/open
 */
export async function openYear(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    const { rows } = await pool.query(`
      UPDATE fiscal_years
      SET status = 'open', temporary_open = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Log activity
    await logActivity(id, 'open', 'تم فتح السنة المالية', {}, userId, req.ip);

    // Clear cache
    invalidateCache();

    res.json({ ...rows[0], message: 'تم فتح السنة المالية بنجاح' });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error opening:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Close fiscal year
 * POST /api/fiscal-years/:id/close
 */
export async function closeYear(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    const { notes } = req.body || {};

    const { rows } = await pool.query(`
      UPDATE fiscal_years
      SET 
        status = 'closed', 
        temporary_open = FALSE,
        closed_by = $2,
        closed_at = NOW(),
        notes = COALESCE($3, notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, userId, notes]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Log activity
    await logActivity(id, 'close', 'تم إغلاق السنة المالية', { notes }, userId, req.ip);

    // Clear cache
    invalidateCache();

    res.json({ ...rows[0], message: 'تم إغلاق السنة المالية بنجاح' });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error closing:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Temporarily open a closed fiscal year
 * POST /api/fiscal-years/:id/temporary-open
 */
export async function temporaryOpen(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    const { reason } = req.body || {};

    if (!reason) {
      return res.status(400).json({ error: 'validation_error', message: 'يرجى إدخال سبب الفتح المؤقت' });
    }

    const { rows } = await pool.query(`
      UPDATE fiscal_years
      SET 
        temporary_open = TRUE,
        temporary_open_by = $2,
        temporary_open_at = NOW(),
        temporary_open_reason = $3,
        updated_at = NOW()
      WHERE id = $1 AND status = 'closed'
      RETURNING *
    `, [id, userId, reason]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'السنة المالية غير موجودة أو ليست مغلقة' });
    }

    // Log activity
    await logActivity(id, 'temporary_open', 'تم فتح السنة المالية مؤقتاً', { reason }, userId, req.ip);

    // Clear cache
    invalidateCache();

    res.json({ ...rows[0], message: 'تم فتح السنة المالية مؤقتاً بنجاح' });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error temporary opening:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Close temporary opening
 * POST /api/fiscal-years/:id/temporary-close
 */
export async function temporaryClose(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    const { rows } = await pool.query(`
      UPDATE fiscal_years
      SET 
        temporary_open = FALSE,
        updated_at = NOW()
      WHERE id = $1 AND temporary_open = TRUE
      RETURNING *
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'السنة المالية غير مفتوحة مؤقتاً' });
    }

    // Log activity
    await logActivity(id, 'temporary_close', 'تم إغلاق الفتح المؤقت', {}, userId, req.ip);

    // Clear cache
    invalidateCache();

    res.json({ ...rows[0], message: 'تم إغلاق الفتح المؤقت بنجاح' });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error temporary closing:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get fiscal year for a specific date
 * GET /api/fiscal-years/for-date?date=YYYY-MM-DD
 */
export async function getForDate(req, res) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'validation_error', message: 'يرجى تحديد التاريخ' });
    }

    const { rows } = await pool.query(`
      SELECT *
      FROM fiscal_years
      WHERE $1::date BETWEEN start_date AND end_date
    `, [date]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'لا توجد سنة مالية لهذا التاريخ',
        canCreateEntries: false
      });
    }

    const fiscalYear = rows[0];
    fiscalYear.canCreateEntries = fiscalYear.status === 'open' || fiscalYear.temporary_open;
    fiscalYear.statusInfo = getStatusInfo(fiscalYear);

    res.json(fiscalYear);
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting for date:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Check if entries can be created for a date
 * GET /api/fiscal-years/can-create?date=YYYY-MM-DD
 */
export async function canCreate(req, res) {
  try {
    const { date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(`
      SELECT *
      FROM fiscal_years
      WHERE $1::date BETWEEN start_date AND end_date
    `, [checkDate]);

    if (!rows || rows.length === 0) {
      return res.json({
        canCreate: false,
        reason: 'لا توجد سنة مالية لهذا التاريخ',
        fiscalYear: null
      });
    }

    const fy = rows[0];
    const canCreate = fy.status === 'open' || fy.temporary_open;

    res.json({
      canCreate,
      reason: canCreate ? null : 'السنة المالية مغلقة',
      fiscalYear: {
        id: fy.id,
        year: fy.year,
        status: fy.status,
        temporary_open: fy.temporary_open,
        statusInfo: getStatusInfo(fy)
      }
    });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error checking can create:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get activity log for fiscal year
 * GET /api/fiscal-years/:id/activities
 */
export async function getActivities(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { limit = 50, offset = 0 } = req.query;

    const { rows } = await pool.query(`
      SELECT 
        fya.*,
        u.email as user_email
      FROM fiscal_year_activities fya
      LEFT JOIN users u ON fya.user_id = u.id
      WHERE fya.fiscal_year_id = $1
      ORDER BY fya.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit, 10), parseInt(offset, 10)]);

    res.json(rows);
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting activities:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get fiscal year statistics
 * GET /api/fiscal-years/:id/stats
 */
export async function getStats(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    // Get fiscal year
    const { rows: fyRows } = await pool.query('SELECT * FROM fiscal_years WHERE id = $1', [id]);
    if (!fyRows || fyRows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const fy = fyRows[0];

    // Get stats
    const [journalCount, invoiceCount, expenseCount] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(jp.debit), 0) as total_debit
        FROM journal_entries je
        LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
        WHERE je.date BETWEEN $1 AND $2
      `, [fy.start_date, fy.end_date]),
      
      pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total_amount
        FROM invoices
        WHERE date BETWEEN $1 AND $2
      `, [fy.start_date, fy.end_date]),
      
      pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
        FROM expenses
        WHERE date BETWEEN $1 AND $2
      `, [fy.start_date, fy.end_date])
    ]);

    res.json({
      fiscalYear: {
        ...fy,
        statusInfo: getStatusInfo(fy)
      },
      stats: {
        journalEntries: {
          count: parseInt(journalCount.rows[0]?.count || 0, 10),
          totalDebit: parseFloat(journalCount.rows[0]?.total_debit || 0)
        },
        invoices: {
          count: parseInt(invoiceCount.rows[0]?.count || 0, 10),
          totalAmount: parseFloat(invoiceCount.rows[0]?.total_amount || 0)
        },
        expenses: {
          count: parseInt(expenseCount.rows[0]?.count || 0, 10),
          totalAmount: parseFloat(expenseCount.rows[0]?.total_amount || 0)
        }
      }
    });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting stats:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Create a new fiscal year
 * POST /api/fiscal-years
 */
export async function create(req, res) {
  try {
    const { year, start_date, end_date, notes } = req.body || {};
    const userId = req.user?.id;

    if (!year) {
      return res.status(400).json({ error: 'validation_error', message: 'يرجى تحديد السنة' });
    }

    const startDate = start_date || `${year}-01-01`;
    const endDate = end_date || `${year}-12-31`;

    const { rows } = await pool.query(`
      INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
      VALUES ($1, 'open', $2, $3, $4)
      RETURNING *
    `, [year, startDate, endDate, notes || `السنة المالية ${year}`]);

    // Log activity
    await logActivity(rows[0].id, 'create', 'تم إنشاء السنة المالية', { year }, userId, req.ip);

    // Clear cache
    invalidateCache();

    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'السنة المالية موجودة بالفعل' });
    }
    console.error('[FISCAL_YEAR] Error creating:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Rollover fiscal year - create opening balances for new year
 * POST /api/fiscal-years/:id/rollover
 */
export async function rollover(req, res) {
  const client = await pool.connect();
  try {
    const sourceYearId = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    const { target_year } = req.body || {};

    // Get source fiscal year
    const { rows: sourceRows } = await pool.query(
      'SELECT * FROM fiscal_years WHERE id = $1',
      [sourceYearId]
    );

    if (!sourceRows || sourceRows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'السنة المالية المصدر غير موجودة' });
    }

    const sourceYear = sourceRows[0];
    const targetYearNum = target_year || (sourceYear.year + 1);

    // Check if target year exists, create if not
    let { rows: targetRows } = await pool.query(
      'SELECT * FROM fiscal_years WHERE year = $1',
      [targetYearNum]
    );

    await client.query('BEGIN');

    // Update source year status to rollover
    await client.query(
      'UPDATE fiscal_years SET status = $1, updated_at = NOW() WHERE id = $2',
      ['rollover', sourceYearId]
    );

    let targetYearId;
    if (!targetRows || targetRows.length === 0) {
      // Create target year
      const { rows: newYear } = await client.query(`
        INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
        VALUES ($1, 'open', $2, $3, $4)
        RETURNING *
      `, [
        targetYearNum,
        `${targetYearNum}-01-01`,
        `${targetYearNum}-12-31`,
        `السنة المالية ${targetYearNum} - تم إنشاؤها بالترحيل`
      ]);
      targetYearId = newYear[0].id;
    } else {
      targetYearId = targetRows[0].id;
    }

    // Calculate closing balances for all accounts
    const { rows: balances } = await client.query(`
      SELECT 
        a.id as account_id,
        a.account_number,
        a.name as account_name,
        a.type as account_type,
        COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0) as balance
      FROM accounts a
      LEFT JOIN journal_postings jp ON jp.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
      WHERE je.date BETWEEN $1 AND $2
        OR je.id IS NULL
      GROUP BY a.id, a.account_number, a.name, a.type
      HAVING COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0) != 0
    `, [sourceYear.start_date, sourceYear.end_date]);

    // Create opening balance journal entry for target year
    if (balances.length > 0) {
      const { rows: entryRows } = await client.query(`
        INSERT INTO journal_entries (date, description, reference, status, fiscal_year_id, created_by)
        VALUES ($1, $2, $3, 'posted', $4, $5)
        RETURNING id
      `, [
        `${targetYearNum}-01-01`,
        `قيد الأرصدة الافتتاحية - ترحيل من ${sourceYear.year}`,
        `OPENING-${targetYearNum}`,
        targetYearId,
        userId
      ]);

      const entryId = entryRows[0].id;

      // Create postings for each account balance
      let totalDebits = 0;
      let totalCredits = 0;

      for (const bal of balances) {
        const balance = parseFloat(bal.balance);
        if (balance === 0) continue;

        if (balance > 0) {
          // Debit balance
          await client.query(`
            INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
            VALUES ($1, $2, $3, 0)
          `, [entryId, bal.account_id, Math.abs(balance)]);
          totalDebits += Math.abs(balance);
        } else {
          // Credit balance
          await client.query(`
            INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
            VALUES ($1, $2, 0, $3)
          `, [entryId, bal.account_id, Math.abs(balance)]);
          totalCredits += Math.abs(balance);
        }
      }

      // Log the details
      await logActivity(sourceYearId, 'rollover', 'تم ترحيل الأرصدة', {
        targetYear: targetYearNum,
        accountsCount: balances.length,
        totalDebits,
        totalCredits
      }, userId, req.ip);
    }

    // Update source year status to closed
    await client.query(
      'UPDATE fiscal_years SET status = $1, closed_by = $2, closed_at = NOW(), updated_at = NOW() WHERE id = $3',
      ['closed', userId, sourceYearId]
    );

    await client.query('COMMIT');

    // Clear cache
    invalidateCache();

    res.json({
      success: true,
      message: `تم ترحيل الأرصدة الافتتاحية إلى السنة ${targetYearNum}`,
      sourceYear: sourceYear.year,
      targetYear: targetYearNum,
      accountsRolledOver: balances.length
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[FISCAL_YEAR] Error rolling over:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  } finally {
    client.release();
  }
}

/**
 * Get comparison report between two fiscal years
 * GET /api/fiscal-years/compare?year1=2024&year2=2025
 */
export async function compareYears(req, res) {
  try {
    const { year1, year2 } = req.query;

    if (!year1 || !year2) {
      return res.status(400).json({ error: 'validation_error', message: 'يرجى تحديد السنتين للمقارنة' });
    }

    const y1 = parseInt(year1, 10);
    const y2 = parseInt(year2, 10);

    // Get both fiscal years
    const { rows: fyRows } = await pool.query(`
      SELECT * FROM fiscal_years WHERE year IN ($1, $2) ORDER BY year
    `, [y1, y2]);

    if (fyRows.length < 2) {
      return res.status(404).json({ error: 'not_found', message: 'إحدى السنوات المالية غير موجودة' });
    }

    const fy1 = fyRows.find(f => f.year === y1);
    const fy2 = fyRows.find(f => f.year === y2);

    // Get account balances for both years in parallel
    const [balances1, balances2, revenue1, revenue2, expenses1, expenses2] = await Promise.all([
      // Account balances year 1
      pool.query(`
        SELECT 
          a.id, a.account_number, a.name, a.type as account_type,
          COALESCE(SUM(jp.debit), 0) as total_debit,
          COALESCE(SUM(jp.credit), 0) as total_credit,
          COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0) as balance
        FROM accounts a
        LEFT JOIN journal_postings jp ON jp.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
          AND je.date BETWEEN $1 AND $2
        GROUP BY a.id, a.account_number, a.name, a.type
        ORDER BY a.account_number
      `, [fy1.start_date, fy1.end_date]),

      // Account balances year 2
      pool.query(`
        SELECT 
          a.id, a.account_number, a.name, a.type as account_type,
          COALESCE(SUM(jp.debit), 0) as total_debit,
          COALESCE(SUM(jp.credit), 0) as total_credit,
          COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0) as balance
        FROM accounts a
        LEFT JOIN journal_postings jp ON jp.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id
          AND je.date BETWEEN $1 AND $2
        GROUP BY a.id, a.account_number, a.name, a.type
        ORDER BY a.account_number
      `, [fy2.start_date, fy2.end_date]),

      // Revenue year 1
      pool.query(`
        SELECT COALESCE(SUM(total), 0) as total
        FROM invoices
        WHERE date BETWEEN $1 AND $2
      `, [fy1.start_date, fy1.end_date]),

      // Revenue year 2
      pool.query(`
        SELECT COALESCE(SUM(total), 0) as total
        FROM invoices
        WHERE date BETWEEN $1 AND $2
      `, [fy2.start_date, fy2.end_date]),

      // Expenses year 1
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE date BETWEEN $1 AND $2
      `, [fy1.start_date, fy1.end_date]),

      // Expenses year 2
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE date BETWEEN $1 AND $2
      `, [fy2.start_date, fy2.end_date])
    ]);

    // Build comparison data
    const accountComparison = [];
    const accountMap = new Map();

    // Add year 1 balances
    for (const acc of balances1.rows) {
      accountMap.set(acc.id, {
        id: acc.id,
        accountNumber: acc.account_number,
        name: acc.name,
        type: acc.account_type,
        year1Balance: parseFloat(acc.balance) || 0,
        year2Balance: 0
      });
    }

    // Add year 2 balances
    for (const acc of balances2.rows) {
      if (accountMap.has(acc.id)) {
        accountMap.get(acc.id).year2Balance = parseFloat(acc.balance) || 0;
      } else {
        accountMap.set(acc.id, {
          id: acc.id,
          accountNumber: acc.account_number,
          name: acc.name,
          type: acc.account_type,
          year1Balance: 0,
          year2Balance: parseFloat(acc.balance) || 0
        });
      }
    }

    // Calculate changes
    for (const [id, data] of accountMap) {
      const change = data.year2Balance - data.year1Balance;
      const changePercent = data.year1Balance !== 0 
        ? ((change / Math.abs(data.year1Balance)) * 100).toFixed(2)
        : (data.year2Balance !== 0 ? 100 : 0);
      
      accountComparison.push({
        ...data,
        change,
        changePercent: parseFloat(changePercent)
      });
    }

    // Sort by account number
    accountComparison.sort((a, b) => (a.accountNumber || '').localeCompare(b.accountNumber || ''));

    const rev1 = parseFloat(revenue1.rows[0]?.total || 0);
    const rev2 = parseFloat(revenue2.rows[0]?.total || 0);
    const exp1 = parseFloat(expenses1.rows[0]?.total || 0);
    const exp2 = parseFloat(expenses2.rows[0]?.total || 0);

    res.json({
      year1: { ...fy1, statusInfo: getStatusInfo(fy1) },
      year2: { ...fy2, statusInfo: getStatusInfo(fy2) },
      summary: {
        revenue: {
          year1: rev1,
          year2: rev2,
          change: rev2 - rev1,
          changePercent: rev1 !== 0 ? (((rev2 - rev1) / rev1) * 100).toFixed(2) : 0
        },
        expenses: {
          year1: exp1,
          year2: exp2,
          change: exp2 - exp1,
          changePercent: exp1 !== 0 ? (((exp2 - exp1) / exp1) * 100).toFixed(2) : 0
        },
        netIncome: {
          year1: rev1 - exp1,
          year2: rev2 - exp2,
          change: (rev2 - exp2) - (rev1 - exp1),
          changePercent: (rev1 - exp1) !== 0 
            ? ((((rev2 - exp2) - (rev1 - exp1)) / Math.abs(rev1 - exp1)) * 100).toFixed(2) 
            : 0
        }
      },
      accountComparison
    });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error comparing years:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get notifications for fiscal year end
 * GET /api/fiscal-years/notifications
 */
export async function getNotifications(req, res) {
  try {
    const notifications = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();

    // Get current fiscal year
    const { rows: currentFY } = await pool.query(`
      SELECT * FROM fiscal_years WHERE year = $1
    `, [currentYear]);

    if (currentFY && currentFY.length > 0) {
      const fy = currentFY[0];
      const endDate = new Date(fy.end_date);
      const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      // End of year notifications
      if (daysUntilEnd <= 30 && daysUntilEnd > 0) {
        notifications.push({
          id: 'year_ending_soon',
          type: 'warning',
          priority: daysUntilEnd <= 7 ? 'high' : 'medium',
          icon: '⏰',
          title: 'اقتراب نهاية السنة المالية',
          titleEn: 'Fiscal Year Ending Soon',
          message: `تبقى ${daysUntilEnd} يوم على نهاية السنة المالية ${fy.year}`,
          messageEn: `${daysUntilEnd} days remaining until fiscal year ${fy.year} ends`,
          action: 'review_entries',
          actionLabel: 'مراجعة القيود',
          actionLabelEn: 'Review Entries'
        });
      }

      // Year ended but not closed
      if (daysUntilEnd < 0 && fy.status === 'open') {
        notifications.push({
          id: 'year_ended_not_closed',
          type: 'error',
          priority: 'high',
          icon: '🔴',
          title: 'السنة المالية انتهت',
          titleEn: 'Fiscal Year Has Ended',
          message: `السنة المالية ${fy.year} انتهت ولم يتم إقفالها بعد`,
          messageEn: `Fiscal year ${fy.year} has ended and is not closed yet`,
          action: 'close_year',
          actionLabel: 'إقفال السنة',
          actionLabelEn: 'Close Year'
        });
      }

      // Check for temporary open
      if (fy.temporary_open) {
        const tempOpenDate = new Date(fy.temporary_open_at);
        const daysSinceTempOpen = Math.ceil((today - tempOpenDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceTempOpen > 7) {
          notifications.push({
            id: 'temp_open_too_long',
            type: 'warning',
            priority: 'medium',
            icon: '⚠️',
            title: 'الفتح المؤقت مستمر',
            titleEn: 'Temporary Opening Prolonged',
            message: `السنة مفتوحة مؤقتاً منذ ${daysSinceTempOpen} يوم`,
            messageEn: `Year has been temporarily open for ${daysSinceTempOpen} days`,
            action: 'close_temporary',
            actionLabel: 'إغلاق الفتح المؤقت',
            actionLabelEn: 'Close Temporary Opening'
          });
        }
      }
    }

    // Check if next year exists
    const { rows: nextFY } = await pool.query(`
      SELECT * FROM fiscal_years WHERE year = $1
    `, [currentYear + 1]);

    if (currentMonth >= 11 && (!nextFY || nextFY.length === 0)) {
      notifications.push({
        id: 'next_year_not_created',
        type: 'info',
        priority: 'low',
        icon: '📅',
        title: 'السنة المالية القادمة',
        titleEn: 'Next Fiscal Year',
        message: `لم يتم إنشاء السنة المالية ${currentYear + 1} بعد`,
        messageEn: `Fiscal year ${currentYear + 1} has not been created yet`,
        action: 'create_year',
        actionLabel: 'إنشاء السنة',
        actionLabelEn: 'Create Year'
      });
    }

    // Check for unbalanced entries
    const unbalanced = await pool.query(`
      SELECT COUNT(*) as count
      FROM journal_entries je
      WHERE je.date BETWEEN $1 AND $2
        AND (
          SELECT COALESCE(SUM(debit) - SUM(credit), 0) 
          FROM journal_postings 
          WHERE journal_entry_id = je.id
        ) != 0
    `, [`${currentYear}-01-01`, `${currentYear}-12-31`]);

    if (unbalanced.rows && unbalanced.rows.length > 0 && parseInt(unbalanced.rows[0]?.count || 0, 10) > 0) {
      const count = parseInt(unbalanced.rows[0].count || 0, 10);
      notifications.push({
        id: 'unbalanced_entries',
        type: 'error',
        priority: 'high',
        icon: '⚖️',
        title: 'قيود غير متوازنة',
        titleEn: 'Unbalanced Entries',
        message: `يوجد ${count} قيد غير متوازن يحتاج مراجعة`,
        messageEn: `${count} unbalanced entries need review`,
        action: 'review_journal',
        actionLabel: 'مراجعة القيود',
        actionLabelEn: 'Review Journal'
      });
    }

    res.json({
      notifications,
      count: notifications.length,
      hasHighPriority: notifications.some(n => n.priority === 'high')
    });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting notifications:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get year-end checklist
 * GET /api/fiscal-years/:id/checklist
 */
export async function getChecklist(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    // Get fiscal year
    const { rows: fyRows } = await pool.query('SELECT * FROM fiscal_years WHERE id = $1', [id]);
    if (!fyRows || fyRows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const fy = fyRows[0];

    // Check various conditions
    const [
      unbalancedCount,
      pendingInvoices,
      unapprovedEntries,
      recentActivity
    ] = await Promise.all([
      // Unbalanced entries
      pool.query(`
        SELECT COUNT(*) as count
        FROM journal_entries je
        WHERE je.date BETWEEN $1 AND $2
          AND (
            SELECT COALESCE(SUM(debit) - SUM(credit), 0) 
            FROM journal_postings 
            WHERE journal_entry_id = je.id
          ) != 0
      `, [fy.start_date, fy.end_date]),

      // Pending invoices
      pool.query(`
        SELECT COUNT(*) as count
        FROM invoices
        WHERE date BETWEEN $1 AND $2
          AND status IN ('draft', 'pending')
      `, [fy.start_date, fy.end_date]),

      // Unapproved entries
      pool.query(`
        SELECT COUNT(*) as count
        FROM journal_entries
        WHERE date BETWEEN $1 AND $2
          AND status != 'posted'
      `, [fy.start_date, fy.end_date]),

      // Recent activity in last 30 days
      pool.query(`
        SELECT COUNT(*) as count
        FROM journal_entries
        WHERE date BETWEEN $1 AND $2
          AND created_at > NOW() - INTERVAL '30 days'
      `, [fy.start_date, fy.end_date])
    ]);

    const checklist = [
      {
        id: 'balanced_entries',
        title: 'جميع القيود متوازنة',
        titleEn: 'All entries are balanced',
        completed: parseInt(unbalancedCount.rows[0]?.count || 0, 10) === 0,
        count: parseInt(unbalancedCount.rows[0]?.count || 0, 10),
        action: 'fix_unbalanced'
      },
      {
        id: 'no_pending_invoices',
        title: 'لا توجد فواتير معلقة',
        titleEn: 'No pending invoices',
        completed: parseInt(pendingInvoices.rows[0]?.count || 0, 10) === 0,
        count: parseInt(pendingInvoices.rows[0]?.count || 0, 10),
        action: 'review_invoices'
      },
      {
        id: 'all_entries_approved',
        title: 'جميع القيود معتمدة',
        titleEn: 'All entries approved',
        completed: parseInt(unapprovedEntries.rows[0]?.count || 0, 10) === 0,
        count: parseInt(unapprovedEntries.rows[0]?.count || 0, 10),
        action: 'approve_entries'
      },
      {
        id: 'backup_created',
        title: 'تم إنشاء نسخة احتياطية',
        titleEn: 'Backup created',
        completed: false, // Manual check
        action: 'create_backup'
      },
      {
        id: 'reports_reviewed',
        title: 'تمت مراجعة التقارير المالية',
        titleEn: 'Financial reports reviewed',
        completed: false, // Manual check
        action: 'review_reports'
      }
    ];

    const completedCount = checklist.filter(c => c.completed).length;
    const canClose = checklist.slice(0, 3).every(c => c.completed); // First 3 are required

    res.json({
      fiscalYear: { ...fy, statusInfo: getStatusInfo(fy) },
      checklist,
      summary: {
        total: checklist.length,
        completed: completedCount,
        percentage: Math.round((completedCount / checklist.length) * 100),
        canClose,
        recentActivity: parseInt(recentActivity.rows[0]?.count || 0, 10)
      }
    });
  } catch (e) {
    console.error('[FISCAL_YEAR] Error getting checklist:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusInfo(fy) {
  if (fy.status === 'open') {
    return {
      icon: '✅',
      color: 'green',
      label: 'مفتوحة',
      labelEn: 'Open',
      message: 'يمكن إنشاء القيود والفواتير',
      messageEn: 'Entries and invoices can be created'
    };
  }
  
  if (fy.status === 'closed' && fy.temporary_open) {
    return {
      icon: '🔓',
      color: 'yellow',
      label: 'مفتوحة مؤقتاً',
      labelEn: 'Temporarily Open',
      message: 'السنة مغلقة لكن مفتوحة مؤقتاً لإدخال البيانات',
      messageEn: 'Year is closed but temporarily open for data entry'
    };
  }
  
  if (fy.status === 'closed') {
    return {
      icon: '🔒',
      color: 'red',
      label: 'مغلقة',
      labelEn: 'Closed',
      message: 'السنة مغلقة. لا يمكن إنشاء قيود أو فواتير جديدة',
      messageEn: 'Year is closed. New entries or invoices cannot be created'
    };
  }
  
  if (fy.status === 'rollover') {
    return {
      icon: '🔄',
      color: 'blue',
      label: 'قيد الترحيل',
      labelEn: 'Rollover',
      message: 'جارٍ ترحيل البيانات إلى السنة الجديدة',
      messageEn: 'Data is being rolled over to the new year'
    };
  }
  
  return {
    icon: '❓',
    color: 'gray',
    label: 'غير معروف',
    labelEn: 'Unknown',
    message: '',
    messageEn: ''
  };
}

async function logActivity(fiscalYearId, action, description, details, userId, ipAddress) {
  try {
    await pool.query(`
      INSERT INTO fiscal_year_activities (fiscal_year_id, action, description, details, user_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [fiscalYearId, action, description, JSON.stringify(details), userId, ipAddress]);
  } catch (e) {
    console.error('[FISCAL_YEAR] Error logging activity:', e);
  }
}

function invalidateCache() {
  cache.delete(FISCAL_YEAR_CACHE_KEY);
  cache.delete(FISCAL_YEARS_CACHE_KEY);
}
