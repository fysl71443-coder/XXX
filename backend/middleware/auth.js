import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { isAdminUser } from "../utils/auth.js";
import { parseIntStrict } from "../utils/validation.js";
import { cache } from "../utils/cache.js";

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
    
    // CRITICAL: Validate payload.id is a valid integer to prevent NaN errors
    const userId = parseIntStrict(payload.id);
    if (userId === null || userId <= 0) {
      console.error(`[AUTH] REJECTED: Invalid user ID in token | payload.id=${payload.id} | ${method} ${path}`);
      const acceptsJson = req.headers['accept']?.includes('application/json');
      const isApiRequest = path.startsWith('/api/') || acceptsJson || req.headers['x-requested-with'] === 'XMLHttpRequest';
      if (isApiRequest) {
        return res.status(401).json({ error: "unauthorized", details: "Invalid token payload" });
      } else {
        const redirectUrl = `/login?next=${encodeURIComponent(path)}`;
        return res.redirect(redirectUrl);
      }
    }
    
    // CRITICAL: pool is guaranteed to exist - PostgreSQL connection verified at startup
    // If pool is null here, it means application started incorrectly - this should never happen
    if (!pool) {
      console.error('[AUTH] CRITICAL: Database pool is null - this should never happen');
      console.error('[AUTH] PostgreSQL connection was verified at startup');
      return res.status(500).json({ error: "database_error", details: "Database connection not available" });(`[AUTH] ERROR: DB not configured | ${method} ${path}`)
      return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    }
    
    // PERFORMANCE: Cache user data to reduce DB queries
    // User data is cached for 10 minutes
    const userCacheKey = `user_${userId}`;
    let user = cache.get(userCacheKey);
    
    if (!user) {
      // Load user - simplified without role_id dependency
      // We use role-based admin bypass, not role_id-based
      const { rows } = await pool.query(
        'SELECT id, email, role, default_branch, created_at FROM "users" WHERE id = $1 LIMIT 1', 
        [userId]
      );
      user = rows && rows[0];
      
      // Cache user for 10 minutes
      if (user) {
        cache.set(userCacheKey, user, 10 * 60 * 1000);
      }
    }
    
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
    // Permissions are loaded once at login time in AuthContext and sent with every request in header
    // This avoids database queries on every API call
    try {
      const permissionsHeader = req.headers['x-user-permissions'];
      if (permissionsHeader) {
        try {
          const permissionsMap = JSON.parse(permissionsHeader);
          req.user.permissionsMap = permissionsMap;
          console.log(`[AUTH] Permissions loaded from header | userId=${user.id} screens=${Object.keys(permissionsMap).length}`);
        } catch (parseErr) {
          console.warn(`[AUTH] Failed to parse permissions header:`, parseErr?.message);
          req.user.permissionsMap = null; // Will be loaded on-demand if needed
        }
      } else {
        req.user.permissionsMap = null; // Will be loaded on-demand if needed
      }
    } catch {
      req.user.permissionsMap = null; // Will be loaded on-demand if needed
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
