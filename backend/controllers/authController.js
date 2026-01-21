import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Helper function to load user permissions map
 */
async function loadUserPermissionsMap(userId) {
  const { rows } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [userId]);
  const map = {};
  for (const r of rows || []) {
    const sc = String(r.screen_code || '').toLowerCase();
    const br = String(r.branch_code || '');
    const ac = String(r.action_code || '').toLowerCase();
    map[sc] = map[sc] || { _global: {} };
    if (!br) {
      map[sc]._global[ac] = !!r.allowed;
    } else {
      map[sc][br] = map[sc][br] || {};
      map[sc][br][ac] = !!r.allowed;
    }
  }
  return map;
}

/**
 * Login
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    console.log(`[LOGIN] ====== NEW LOGIN ATTEMPT ======`);
    console.log(`[LOGIN] Method: ${req.method}`);
    console.log(`[LOGIN] Path: ${req.path}`);
    console.log(`[LOGIN] Content-Type: ${req.headers['content-type'] || 'NOT SET'}`);
    console.log(`[LOGIN] Raw body type: ${typeof req.body}`);
    console.log(`[LOGIN] Raw body:`, req.body);
    console.log(`[LOGIN] Body keys:`, req.body ? Object.keys(req.body) : 'NO BODY');
    
    const { email, password } = req.body || {};
    console.log(`[LOGIN] Extracted email: ${email || '(empty)'}`);
    console.log(`[LOGIN] Extracted password: ${password ? '***PRESENT***' : '(empty)'}`);
    
    if (!email || !password) {
      console.log(`[LOGIN] ❌ REJECTED: Missing credentials`);
      console.log(`[LOGIN] Email present: ${!!email}`);
      console.log(`[LOGIN] Password present: ${!!password}`);
      return res.status(400).json({ error: "invalid_credentials" });
    }
    if (!pool) {
      console.error(`[LOGIN] ERROR: DB not configured | email=${email}`)
      return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    }
    const { rows } = await pool.query(
      'SELECT id, email, password, role, default_branch, created_at FROM "users" WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = rows && rows[0];
    if (!user) {
      console.log(`[LOGIN] REJECTED: User not found | email=${email}`)
      return res.status(404).json({ error: "not_found" });
    }
    const ok = await bcrypt.compare(String(password), String(user.password || ""));
    if (!ok) {
      console.log(`[LOGIN] REJECTED: Invalid password | userId=${user.id} email=${email}`)
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role || "user" }, String(JWT_SECRET), { expiresIn: "12h" });
    let perms = {};
    try { perms = await loadUserPermissionsMap(user.id) } catch (permErr) {
      console.error(`[LOGIN] ERROR loading permissions | userId=${user.id}`, permErr?.message)
    }
    const screens = Object.entries(perms || {}).filter(([_, v]) => {
      const g = v?._global || {};
      if (Object.values(g).some(Boolean)) return true;
      return Object.values(v || {}).filter((_, k) => k !== '_global').some(obj => Object.values(obj || {}).some(Boolean));
    }).map(([k]) => k);
    const branches = (function(){
      const keys = Object.keys(perms || {}).reduce((acc, sc) => {
        for (const [b, obj] of Object.entries(perms[sc] || {})) {
          if (b === '_global') continue;
          if (Object.values(obj || {}).some(Boolean)) acc.add(String(b));
        }
        return acc;
      }, new Set());
      const arr = Array.from(keys);
      if (arr.length) return arr;
      const def = String(user.default_branch || '').trim() || 'china_town';
      return [def];
    })();
    console.log(`[LOGIN] SUCCESS | userId=${user.id} email=${email} role=${user.role} screens=${screens.length} branches=${branches.length}`)
    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role || "user", default_branch: user.default_branch || null, created_at: user.created_at },
      screens,
      branches
    });
  } catch (e) {
    console.error(`[LOGIN] ERROR: ${e?.message || 'unknown'}`, e?.stack)
    return res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get current user
 * GET /api/auth/me
 */
export async function me(req, res) {
  try {
    const user = req.user;
    if (!user) {
      console.error('[AUTH/ME] No user in request after authentication');
      return res.status(401).json({ error: "unauthorized" });
    }
    
    // Return user data ONLY - no permissions, no complex logic
    // Authentication is separate from Authorization
    // Simple admin check based on role field only (no role_id dependency)
    const role = String(user.role || '').toLowerCase();
    const isAdmin = role === 'admin';
    
    const response = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      default_branch: user.default_branch || null,
      created_at: user.created_at,
      isAdmin: isAdmin // Simple boolean flag
    };
    
    console.log(`[AUTH/ME] SUCCESS | userId=${user.id} email=${user.email} role=${user.role} isAdmin=${response.isAdmin}`);
    res.json(response);
  } catch (e) {
    console.error(`[AUTH/ME] ERROR: ${e?.message || 'unknown'}`, e);
    // Even on error, if user exists, return it - don't fail auth due to other issues
    if (req.user) {
      const role = String(req.user.role || '').toLowerCase();
      return res.json({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role || 'user',
        default_branch: req.user.default_branch,
        created_at: req.user.created_at,
        isAdmin: role === 'admin'
      });
    }
    return res.status(401).json({ error: "unauthorized" });
  }
}
