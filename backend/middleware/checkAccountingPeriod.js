import { pool } from "../db.js";

/**
 * Middleware to check if accounting period is OPEN before allowing creation/modification
 * Returns 403 if period is CLOSED
 * Returns 400 if period is not defined (optional - can use get-or-create pattern)
 * 
 * @param {Object} options
 * @param {boolean} options.requirePeriod - If true, returns 400 if period not found. Default: false (uses get-or-create)
 * @param {Function} options.getPeriodFromRequest - Function to extract period from request. Default: extracts from req.body.date or uses current month
 */
export function checkAccountingPeriod(options = {}) {
  const { requirePeriod = false, getPeriodFromRequest = null } = options;

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
          endpoint: req.path || req.url
        });
        console.warn(`[PERIODS] Invalid period format: ${period}`);
        return res.status(400).json({
          error: "INVALID_PERIOD_FORMAT",
          details: "Period must be in YYYY-MM format",
          period: period || null
        });
      }

      // Get period status from database
      const { rows } = await pool.query(
        'SELECT id, period, status, opened_at, closed_at FROM accounting_periods WHERE period = $1 LIMIT 1',
        [period]
      );

      const periodData = rows && rows[0];

      // If period doesn't exist
      if (!periodData) {
        if (requirePeriod) {
          // Strict mode: Period must exist
          console.error(`[ISSUE FAILED] Accounting period not found (requirePeriod=true):`, {
            period: period,
            endpoint: req.path || req.url
          });
          console.warn(`[PERIODS] Period ${period} not found (requirePeriod=true)`);
          return res.status(400).json({
            error: "ACCOUNTING_PERIOD_NOT_DEFINED",
            details: `Accounting period ${period} is not defined`,
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
              return next(); // Period created and open - allow request
            }
          } catch (createError) {
            console.error(`[PERIODS] Failed to auto-create period ${period}:`, createError);
            return res.status(500).json({
              error: "PERIOD_CREATE_FAILED",
              details: `Failed to create accounting period ${period}`,
              period: period
            });
          }
        }
      }

      // Check if period is closed
      if (periodData.status && String(periodData.status).toLowerCase() === 'closed') {
        console.error(`[ISSUE FAILED] Accounting period closed:`, {
          period: period,
          status: periodData.status,
          closed_at: periodData.closed_at,
          endpoint: req.path || req.url
        });
        console.warn(`[PERIODS] Attempt to modify closed period ${period}`);
        return res.status(403).json({
          error: "ACCOUNTING_PERIOD_CLOSED",
          details: `Accounting period ${period} is closed. No modifications allowed.`,
          period: period,
          closed_at: periodData.closed_at
        });
      }

      // Period exists and is open - allow request
      console.log(`[PERIODS] Period check passed:`, {
        period: period,
        status: periodData.status || 'open',
        endpoint: req.path || req.url
      });
      next();
    } catch (e) {
      console.error('[PERIODS] Error checking accounting period:', e);
      res.status(500).json({
        error: "PERIOD_CHECK_FAILED",
        details: e?.message || "Failed to check accounting period"
      });
    }
  };
}