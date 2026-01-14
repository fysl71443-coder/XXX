import { pool } from "../db.js";

function normalize(str){ return String(str||'').trim().toLowerCase() }

async function ensurePermissionsMap(req){
  if (req.user && req.user.permissionsMap) return req.user.permissionsMap
  const id = Number(req.user?.id || 0)
  if (!id) return {}
  const { rows } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [id])
  const map = {}
  for (const r of rows || []) {
    const sc = normalize(r.screen_code)
    const br = String(r.branch_code || '')
    const ac = normalize(r.action_code)
    map[sc] = map[sc] || { _global: {} }
    if (!br) {
      map[sc]._global[ac] = !!r.allowed
    } else {
      map[sc][br] = map[sc][br] || {}
      map[sc][br][ac] = !!r.allowed
    }
  }
  try { if (req.user) req.user.permissionsMap = map } catch {}
  return map
}

export function authorize(screen, action, options = {}) {
  return async (req, res, next) => {
    try {
      const method = req.method || 'UNKNOWN'
      const path = req.path || req.url || 'UNKNOWN'
      
      // CRITICAL: Skip authorization for static assets and non-API paths
      // Authorization should ONLY apply to API endpoints, not frontend routes or static files
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
      const role = normalize(req.user.role)
      if (role === 'admin') {
        const userId = req.user?.id || 'anon'
        const method = req.method || 'UNKNOWN'
        const path = req.path || req.url || 'UNKNOWN'
        const sc = normalize(screen)
        const ac = normalize(action)
        console.log(`[AUTHORIZE] ALLOWED: Admin bypass | userId=${userId} screen=${sc} action=${ac} ${method} ${path}`)
        return next() // Admin bypass - skip all permission checks
      }
      
      // For non-admin users, proceed with permission checks
      const sc = normalize(screen)
      const ac = normalize(action)
      const userId = req.user?.id || 'anon'
      const method = req.method || 'UNKNOWN'
      const path = req.path || req.url || 'UNKNOWN'
      
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
