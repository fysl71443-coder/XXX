/**
 * Middleware to check if entries can be created for a specific date
 * يتحقق من إمكانية إنشاء قيود/فواتير لتاريخ محدد بناءً على حالة السنة المالية
 */

import { pool } from '../db.js';

/**
 * Check if entries can be created for a specific date
 * @param {Date|string} date - The date to check
 * @returns {Promise<{canCreate: boolean, reason?: string, fiscalYear?: object}>}
 */
export async function checkFiscalYearForDate(date) {
  try {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    
    const { rows } = await pool.query(`
      SELECT *
      FROM fiscal_years
      WHERE $1::date BETWEEN start_date AND end_date
      ORDER BY year DESC
      LIMIT 1
    `, [dateStr]);

    if (!rows || rows.length === 0) {
      return {
        canCreate: false,
        reason: 'لا توجد سنة مالية لهذا التاريخ',
        fiscalYear: null
      };
    }

    const fiscalYear = rows[0];
    const canCreate = fiscalYear.status === 'open' || fiscalYear.temporary_open;

    return {
      canCreate,
      reason: canCreate ? null : `السنة المالية ${fiscalYear.year} مغلقة`,
      fiscalYear: {
        id: fiscalYear.id,
        year: fiscalYear.year,
        status: fiscalYear.status,
        temporary_open: fiscalYear.temporary_open,
        start_date: fiscalYear.start_date,
        end_date: fiscalYear.end_date
      }
    };
  } catch (e) {
    console.error('[FISCAL_YEAR_CHECK] Error checking fiscal year:', e);
    return {
      canCreate: false,
      reason: 'خطأ في التحقق من السنة المالية',
      fiscalYear: null
    };
  }
}

/**
 * Middleware to validate fiscal year before creating entries
 * Use this middleware on routes that create journal entries, invoices, expenses, etc.
 * 
 * Usage:
 * app.post('/api/journal', authenticateToken, authorize('journal', 'create'), 
 *   validateFiscalYear('body.date'), async (req, res) => { ... })
 */
export function validateFiscalYear(datePath = 'body.date') {
  return async (req, res, next) => {
    try {
      // Extract date from request using the path (e.g., 'body.date', 'query.date', etc.)
      const pathParts = datePath.split('.');
      let date = req;
      for (const part of pathParts) {
        date = date?.[part];
      }

      if (!date) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'يرجى تحديد التاريخ'
        });
      }

      const check = await checkFiscalYearForDate(date);
      
      if (!check.canCreate) {
        return res.status(403).json({
          error: 'fiscal_year_closed',
          message: check.reason || 'السنة المالية مغلقة',
          fiscalYear: check.fiscalYear
        });
      }

      // Attach fiscal year info to request for later use
      req.fiscalYear = check.fiscalYear;
      next();
    } catch (e) {
      console.error('[FISCAL_YEAR_CHECK] Middleware error:', e);
      res.status(500).json({
        error: 'server_error',
        message: 'خطأ في التحقق من السنة المالية'
      });
    }
  };
}
