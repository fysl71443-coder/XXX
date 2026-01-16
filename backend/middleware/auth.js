import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { isAdminUser } from "../utils/auth.js";

export async function authenticateToken(req, res, next) {
  try {
    const method = req.method || 'UNKNOWN'
    const path = req.path || req.url || 'UNKNOWN'
    
    // CRITICAL: Skip authentication for static assets and public paths
    // Static files (JS chunks, CSS, images, etc.) should never require authentication
    // This prevents React from failing to load chunks when navigating to routes
    // Must catch paths like /supplier-invoices/static/js/... (React Router lazy loading)
    const staticPaths = [
      '/static/',          // Matches /static/... and /supplier-invoices/static/...
      '/favicon.ico',
      '/manifest.json',
      '/robots.txt',
      '/logo',
      '.js',               // Matches any .js file
      '.css',              // Matches any .css file
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
      '.map'               // Source maps
    ];
    
    // Check if this is a static file request
    // For paths like '/static/', check if path includes it anywhere
    // For extensions like '.js', check if path ends with it
    const isStaticFile = staticPaths.some(staticPath => {
      if (staticPath.startsWith('/')) {
        // Path pattern - check if path includes it anywhere
        return path.includes(staticPath);
      } else {
        // Extension pattern - check if path ends with it
        return path.endsWith(staticPath);
      }
    });
    
    if (isStaticFile) {
      // Skip authentication for static files - let express.static handle them
      return next();
    }
    
    const authHeader = req.headers["authorization"] || "";
    const parts = authHeader.split(" ");
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    
    if (!token) {
      console.log(`[AUTH] REJECTED: No token | ${method} ${path}`)
      
      // Check if this is an API request (JSON) or a page request (HTML)
      // API requests should get JSON response, page requests should redirect
      const acceptsJson = req.headers['accept']?.includes('application/json');
      const isApiRequest = path.startsWith('/api/') || acceptsJson || req.headers['x-requested-with'] === 'XMLHttpRequest';
      
      if (isApiRequest) {
        // API request - return JSON error
        return res.status(401).json({ error: "unauthorized" });
      } else {
        // Page request - redirect to login (preserve intended destination)
        const redirectUrl = `/login?next=${encodeURIComponent(path)}`;
        console.log(`[AUTH] Redirecting to login: ${redirectUrl}`);
        return res.redirect(redirectUrl);
      }
    }
    
    const payload = jwt.verify(token, String(process.env.JWT_SECRET));
    if (!payload?.id) {
      console.log(`[AUTH] REJECTED: Invalid token payload | ${method} ${path}`)
      
      // Check if this is an API request or page request
      const acceptsJson = req.headers['accept']?.includes('application/json');
      const isApiRequest = path.startsWith('/api/') || acceptsJson || req.headers['x-requested-with'] === 'XMLHttpRequest';
      
      if (isApiRequest) {
        return res.status(401).json({ error: "unauthorized" });
      } else {
        const redirectUrl = `/login?next=${encodeURIComponent(path)}`;
        return res.redirect(redirectUrl);
      }
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
      
      // Check if this is an API request or page request
      const acceptsJson = req.headers['accept']?.includes('application/json');
      const isApiRequest = path.startsWith('/api/') || acceptsJson || req.headers['x-requested-with'] === 'XMLHttpRequest';
      
      if (isApiRequest) {
        return res.status(401).json({ error: "unauthorized" });
      } else {
        const redirectUrl = `/login?next=${encodeURIComponent(path)}`;
        return res.redirect(redirectUrl);
      }
    }
    
    // Use centralized admin check
    const isAdmin = isAdminUser(user);
    
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
    
    // Check if this is an API request or page request
    const acceptsJson = req.headers['accept']?.includes('application/json');
    const isApiRequest = path.startsWith('/api/') || acceptsJson || req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiRequest) {
      return res.status(401).json({ error: "unauthorized" });
    } else {
      const redirectUrl = `/login?next=${encodeURIComponent(path)}`;
      return res.redirect(redirectUrl);
    }
  }
}
