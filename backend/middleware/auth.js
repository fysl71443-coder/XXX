import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export async function authenticateToken(req, res, next) {
  try {
    const method = req.method || 'UNKNOWN'
    const path = req.path || req.url || 'UNKNOWN'
    
    // CRITICAL: Skip authentication for static assets and public paths
    // Static files (JS chunks, CSS, images, etc.) should never require authentication
    // This prevents React from failing to load chunks when navigating to routes
    const staticPaths = [
      '/static',
      '/favicon.ico',
      '/manifest.json',
      '/robots.txt',
      '/logo',
      '.js',
      '.css',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot'
    ];
    
    // Check if this is a static file request
    const isStaticFile = staticPaths.some(staticPath => 
      path.startsWith(staticPath) || path.endsWith(staticPath)
    );
    
    if (isStaticFile) {
      // Skip authentication for static files - let express.static handle them
      return next();
    }
    
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
    
    // Load user - simplified without role_id dependency
    // We use role-based admin bypass, not role_id-based
    const { rows } = await pool.query(
      'SELECT id, email, role, default_branch, created_at FROM "users" WHERE id = $1 LIMIT 1', 
      [payload.id]
    );
    const user = rows && rows[0];
    
    if (!user) {
      console.log(`[AUTH] REJECTED: User not found | userId=${payload.id} ${method} ${path}`)
      return res.status(401).json({ error: "unauthorized" });
    }
    
    // Simple admin check based on role field only
    const role = String(user.role || '').toLowerCase();
    const isAdmin = role === 'admin';
    
    console.log(`[AUTH] SUCCESS: User authenticated | userId=${user.id} email=${user.email} role=${user.role} isAdmin=${isAdmin} ${method} ${path}`)
    
    // Attach user to request with simplified structure
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      default_branch: user.default_branch,
      created_at: user.created_at,
      isAdmin: isAdmin // Simple boolean flag
    };
    
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
