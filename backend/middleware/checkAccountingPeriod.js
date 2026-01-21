import { pool } from "../db.js";

/**
 * Middleware to check if accounting period is OPEN before allowing creation/modification
 * Returns 403 if period is CLOSED
 * Returns 400 if period is not defined (optional - can use get-or-create pattern)
 * 
 * @param {Object} options
 * @param {boolean} options.requirePeriod - If true, returns 400 if period not found. Default: false (uses get-or-create)
 * @param {Function} options.getPeriodFromRequest - Function to extract period from request. Default: extracts from req.body.date or uses current month
 * @param {boolean} options.allowWithPermission - If true, allows operation in closed period if user has 'journal.override_period' permission
 * @param {string} options.action - Action type for logging ('create', 'edit', 'post', 'reverse', 'delete')
 */
export function checkAccountingPeriod(options = {}) {
  const { 
    requirePeriod = false, 
    getPeriodFromRequest = null,
    allowWithPermission = false,
    action = 'modify'
  } = options;

  return async function(req, res, next) {
    try {
      // Get period from request (date) or use current month
      let period;
      
      if (getPeriodFromRequest && typeof getPeriodFromRequest === 'function') {
        period = getPeriodFromRequest(req);
      } else {
        // Default: Extract from req.body.date or use current date
        const date = req.body?.date || new Date();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        period = dateObj.toISOString().slice(0, 7); // YYYY-MM
      }

      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        console.error(`[ISSUE FAILED] Invalid period format:`, {
          period: period || null,
          endpoint: req.path || req.url,
          action: action
        });
        console.warn(`[PERIODS] Invalid period format: ${period}`);
        return res.status(400).json({
          error: "INVALID_PERIOD_FORMAT",
          error_ar: "صيغة الفترة غير صحيحة",
          details: "Period must be in YYYY-MM format",
          details_ar: "يجب أن تكون الفترة بصيغة YYYY-MM",
          period: period || null
        });
      }

      // Get period status from database
      const { rows } = await pool.query(
        'SELECT id, period, status, opened_at, closed_at, locked_by FROM accounting_periods WHERE period = $1 LIMIT 1',
        [period]
      );

      const periodData = rows && rows[0];

      // If period doesn't exist
      if (!periodData) {
        if (requirePeriod) {
          // Strict mode: Period must exist
          console.error(`[ISSUE FAILED] Accounting period not found (requirePeriod=true):`, {
            period: period,
            endpoint: req.path || req.url,
            action: action
          });
          console.warn(`[PERIODS] Period ${period} not found (requirePeriod=true)`);
          return res.status(400).json({
            error: "ACCOUNTING_PERIOD_NOT_DEFINED",
            error_ar: "الفترة المحاسبية غير معرفة",
            details: `Accounting period ${period} is not defined`,
            details_ar: `الفترة المحاسبية ${period} غير معرفة`,
            period: period
          });
        } else {
          // Auto-create mode: Create period with OPEN status
          console.log(`[PERIODS] Period ${period} not found, auto-creating with OPEN status`);
          
          try {
            const insertResult = await pool.query(
              `INSERT INTO accounting_periods(period, status, opened_at) 
               VALUES ($1, $2, NOW()) 
               ON CONFLICT (period) DO UPDATE SET period = EXCLUDED.period
               RETURNING id, period, status, opened_at, closed_at`,
              [period, 'open']
            );
            
            const newPeriod = insertResult.rows && insertResult.rows[0];
            if (newPeriod && newPeriod.status === 'open') {
              console.log(`[PERIODS] Auto-created period ${period} with OPEN status`);
              req.accountingPeriod = newPeriod; // Attach period info to request
              return next(); // Period created and open - allow request
            }
          } catch (createError) {
            console.error(`[PERIODS] Failed to auto-create period ${period}:`, createError);
            return res.status(500).json({
              error: "PERIOD_CREATE_FAILED",
              error_ar: "فشل إنشاء الفترة المحاسبية",
              details: `Failed to create accounting period ${period}`,
              period: period
            });
          }
        }
      }

      // Check if period is closed
      if (periodData && periodData.status && String(periodData.status).toLowerCase() === 'closed') {
        
        // Check if user has override permission
        if (allowWithPermission && req.user?.permissions) {
          const hasOverride = req.user.permissions.includes('journal.override_period') || 
                              req.user.permissions.includes('admin') ||
                              req.user.role === 'admin';
          
          if (hasOverride) {
            console.log(`[PERIODS] User ${req.user?.id || 'unknown'} has override permission for closed period ${period}`);
            req.accountingPeriod = periodData;
            req.periodOverridden = true; // Flag that period was overridden
            
            // Log the override for audit
            try {
              await pool.query(
                `INSERT INTO accounting_audit_log(user_id, action, entity_type, entity_id, period, details, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                  req.user?.id || null,
                  'period_override',
                  'accounting_period',
                  periodData.id,
                  period,
                  JSON.stringify({
                    action: action,
                    endpoint: req.path || req.url,
                    reason: req.body?.override_reason || 'Permission override'
                  })
                ]
              );
            } catch (logError) {
              // Silently ignore if audit table doesn't exist
              console.warn('[PERIODS] Could not log period override:', logError.message);
            }
            
            return next();
          }
        }
        
        console.error(`[ISSUE FAILED] Accounting period closed:`, {
          period: period,
          status: periodData.status,
          closed_at: periodData.closed_at,
          locked_by: periodData.locked_by,
          endpoint: req.path || req.url,
          action: action,
          user_id: req.user?.id || 'unknown'
        });
        console.warn(`[PERIODS] Attempt to ${action} in closed period ${period} by user ${req.user?.id || 'unknown'}`);
        
        return res.status(403).json({
          error: "ACCOUNTING_PERIOD_CLOSED",
          error_ar: "الفترة المحاسبية مقفلة",
          details: `Accounting period ${period} is closed. No modifications allowed.`,
          details_ar: `الفترة المحاسبية ${period} مقفلة. لا يمكن إجراء أي تعديلات.`,
          period: period,
          closed_at: periodData.closed_at,
          locked_by: periodData.locked_by,
          action_attempted: action
        });
      }

      // Period exists and is open - allow request
      console.log(`[PERIODS] Period check passed:`, {
        period: period,
        status: periodData?.status || 'open',
        endpoint: req.path || req.url,
        action: action
      });
      
      req.accountingPeriod = periodData; // Attach period info to request
      next();
    } catch (e) {
      console.error('[PERIODS] Error checking accounting period:', e);
      res.status(500).json({
        error: "PERIOD_CHECK_FAILED",
        error_ar: "فشل التحقق من الفترة المحاسبية",
        details: e?.message || "Failed to check accounting period"
      });
    }
  };
}

/**
 * Check if a specific journal entry's period is locked
 * Used before operations on existing entries (reverse, delete, return-to-draft)
 */
export async function isEntryPeriodLocked(entryId, userId = null) {
  try {
    const { rows } = await pool.query(
      `SELECT je.id, je.period, je.date, ap.status as period_status, ap.closed_at
       FROM journal_entries je
       LEFT JOIN accounting_periods ap ON ap.period = je.period
       WHERE je.id = $1`,
      [entryId]
    );
    
    if (!rows || !rows[0]) {
      return { locked: false, reason: 'entry_not_found' };
    }
    
    const entry = rows[0];
    
    if (entry.period_status && String(entry.period_status).toLowerCase() === 'closed') {
      return {
        locked: true,
        reason: 'period_closed',
        period: entry.period,
        closed_at: entry.closed_at
      };
    }
    
    return { locked: false, period: entry.period };
  } catch (e) {
    console.error('[PERIODS] Error checking entry period lock:', e);
    return { locked: false, error: e.message };
  }
}