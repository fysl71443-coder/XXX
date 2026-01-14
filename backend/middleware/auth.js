import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export async function authenticateToken(req, res, next) {
  try {
    const method = req.method || 'UNKNOWN'
    const path = req.path || req.url || 'UNKNOWN'
    const authHeader = req.headers["authorization"] || "";
    const parts = authHeader.split(" ");
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    
    if (!token) {
      console.log(`[AUTH] REJECTED: No token | ${method} ${path}`)
      return res.status(401).json({ error: "unauthorized" });
    }
    
    const payload = jwt.verify(token, String(process.env.JWT_SECRET));
    if (!payload?.id) {
      console.log(`[AUTH] REJECTED: Invalid token payload | ${method} ${path}`)
      return res.status(401).json({ error: "unauthorized" });
    }
    
    if (!pool) {
      console.error(`[AUTH] ERROR: DB not configured | ${method} ${path}`)
      return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    }
    
    // Load user - handle role_id column gracefully if it doesn't exist yet
    let user;
    try {
      // Try to load with role_id first (new system)
      const { rows } = await pool.query(
        'SELECT id, email, role, role_id, default_branch, created_at FROM "users" WHERE id = $1 LIMIT 1', 
        [payload.id]
      );
      user = rows && rows[0];
    } catch (colErr) {
      // If role_id column doesn't exist, load without it (backward compatibility)
      if (colErr.message && colErr.message.includes('role_id')) {
        console.warn(`[AUTH] role_id column not found, loading user without it | userId=${payload.id}`);
        const { rows } = await pool.query(
          'SELECT id, email, role, default_branch, created_at FROM "users" WHERE id = $1 LIMIT 1', 
          [payload.id]
        );
        user = rows && rows[0];
        if (user) {
          user.role_id = null; // Set to null if column doesn't exist
        }
      } else {
        throw colErr; // Re-throw if it's a different error
      }
    }
    
    if (!user) {
      console.log(`[AUTH] REJECTED: User not found | userId=${payload.id} ${method} ${path}`)
      return res.status(401).json({ error: "unauthorized" });
    }
    
    // If user has old role but no role_id, try to migrate (only if roles table exists)
    if (user.role && !user.role_id) {
      try {
        // Check if roles table exists first
        const { rows: tableCheck } = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'roles'
          )
        `);
        
        if (tableCheck[0].exists) {
          // Try to add role_id column if it doesn't exist
          try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL');
            console.log(`[AUTH] Added role_id column to users table`);
          } catch (alterErr) {
            // Column might already exist or migration in progress - ignore
            if (!alterErr.message.includes('already exists')) {
              console.warn(`[AUTH] Could not add role_id column: ${alterErr.message}`);
            }
          }
          
          // Now try to migrate role
          const { rows: roleRows } = await pool.query(
            'SELECT id FROM roles WHERE LOWER(name) = $1 LIMIT 1',
            [String(user.role).toLowerCase()]
          );
          if (roleRows.length > 0) {
            await pool.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleRows[0].id, user.id]);
            user.role_id = roleRows[0].id;
            console.log(`[AUTH] Migrated user role to role_id | userId=${user.id} role_id=${user.role_id}`);
          }
        }
      } catch (migrateErr) {
        // Migration failure is non-critical - user can still authenticate
        console.warn(`[AUTH] Role migration failed (non-critical): ${migrateErr.message}`);
      }
    }
    
    console.log(`[AUTH] SUCCESS: User authenticated | userId=${user.id} email=${user.email} role=${user.role} role_id=${user.role_id} ${method} ${path}`)
    req.user = user;
    
    // CRITICAL: Permission loading is OPTIONAL and should NEVER fail authentication
    // Authentication (who you are) is separate from Authorization (what you can do)
    // If permission loading fails, user is still authenticated
    // Permissions will be checked later in authorize middleware when needed
    try {
      const { rows: pr } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [user.id]);
      const map = {};
      for (const r of pr || []) {
        const sc = String(r.screen_code||'').toLowerCase();
        const br = String(r.branch_code||'');
        const ac = String(r.action_code||'').toLowerCase();
        map[sc] = map[sc] || { _global: {} };
        if (!br) { map[sc]._global[ac] = !!r.allowed }
        else {
          map[sc][br] = map[sc][br] || {};
          map[sc][br][ac] = !!r.allowed;
        }
      }
      req.user.permissionsMap = map;
      const permCount = Object.keys(map).length
      const globalPerms = Object.values(map).reduce((sum, v) => sum + Object.keys(v._global || {}).length, 0)
      console.log(`[AUTH] Permissions loaded (optional) | userId=${user.id} screens=${permCount} globalActions=${globalPerms}`)
    } catch (permErr) {
      // Permission loading failure does NOT fail authentication
      // Admin doesn't need permissions anyway (bypass)
      // Regular users will be checked in authorize middleware
      console.warn(`[AUTH] Permission loading failed (non-critical) | userId=${user.id}`, permErr?.message)
      req.user.permissionsMap = {}; // Empty map is fine - will be checked later if needed
    }
    
    next();
  } catch (e) {
    const method = req.method || 'UNKNOWN'
    const path = req.path || req.url || 'UNKNOWN'
    console.error(`[AUTH] ERROR: ${e?.message || 'unknown'} | ${method} ${path}`, e?.stack)
    return res.status(401).json({ error: "unauthorized" });
  }
}
