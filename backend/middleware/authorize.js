import { pool } from "../db.js";
import { isAdminUser } from "../utils/auth.js";

function normalize(str){ return String(str||'').trim().toLowerCase() }

async function ensurePermissionsMap(req){
  // OPTIMIZATION: Permissions are loaded at login and sent with every request in header
  // No database query needed - just use the cached permissions from req.user.permissionsMap
  if (req.user && req.user.permissionsMap) {
    return req.user.permissionsMap;
  }
  
  // If permissions are not available (should not happen if login worked correctly),
  // return empty map - user will be denied access
  console.warn(`[AUTHORIZE] No permissions found for user ${req.user?.id} - permissions should be loaded at login`);
  return {};
}

export function authorize(screen, action, options = {}) {
  return async (req, res, next) => {
    try {
      const method = req.method || 'UNKNOWN'
      const path = req.path || req.url || 'UNKNOWN'
      
      // CRITICAL: Skip authorization for static assets and non-API paths
      // Authorization should ONLY apply to API endpoints, not frontend routes or static files
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
      
      // CRITICAL: Only apply authorization to API endpoints
      // Frontend routes (like /supplier-invoices/new) should NOT be authorized here
      // They are protected by React Router's ProtectedRoute component
      const isApiEndpoint = path.startsWith('/api/') || 
                           (req.headers['content-type']?.includes('application/json')) ||
                           (req.headers['accept']?.includes('application/json'));
      
      // Skip authorization for static files and non-API frontend routes
      if (isStaticFile || !isApiEndpoint) {
        // This is a frontend route or static file - let it pass through
        // React Router will handle protection on the frontend
        return next();
      }
      
      // Check authentication first (only for API endpoints)
      if (!req.user) {
        console.log(`[AUTHORIZE] REJECTED: No user | ${method} ${path}`)
        return res.status(401).json({ error: 'unauthorized' })
      }
      
      // Admin bypass - return immediately, no permission checks needed
      // Use centralized admin check
      const isAdmin = isAdminUser(req.user);
      
      if (isAdmin) {
        const userId = req.user?.id || 'anon'
        const sc = normalize(screen)
        const ac = normalize(action)
        console.log(`[AUTHORIZE] ALLOWED: Admin bypass | userId=${userId} screen=${sc} action=${ac} ${method} ${path}`)
        return next() // Admin bypass - skip all permission checks
      }
      
      // For non-admin users, proceed with permission checks
      const sc = normalize(screen)
      const ac = normalize(action)
      const userId = req.user?.id || 'anon'
      
      console.log(`[AUTHORIZE] ${method} ${path} | screen=${sc} action=${ac} userId=${userId}`)
      
      const perms = await ensurePermissionsMap(req)
      const p = perms[sc] || null
      
      if (!p) {
        console.log(`[AUTHORIZE] REJECTED: No permissions for screen | userId=${userId} screen=${sc} action=${ac} | Available screens: ${Object.keys(perms).join(',') || 'none'}`)
        return res.status(403).json({ error: 'forbidden', required: `${sc}:${ac}` })
      }
      
      if ((p._global || {})[ac] === true) {
        console.log(`[AUTHORIZE] ALLOWED: Global permission | userId=${userId} screen=${sc} action=${ac}`)
        return next()
      }
      
      const branch =
        (typeof options.branchFrom === 'function' ? options.branchFrom(req) : null) ||
        req.body?.branch ||
        req.query?.branch ||
        req.user?.default_branch ||
        ''
      
      console.log(`[AUTHORIZE] Checking branch permission | userId=${userId} screen=${sc} action=${ac} branch=${branch || '(empty)'}`)
      
      if (!branch) {
        console.log(`[AUTHORIZE] REJECTED: Branch required but not provided | userId=${userId} screen=${sc} action=${ac}`)
        return res.status(400).json({ error: 'branch_required' })
      }
      
      const bp = p[String(branch)] || null
      if (!bp || bp[ac] !== true) {
        console.log(`[AUTHORIZE] REJECTED: No branch permission | userId=${userId} screen=${sc} action=${ac} branch=${branch} | Available branches: ${Object.keys(p).filter(k => k !== '_global').join(',') || 'none'}`)
        return res.status(403).json({ error: 'forbidden', required: `${sc}:${ac}:${branch}` })
      }
      
      console.log(`[AUTHORIZE] ALLOWED: Branch permission | userId=${userId} screen=${sc} action=${ac} branch=${branch}`)
      return next()
    } catch (e) {
      console.error(`[AUTHORIZE] ERROR: ${e?.message || 'unknown'}`, e?.stack)
      return res.status(500).json({ error: 'server_error', details: e?.message || 'unknown' })
    }
  }
}
