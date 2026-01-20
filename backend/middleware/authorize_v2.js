import { pool } from "../db.js";

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

/**
 * Check if user has permission for a specific screen and action
 * Uses new role-based permission system
 */
async function checkPermission(userId, roleId, screenCode, actionCode) {
  // CRITICAL: pool is guaranteed to exist - PostgreSQL connection verified at startup
  }

  try {
    // Admin bypass - check if user has admin role
    if (roleId) {
      const { rows: roleCheck } = await pool.query(
        'SELECT name FROM roles WHERE id = $1',
        [roleId]
      );
      if (roleCheck.length > 0 && normalize(roleCheck[0].name) === 'admin') {
        return true; // Admin has all permissions
      }
    }

    // Check role permissions
    const { rows: rolePerms } = await pool.query(`
      SELECT rp.role_id
      FROM role_permissions rp
      INNER JOIN screens s ON rp.screen_id = s.id
      INNER JOIN actions a ON rp.action_id = a.id
      WHERE rp.role_id = $1 
        AND LOWER(s.code) = $2 
        AND LOWER(a.code) = $3
      LIMIT 1
    `, [roleId, normalize(screenCode), normalize(actionCode)]);

    if (rolePerms.length > 0) {
      return true; // Role has permission
    }

    // Check user-specific permissions (overrides)
    const { rows: userPerms } = await pool.query(`
      SELECT up.allowed
      FROM user_permissions_new up
      INNER JOIN screens s ON up.screen_id = s.id
      INNER JOIN actions a ON up.action_id = a.id
      WHERE up.user_id = $1 
        AND LOWER(s.code) = $2 
        AND LOWER(a.code) = $3
        AND up.allowed = true
      LIMIT 1
    `, [userId, normalize(screenCode), normalize(actionCode)]);

    return userPerms.length > 0;
  } catch (error) {
    console.error('[AUTHORIZE_V2] Error checking permission:', error);
    return false;
  }
}

/**
 * Log permission check to audit_log
 */
async function logPermissionCheck(userId, screenCode, actionCode, allowed, req) {
  // CRITICAL: pool is guaranteed to exist - PostgreSQL connection verified at startup

  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await pool.query(`
      INSERT INTO audit_log (user_id, screen_code, action_code, allowed, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, screenCode, actionCode, allowed, ipAddress, userAgent]);
  } catch (error) {
    console.error('[AUTHORIZE_V2] Error logging audit:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * New authorize middleware using role-based permission system
 * 
 * @param {string} screen - Screen code (e.g., 'clients', 'employees')
 * @param {string} action - Action code (e.g., 'view', 'create', 'edit')
 * @param {object} options - Optional configuration
 */
export function authorize(screen, action, options = {}) {
  return async (req, res, next) => {
    try {
      const sc = normalize(screen);
      const ac = normalize(action);
      const userId = req.user?.id || null;
      const roleId = req.user?.role_id || null;
      const method = req.method || 'UNKNOWN';
      const path = req.path || req.url || 'UNKNOWN';

      console.log(`[AUTHORIZE_V2] ${method} ${path} | screen=${sc} action=${ac} userId=${userId} roleId=${roleId}`);

      if (!req.user) {
        console.log(`[AUTHORIZE_V2] REJECTED: No user | ${method} ${path}`);
        await logPermissionCheck(userId, sc, ac, false, req);
        return res.status(401).json({ error: 'unauthorized' });
      }

      // Check permission
      const allowed = await checkPermission(userId, roleId, sc, ac);

      // Log the check
      await logPermissionCheck(userId, sc, ac, allowed, req);

      if (!allowed) {
        console.log(`[AUTHORIZE_V2] REJECTED: Permission denied | userId=${userId} screen=${sc} action=${ac}`);
        return res.status(403).json({ 
          error: 'forbidden', 
          required: `${sc}:${ac}`,
          message: 'You do not have permission to perform this action'
        });
      }

      console.log(`[AUTHORIZE_V2] ALLOWED: Permission granted | userId=${userId} screen=${sc} action=${ac}`);
      return next();
    } catch (error) {
      console.error(`[AUTHORIZE_V2] ERROR: ${error?.message || 'unknown'}`, error);
      return res.status(500).json({ error: 'server_error', details: error?.message || 'unknown' });
    }
  };
}

/**
 * Check if user has permission (for use in routes/handlers)
 */
export async function hasPermission(userId, roleId, screenCode, actionCode) {
  return await checkPermission(userId, roleId, screenCode, actionCode);
}
