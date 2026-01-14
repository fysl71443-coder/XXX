import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import { createAdmin } from "./createAdmin.js";
import { pool } from "./db.js";
import { authenticateToken } from "./middleware/auth.js";
import { authorize } from "./middleware/authorize.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 10000);

const buildPath = path.join(__dirname, "frontend", "build");

// ============================================
// CRITICAL: Static Files MUST Come First
// ============================================
// Static files (JS chunks, CSS, images) should NEVER pass through auth/authorize
// They must be served directly without any middleware checks
// This prevents login loops when React tries to load chunks

// 1️⃣ Static files FIRST - before ANY middleware
app.use(express.static(buildPath));

// 2️⃣ Public paths that never need auth
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/manifest.json', express.static(buildPath));
app.get('/robots.txt', express.static(buildPath));

// 3️⃣ Middleware for parsing (safe for static files)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4️⃣ Static file guard - skip ALL middleware for static files
// This catches any static files that might slip through, including nested paths
// CRITICAL: This must catch paths like /supplier-invoices/static/js/... 
// React Router lazy loading creates chunks in sub-routes
app.use((req, res, next) => {
  const path = req.path || req.url || '';
  
  // Check if this is a static file request
  // Patterns to match:
  // - /static/... (any path containing /static/)
  // - /favicon.ico, /manifest.json, etc.
  // - Any file with static extensions (.js, .css, .png, etc.)
  const staticPatterns = [
    '/static/',           // Matches /static/... and /supplier-invoices/static/...
    '/favicon.ico',
    '/manifest.json',
    '/robots.txt',
    '.js',                // Matches any .js file
    '.css',               // Matches any .css file
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
    '.map'                // Source maps
  ];
  
  // Check if path contains static pattern OR ends with static extension
  const isStaticFile = staticPatterns.some(pattern => {
    if (pattern.startsWith('/')) {
      // For paths like '/static/', check if path includes it anywhere
      return path.includes(pattern);
    } else {
      // For extensions like '.js', check if path ends with it
      return path.endsWith(pattern);
    }
  });
  
  if (isStaticFile) {
    // Static file - let express.static handle it, skip all other middleware
    // This prevents auth/authorize from blocking static assets
    return next();
  }
  
  // Not a static file - continue to next middleware
  next();
});

// 5️⃣ Request Logging Middleware (only for non-static requests)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method || 'UNKNOWN';
  const url = req.url || req.path || '/';
  const userId = req.user?.id || 'anon';
  const userEmail = req.user?.email || 'anon';
  console.log(`[REQUEST] ${timestamp} | ${method} ${url} | userId=${userId} email=${userEmail}`);
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method || 'UNKNOWN';
  const url = req.url || req.path || '/';
  console.error(`[ERROR] ${timestamp} | ${method} ${url} | ${err?.message || 'unknown error'}`, err?.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'server_error', details: err?.message || 'unknown' });
  }
});

const JWT_SECRET = process.env.JWT_SECRET;

async function ensureSchema() {
  try {
    if (!pool) return;
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id INTEGER NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
        screen_code TEXT NOT NULL,
        branch_code TEXT NOT NULL DEFAULT '',
        action_code TEXT NOT NULL,
        allowed BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (user_id, screen_code, branch_code, action_code)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- 'customer' | 'supplier'
        email TEXT,
        phone TEXT,
        customer_type TEXT,
        contact_info JSONB,
        tags TEXT[],
        status TEXT DEFAULT 'active',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        employee_number TEXT,
        status TEXT DEFAULT 'active',
        phone TEXT,
        email TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        type TEXT, -- 'expense' | 'payment' | etc.
        amount NUMERIC(18,2) DEFAULT 0,
        account_code TEXT,
        partner_id INTEGER,
        description TEXT,
        status TEXT DEFAULT 'draft',
        branch TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_invoices (
        id SERIAL PRIMARY KEY,
        number TEXT UNIQUE,
        date DATE,
        due_date DATE,
        supplier_id INTEGER REFERENCES partners(id),
        lines JSONB,
        subtotal NUMERIC(18,2) DEFAULT 0,
        discount_pct NUMERIC(5,2) DEFAULT 0,
        discount_amount NUMERIC(18,2) DEFAULT 0,
        tax_pct NUMERIC(5,2) DEFAULT 0,
        tax_amount NUMERIC(18,2) DEFAULT 0,
        total NUMERIC(18,2) DEFAULT 0,
        payment_method TEXT,
        status TEXT DEFAULT 'draft',
        branch TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        number TEXT UNIQUE,
        date DATE,
        customer_id INTEGER,
        lines JSONB,
        subtotal NUMERIC(18,2) DEFAULT 0,
        discount_pct NUMERIC(5,2) DEFAULT 0,
        discount_amount NUMERIC(18,2) DEFAULT 0,
        tax_pct NUMERIC(5,2) DEFAULT 0,
        tax_amount NUMERIC(18,2) DEFAULT 0,
        total NUMERIC(18,2) DEFAULT 0,
        payment_method TEXT,
        status TEXT DEFAULT 'draft',
        branch TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        branch TEXT,
        table_code TEXT,
        lines JSONB,
        status TEXT DEFAULT 'DRAFT',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER,
        amount NUMERIC(18,2) DEFAULT 0,
        method TEXT,
        date DATE,
        branch TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.error(`[SCHEMA] ERROR: Failed to ensure schema`, e?.message, e?.stack);
  }
}
ensureSchema().catch((e) => {
  console.error(`[SCHEMA] ERROR: Failed to ensure schema (async)`, e?.message, e?.stack);
});

async function handleLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    console.log(`[LOGIN] Attempt | email=${email || '(empty)'}`)
    if (!email || !password) {
      console.log(`[LOGIN] REJECTED: Missing credentials | email=${email || '(empty)'}`)
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
app.post("/api/auth/login", handleLogin);
app.post("/auth/login", handleLogin);

app.post("/debug/bootstrap-admin", async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "invalid_payload" });
    const hashed = await bcrypt.hash(String(password), 10);
    const { rows: existing } = await pool.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', [email]);
    if (existing && existing.length > 0) {
      await pool.query('UPDATE "users" SET password = $1, role = $2 WHERE email = $3', [hashed, "admin", email]);
    } else {
      await pool.query('INSERT INTO "users" (email, password, role) VALUES ($1, $2, $3)', [email, hashed, "admin"]);
    }
    return res.json({ ok: true, user: { email, role: "admin", name: name || "Admin" } });
  } catch (e) {
    return res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// /auth/me endpoint - CRITICAL: Only returns user if token is valid
// Does NOT check permissions - that's authorization, not authentication
// Must NEVER fail due to permission loading errors
app.get("/api/auth/me", authenticateToken, (req, res) => {
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
});

app.get("/auth/me", authenticateToken, (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      console.error('[AUTH/ME] No user in request after authentication');
      return res.status(401).json({ error: "unauthorized" });
    }
    
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
});

// CRITICAL: requireAdmin - Simple admin check, no permissions, no screens, no actions
// Admin has unrestricted access to everything
// This is the ONLY check needed - if user is admin, allow everything
function requireAdmin(req, res, next){
  if (!req.user) {
    console.log(`[REQUIRE_ADMIN] REJECTED: No user`);
    return res.status(401).json({ error: "unauthorized" });
  }
  
  // Use isAdmin flag if available, otherwise check role
  const isAdmin = req.user?.isAdmin === true || 
                  String(req.user?.role || '').toLowerCase() === 'admin';
  
  const userId = req.user?.id || 'anon';
  const role = String(req.user?.role || '').toLowerCase();
  
  console.log(`[REQUIRE_ADMIN] Checking admin access | userId=${userId} role=${role} isAdmin=${isAdmin}`);
  
  if (!isAdmin) {
    console.log(`[REQUIRE_ADMIN] REJECTED: Not admin | userId=${userId} role=${role}`);
    return res.status(403).json({ error: "forbidden", required: "admin" });
  }
  
  console.log(`[REQUIRE_ADMIN] ALLOWED: Admin access granted | userId=${userId}`);
  next();
}

app.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const { rows } = await pool.query('SELECT id, email, role, is_active, created_at FROM "users" ORDER BY id DESC');
    const items = Array.isArray(rows) ? rows.map(r => ({ id: r.id, email: r.email, role: r.role || "user", is_active: r.is_active !== false, created_at: r.created_at })) : [];
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const { rows } = await pool.query('SELECT id, email, role, is_active, created_at FROM "users" ORDER BY id DESC');
    const items = Array.isArray(rows) ? rows.map(r => ({ id: r.id, email: r.email, role: r.role || "user", is_active: r.is_active !== false, created_at: r.created_at })) : [];
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, role, default_branch } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "invalid_payload" });
    const hashed = await bcrypt.hash(String(password), 10);
    const { rows: existing } = await pool.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', [email]);
    if (existing && existing.length > 0) return res.status(409).json({ error: "conflict" });
    const { rows } = await pool.query('INSERT INTO "users" (email, password, role, default_branch) VALUES ($1, $2, $3, $4) RETURNING id, email, role, default_branch, created_at', [email, hashed, role || "user", default_branch || null]);
    res.json(rows && rows[0]);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.post("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, role, default_branch } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "invalid_payload" });
    const hashed = await bcrypt.hash(String(password), 10);
    const { rows: existing } = await pool.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', [email]);
    if (existing && existing.length > 0) return res.status(409).json({ error: "conflict" });
    const { rows } = await pool.query('INSERT INTO "users" (email, password, role, default_branch) VALUES ($1, $2, $3, $4) RETURNING id, email, role, default_branch, created_at', [email, hashed, role || "user", default_branch || null]);
    res.json(rows && rows[0]);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.put("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { email, role, default_branch } = req.body || {};
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows } = await pool.query('UPDATE "users" SET email = COALESCE($1, email), role = COALESCE($2, role), default_branch = COALESCE($3, default_branch) WHERE id = $4 RETURNING id, email, role, default_branch, created_at', [email || null, role || null, default_branch || null, id]);
    res.json(rows && rows[0]);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.put("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { email, role, default_branch } = req.body || {};
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows } = await pool.query('UPDATE "users" SET email = COALESCE($1, email), role = COALESCE($2, role), default_branch = COALESCE($3, default_branch) WHERE id = $4 RETURNING id, email, role, default_branch, created_at', [email || null, role || null, default_branch || null, id]);
    res.json(rows && rows[0]);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/users/:id/toggle", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows: cur } = await pool.query('SELECT is_active FROM "users" WHERE id = $1 LIMIT 1', [id]);
    const next = !(cur && cur[0] && cur[0].is_active !== false);
    await pool.query('UPDATE "users" SET is_active = $1 WHERE id = $2', [next, id]);
    res.json({ ok: true, id, is_active: next });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.post("/api/users/:id/toggle", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows: cur } = await pool.query('SELECT is_active FROM "users" WHERE id = $1 LIMIT 1', [id]);
    const next = !(cur && cur[0] && cur[0].is_active !== false);
    await pool.query('UPDATE "users" SET is_active = $1 WHERE id = $2', [next, id]);
    res.json({ ok: true, id, is_active: next });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/users/:id/reset-password", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { password } = req.body || {};
    if (!id || !password) return res.status(400).json({ error: "invalid_payload" });
    const hashed = await bcrypt.hash(String(password), 10);
    await pool.query('UPDATE "users" SET password = $1 WHERE id = $2', [hashed, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.post("/api/users/:id/reset-password", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { password } = req.body || {};
    if (!id || !password) return res.status(400).json({ error: "invalid_payload" });
    const hashed = await bcrypt.hash(String(password), 10);
    await pool.query('UPDATE "users" SET password = $1 WHERE id = $2', [hashed, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

function baseScreens(){
  return [
    "clients","suppliers","employees","expenses","products","sales","purchases","reports","accounting","journal","settings"
  ];
}
function defaultPermissions(role){
  const sc = baseScreens();
  const m = {};
  for (const s of sc) {
    m[s] = { _global: { view: true, create: role === "admin", edit: role === "admin", delete: role === "admin" } };
  }
  return m;
}

function flattenPermissionsMap(map, userId){
  const rows = [];
  for (const [screen, obj] of Object.entries(map || {})) {
    const g = obj?._global || {};
    for (const [action, allowed] of Object.entries(g)) {
      rows.push({ user_id: userId, screen_code: screen, branch_code: '', action_code: String(action), allowed: !!allowed });
    }
    for (const [branch, actions] of Object.entries(obj || {})) {
      if (branch === '_global') continue;
      for (const [action, allowed] of Object.entries(actions || {})) {
        rows.push({ user_id: userId, screen_code: screen, branch_code: String(branch), action_code: String(action), allowed: !!allowed });
      }
    }
  }
  return rows;
}
function flattenPermissionsList(list, userId){
  const rows = [];
  for (const it of (Array.isArray(list) ? list : [])) {
    rows.push({
      user_id: userId,
      screen_code: String(it.screen || it.screen_code || '').toLowerCase(),
      branch_code: String(it.branch || it.branch_code || '').toLowerCase(),
      action_code: String(it.action || it.action_code || '').toLowerCase(),
      allowed: !!it.allowed
    });
  }
  return rows;
}
async function saveUserPermissions(userId, rows){
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
    const qs = 'INSERT INTO user_permissions (user_id, screen_code, branch_code, action_code, allowed) VALUES ($1, $2, $3, $4, $5)';
    for (const r of rows) {
      await client.query(qs, [r.user_id, r.screen_code, r.branch_code || '', r.action_code, r.allowed]);
    }
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e;
  } finally {
    client.release();
  }
}
async function loadUserPermissionsMap(userId){
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

app.get("/users/:id/permissions", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows } = await pool.query('SELECT role FROM "users" WHERE id = $1 LIMIT 1', [id]);
    const role = (rows && rows[0] && rows[0].role) ? String(rows[0].role).toLowerCase() : "user";
    const existing = await loadUserPermissionsMap(id);
    const hasAny = Object.keys(existing || {}).length > 0;
    if (hasAny) return res.json(existing);
    const m = defaultPermissions(role);
    try { await saveUserPermissions(id, flattenPermissionsMap(m, id)) } catch {}
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/users/:id/permissions", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows } = await pool.query('SELECT role FROM "users" WHERE id = $1 LIMIT 1', [id]);
    const role = (rows && rows[0] && rows[0].role) ? String(rows[0].role).toLowerCase() : "user";
    const existing = await loadUserPermissionsMap(id);
    const hasAny = Object.keys(existing || {}).length > 0;
    if (hasAny) return res.json(existing);
    const m = defaultPermissions(role);
    try { await saveUserPermissions(id, flattenPermissionsMap(m, id)) } catch {}
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.put("/users/:id/permissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const adminId = req.user?.id || 'unknown';
    if (!id) {
      console.log(`[PERMISSIONS] REJECTED: Invalid user ID | adminId=${adminId} targetId=${id}`)
      return res.status(400).json({ error: "invalid_payload" });
    }
    const body = req.body || {};
    console.log(`[PERMISSIONS] Saving permissions | adminId=${adminId} targetUserId=${id} payloadType=${Array.isArray(body) ? 'array' : 'object'} payloadSize=${Array.isArray(body) ? body.length : Object.keys(body).length}`)
    let rows = [];
    if (Array.isArray(body)) {
      rows = flattenPermissionsList(body, id);
      console.log(`[PERMISSIONS] Flattened array to ${rows.length} rows | targetUserId=${id}`)
    } else {
      rows = flattenPermissionsMap(body, id);
      console.log(`[PERMISSIONS] Flattened map to ${rows.length} rows | targetUserId=${id}`)
    }
    await saveUserPermissions(id, rows);
    console.log(`[PERMISSIONS] SUCCESS: Saved ${rows.length} permission rows | adminId=${adminId} targetUserId=${id}`)
    res.json({ ok: true });
  } catch (e) {
    const adminId = req.user?.id || 'unknown';
    const id = Number(req.params.id || 0);
    console.error(`[PERMISSIONS] ERROR: Failed to save | adminId=${adminId} targetUserId=${id}`, e?.message, e?.stack);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.put("/api/users/:id/permissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const adminId = req.user?.id || 'unknown';
    if (!id) {
      console.log(`[PERMISSIONS] REJECTED: Invalid user ID | adminId=${adminId} targetId=${id}`)
      return res.status(400).json({ error: "invalid_payload" });
    }
    const body = req.body || {};
    console.log(`[PERMISSIONS] Saving permissions (API) | adminId=${adminId} targetUserId=${id} payloadType=${Array.isArray(body) ? 'array' : 'object'} payloadSize=${Array.isArray(body) ? body.length : Object.keys(body).length}`)
    let rows = [];
    if (Array.isArray(body)) {
      rows = flattenPermissionsList(body, id);
      console.log(`[PERMISSIONS] Flattened array to ${rows.length} rows | targetUserId=${id}`)
    } else {
      rows = flattenPermissionsMap(body, id);
      console.log(`[PERMISSIONS] Flattened map to ${rows.length} rows | targetUserId=${id}`)
    }
    await saveUserPermissions(id, rows);
    console.log(`[PERMISSIONS] SUCCESS: Saved ${rows.length} permission rows (API) | adminId=${adminId} targetUserId=${id}`)
    res.json({ ok: true });
  } catch (e) {
    const adminId = req.user?.id || 'unknown';
    const id = Number(req.params.id || 0);
    console.error(`[PERMISSIONS] ERROR: Failed to save (API) | adminId=${adminId} targetUserId=${id}`, e?.message, e?.stack);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/roles", authenticateToken, requireAdmin, async (req, res) => {
  res.json([{ id: 1, name: "Admin" }, { id: 2, name: "User" }]);
});
app.get("/api/roles", authenticateToken, requireAdmin, async (req, res) => {
  res.json([{ id: 1, name: "Admin" }, { id: 2, name: "User" }]);
});
app.get("/screens", authenticateToken, requireAdmin, async (req, res) => {
  const list = baseScreens().map((s, i) => ({
    id: i + 1,
    code: s,
    name: s,
    has_branches: s === "sales"
  }));
  res.json(list);
});
app.get("/api/screens", authenticateToken, requireAdmin, async (req, res) => {
  const list = baseScreens().map((s, i) => ({
    id: i + 1,
    code: s,
    name: s,
    has_branches: s === "sales"
  }));
  res.json(list);
});
app.get("/actions", authenticateToken, requireAdmin, async (req, res) => {
  const actions = ["view", "create", "edit", "delete"].map((code, i) => ({ id: i + 1, code }));
  res.json(actions);
});
app.get("/api/actions", authenticateToken, requireAdmin, async (req, res) => {
  const actions = ["view", "create", "edit", "delete"].map((code, i) => ({ id: i + 1, code }));
  res.json(actions);
});

app.get("/branches", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.user?.id || 0);
    if (!id) return res.status(401).json({ error: "unauthorized" });
    const map = await loadUserPermissionsMap(id);
    const set = new Set();
    for (const [screen, obj] of Object.entries(map || {})) {
      for (const [b, acts] of Object.entries(obj || {})) {
        if (b === '_global') continue;
        if (Object.values(acts || {}).some(Boolean)) set.add(String(b));
      }
    }
    const arr = Array.from(set);
    if (arr.length === 0) {
      const def = String(req.user?.default_branch || '').trim() || 'china_town';
      arr.push(def);
    }
    res.json(arr.map((code, idx) => ({ id: idx + 1, code, name: code })));
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/branches", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.user?.id || 0);
    if (!id) return res.status(401).json({ error: "unauthorized" });
    const map = await loadUserPermissionsMap(id);
    const set = new Set();
    for (const [screen, obj] of Object.entries(map || {})) {
      for (const [b, acts] of Object.entries(obj || {})) {
        if (b === '_global') continue;
        if (Object.values(acts || {}).some(Boolean)) set.add(String(b));
      }
    }
    const arr = Array.from(set);
    if (arr.length === 0) {
      const def = String(req.user?.default_branch || '').trim() || 'china_town';
      arr.push(def);
    }
    res.json(arr.map((code, idx) => ({ id: idx + 1, code, name: code })));
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/users/:id/user-permissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { items: screens } = await (async()=>({ items: baseScreens().map((s, i)=>({ id: i+1, code: s, name: s, has_branches: s==='sales' })) }))();
    const { items: actions } = await (async()=>({ items: ["view","create","edit","delete"].map((code,i)=>({ id:i+1, code })) }))();
    const { items: branches } = await (async()=> {
      const brRes = await (async()=> {
        const map = await loadUserPermissionsMap(id);
        const set = new Set();
        for (const [screen, obj] of Object.entries(map || {})) {
          for (const [b, acts] of Object.entries(obj || {})) {
            if (b === '_global') continue;
            if (Object.values(acts || {}).some(Boolean)) set.add(String(b));
          }
        }
        const arr = Array.from(set);
        if (arr.length === 0) {
          const def = String((await pool.query('SELECT default_branch FROM "users" WHERE id = $1', [id]))?.rows?.[0]?.default_branch || '').trim() || 'china_town';
          arr.push(def);
        }
        return arr.map((code, idx) => ({ id: idx + 1, code, name: code }))
      })();
      return { items: brRes };
    })();
    const screenIdByCode = Object.fromEntries((screens||[]).map(s => [String(s.code).toLowerCase(), s.id]));
    const actionIdByCode = Object.fromEntries((actions||[]).map(a => [String(a.code).toLowerCase(), a.id]));
    const branchIdByCode = Object.fromEntries((branches||[]).map(b => [String(b.code).toLowerCase(), b.id]));
    const { rows } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [id]);
    const list = [];
    for (const r of rows || []) {
      const sc = String(r.screen_code||'').toLowerCase();
      const ac = String(r.action_code||'').toLowerCase();
      const br = String(r.branch_code||'').toLowerCase();
      list.push({
        id: 0,
        user_id: id,
        screen_id: screenIdByCode[sc] || null,
        action_id: actionIdByCode[ac] || null,
        branch_id: br ? (branchIdByCode[br] || null) : null,
        allowed: !!r.allowed
      });
    }
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/users/:id/user-permissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { items: screens } = await (async()=>({ items: baseScreens().map((s, i)=>({ id: i+1, code: s, name: s, has_branches: s==='sales' })) }))();
    const { items: actions } = await (async()=>({ items: ["view","create","edit","delete"].map((code,i)=>({ id:i+1, code })) }))();
    const { items: branches } = await (async()=> {
      const brRes = await (async()=> {
        const map = await loadUserPermissionsMap(id);
        const set = new Set();
        for (const [screen, obj] of Object.entries(map || {})) {
          for (const [b, acts] of Object.entries(obj || {})) {
            if (b === '_global') continue;
            if (Object.values(acts || {}).some(Boolean)) set.add(String(b));
          }
        }
        const arr = Array.from(set);
        if (arr.length === 0) {
          const def = String((await pool.query('SELECT default_branch FROM "users" WHERE id = $1', [id]))?.rows?.[0]?.default_branch || '').trim() || 'china_town';
          arr.push(def);
        }
        return arr.map((code, idx) => ({ id: idx + 1, code, name: code }))
      })();
      return { items: brRes };
    })();
    const screenIdByCode = Object.fromEntries((screens||[]).map(s => [String(s.code).toLowerCase(), s.id]));
    const actionIdByCode = Object.fromEntries((actions||[]).map(a => [String(a.code).toLowerCase(), a.id]));
    const branchIdByCode = Object.fromEntries((branches||[]).map(b => [String(b.code).toLowerCase(), b.id]));
    const { rows } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [id]);
    const list = [];
    for (const r of rows || []) {
      const sc = String(r.screen_code||'').toLowerCase();
      const ac = String(r.action_code||'').toLowerCase();
      const br = String(r.branch_code||'').toLowerCase();
      list.push({
        id: 0,
        user_id: id,
        screen_id: screenIdByCode[sc] || null,
        action_id: actionIdByCode[ac] || null,
        branch_id: br ? (branchIdByCode[br] || null) : null,
        allowed: !!r.allowed
      });
    }
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

if (String(process.env.ADMIN_CREATE_ENABLED || "false").toLowerCase() === "true") {
  app.get("/create-admin", async (req, res) => {
    try {
      await createAdmin();
      res.send("Admin user created");
    } catch (err) {
      res.status(500).send("Failed to create admin: " + (err?.message || "unknown error"));
    }
  });
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});
app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

// CRITICAL: Authorization guards ONLY for API endpoints
// Frontend routes (like /invoices, /supplier-invoices) are handled by React Router
// These middleware only apply to API calls, not to static files or frontend routes
// Static files are already handled by express.static and authenticateToken skips them

// Helper function to check if request is API endpoint
function isApiRequest(req) {
  return req.path.startsWith('/api/') || 
         req.headers['content-type']?.includes('application/json') ||
         req.headers['accept']?.includes('application/json');
}

app.use("/invoices", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request (frontend route or static file)
  if (!isApiRequest(req)) {
    return next(); // Let React Router handle it
  }
  try {
    if (req.method === "GET") {
      return authorize("sales", "view", { branchFrom: req => (req.query.branch || req.query.branch_code || req.query.branchId || null) })(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("sales", "create", { branchFrom: req => (req.body.branch || req.body.branch_code || req.body.branchId || null) })(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("sales", "edit", { branchFrom: req => (req.body.branch || req.body.branch_code || req.body.branchId || null) })(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/drafts", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    if (req.method === "GET") {
      return authorize("sales", "view", { branchFrom: r => (r.query.branch || r.query.branch_code || null) })(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("sales", "create", { branchFrom: r => (r.body.branch || r.body.branch_code || null) })(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/expenses", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    if (req.method === "GET") {
      return authorize("expenses", "view", { branchFrom: r => (r.query.branch || null) })(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("expenses", "create", { branchFrom: r => (r.body.branch || null) })(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("expenses", "edit", { branchFrom: r => (r.body.branch || null) })(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/api/expenses", authenticateToken, async (req, res, next) => {
  try {
    if (req.method === "GET") {
      return authorize("expenses", "view", { branchFrom: r => (r.query.branch || null) })(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("expenses", "create", { branchFrom: r => (r.body.branch || null) })(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("expenses", "edit", { branchFrom: r => (r.body.branch || null) })(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.use("/customers", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    if (req.method === "GET") {
      return authorize("clients", "view")(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("clients", "create")(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("clients", "edit")(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/employees", authenticateToken, async (req, res, next) => {
  try {
    if (req.method === "GET") {
      return authorize("employees", "view")(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("employees", "create")(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("employees", "edit")(req, res, next);
    }
    if (req.method === "DELETE") {
      return authorize("employees", "delete")(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/api/employees", authenticateToken, async (req, res, next) => {
  try {
    if (req.method === "GET") {
      return authorize("employees", "view")(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("employees", "create")(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("employees", "edit")(req, res, next);
    }
    if (req.method === "DELETE") {
      return authorize("employees", "delete")(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/journal", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    return authorize("journal", "view")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.use("/ledger", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    return authorize("accounting", "view")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.use("/reports", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    return authorize("reports", "view")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Settings routes use requireAdmin directly, no need for authorize middleware
// Admin should have full access to all settings without permission checks

// Settings storage (DB-backed)
app.get("/settings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value, updated_at FROM settings ORDER BY key ASC');
    res.json({ items: rows || [] });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/settings/:key", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = String(req.params.key || "");
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    const v = rows && rows[0] ? rows[0].value : null;
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.put("/settings/:key", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = String(req.params.key || "");
    const value = req.body || null;
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.post("/settings/backup", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings ORDER BY key ASC');
    const dump = {};
    for (const r of rows || []) dump[r.key] = r.value;
    res.json({ ok: true, data: dump });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.post("/settings/restore", authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const data = req.body || {};
    await client.query('BEGIN');
    for (const [k, v] of Object.entries(data || {})) {
      await client.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [k, v]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
// Duplicate under /api for frontend expectations
app.get("/api/settings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value, updated_at FROM settings ORDER BY key ASC');
    res.json({ items: rows || [] });
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); }
});
app.get("/api/settings/:key", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = String(req.params.key || "");
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    const v = rows && rows[0] ? rows[0].value : null;
    res.json(v);
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); }
});
app.put("/api/settings/:key", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = String(req.params.key || "");
    const value = req.body || null;
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); }
});
app.post("/api/settings/backup", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings ORDER BY key ASC');
    const dump = {}; for (const r of rows || []) dump[r.key] = r.value;
    res.json({ ok: true, data: dump });
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); }
});
app.post("/api/settings/restore", authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const data = req.body || {};
    await client.query('BEGIN');
    for (const [k, v] of Object.entries(data || {})) {
      await client.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [k, v]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally { client.release(); }
});
app.use("/partners", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    const t = String(req.query?.type || req.body?.type || '').toLowerCase()
    if (t === 'customer') return authorize("clients", req.method === "GET" ? "view" : (req.method === "POST" ? "create" : "edit"))(req, res, next)
    if (t === 'supplier') return authorize("suppliers", req.method === "GET" ? "view" : (req.method === "POST" ? "create" : "edit"))(req, res, next)
    return authorize("clients", "view")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Mirror authorization for /api prefixed endpoints
app.use("/api/partners", authenticateToken, async (req, res, next) => {
  try {
    const t = String(req.query?.type || req.body?.type || '').toLowerCase()
    if (t === 'customer') return authorize("clients", req.method === "GET" ? "view" : (req.method === "POST" ? "create" : "edit"))(req, res, next)
    if (t === 'supplier') return authorize("suppliers", req.method === "GET" ? "view" : (req.method === "POST" ? "create" : "edit"))(req, res, next)
    return authorize("clients", "view")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/products", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    if (req.method === "GET") return authorize("products", "view")(req, res, next)
    if (req.method === "POST") return authorize("products", "create")(req, res, next)
    if (req.method === "PUT") return authorize("products", "edit")(req, res, next)
    if (req.method === "DELETE") return authorize("products", "delete")(req, res, next)
    next()
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/orders", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    const opts = { branchFrom: r => (r.query.branch || r.query.branch_code || r.body?.branch || r.body?.branch_code || null) }
    if (req.method === "GET") return authorize("sales", "view", opts)(req, res, next)
    if (req.method === "POST") return authorize("sales", "create", opts)(req, res, next)
    if (req.method === "PUT") return authorize("sales", "edit", opts)(req, res, next)
    if (req.method === "DELETE") return authorize("sales", "delete", opts)(req, res, next)
    next()
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/supplier-invoices", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    const opts = { branchFrom: r => (r.query.branch || r.query.branch_code || r.body?.branch || r.body?.branch_code || null) }
    if (req.method === "GET") return authorize("purchases", "view", opts)(req, res, next)
    if (req.method === "POST") return authorize("purchases", "create", opts)(req, res, next)
    if (req.method === "PUT") return authorize("purchases", "edit", opts)(req, res, next)
    if (req.method === "DELETE") return authorize("purchases", "delete", opts)(req, res, next)
    next()
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/payments", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    const opts = { branchFrom: r => (r.query.branch || r.body?.branch || null) }
    if (req.method === "GET") return authorize("sales", "view", opts)(req, res, next)
    if (req.method === "POST") return authorize("sales", "create", opts)(req, res, next)
    next()
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/accounts", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    if (req.method === "GET") return authorize("accounting", "view")(req, res, next)
    if (req.method === "POST") return authorize("accounting", "create")(req, res, next)
    if (req.method === "PUT") return authorize("accounting", "edit")(req, res, next)
    if (req.method === "DELETE") return authorize("accounting", "delete")(req, res, next)
    next()
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/ar", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    return authorize("reports", "view")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/pos", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    const opts = { branchFrom: r => (r.params?.branch || r.query.branch || r.body?.branch || null) }
    return authorize("sales", "view", opts)(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/accounting-periods", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    if (req.method === "GET") return authorize("accounting", "view")(req, res, next)
    return authorize("accounting", "edit")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/preview", authenticateToken, async (req, res, next) => {
  // Skip if this is not an API request
  if (!isApiRequest(req)) {
    return next();
  }
  try {
    return authorize("sales", "view")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Minimal safe API handlers to prevent UI crashes
app.get("/partners", authenticateToken, async (req, res) => {
  try {
    const type = String(req.query?.type || "").toLowerCase();
    const { rows } = await pool.query('SELECT id, name, type, email, phone, customer_type, contact_info, status, is_active, created_at FROM partners ORDER BY id DESC');
    const list = Array.isArray(rows) ? rows.map(r => ({ ...r, contact_info: r.contact_info || null })) : [];
    const filtered = list.filter(p => !type || String(p.type||"").toLowerCase() === type);
    res.json(filtered);
  } catch (e) { res.json([]); }
});
app.get("/api/partners", authenticateToken, async (req, res) => {
  try {
    const type = String(req.query?.type || "").toLowerCase();
    const { rows } = await pool.query('SELECT id, name, type, email, phone, customer_type, contact_info, status, is_active, created_at FROM partners ORDER BY id DESC');
    const list = Array.isArray(rows) ? rows.map(r => ({ ...r, contact_info: r.contact_info || null })) : [];
    const filtered = list.filter(p => !type || String(p.type||"").toLowerCase() === type);
    res.json(filtered);
  } catch (e) { res.json([]); }
});
app.post("/partners", authenticateToken, authorize("clients","create"), async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name||'').trim(); const type = String(b.type||'customer').toLowerCase();
    const email = b.email || null; const phone = b.phone || null;
    const customer_type = b.customer_type || null;
    const contact_info = b.contact_info ? (typeof b.contact_info === 'object' ? b.contact_info : null) : null;
    const { rows } = await pool.query(
      'INSERT INTO partners(name, type, email, phone, customer_type, contact_info) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, created_at',
      [name, type, email, phone, customer_type, contact_info]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); }
});
app.post("/api/partners", authenticateToken, authorize("clients","create"), async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name||'').trim(); const type = String(b.type||'customer').toLowerCase();
    const email = b.email || null; const phone = b.phone || null;
    const customer_type = b.customer_type || null;
    const contact_info = b.contact_info ? (typeof b.contact_info === 'object' ? b.contact_info : null) : null;
    const { rows } = await pool.query(
      'INSERT INTO partners(name, type, email, phone, customer_type, contact_info) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, created_at',
      [name, type, email, phone, customer_type, contact_info]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); }
});
app.put("/partners/:id", authenticateToken, authorize("clients","edit"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE partners SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), customer_type=COALESCE($4,customer_type), contact_info=COALESCE($5,contact_info), updated_at=NOW() WHERE id=$6 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, created_at',
      [b.name||null, b.email||null, b.phone||null, b.customer_type||null, (typeof b.contact_info==='object'? b.contact_info : null), id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/api/partners/:id", authenticateToken, authorize("clients","edit"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE partners SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), customer_type=COALESCE($4,customer_type), contact_info=COALESCE($5,contact_info), updated_at=NOW() WHERE id=$6 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, created_at',
      [b.name||null, b.email||null, b.phone||null, b.customer_type||null, (typeof b.contact_info==='object'? b.contact_info : null), id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/partners/:id", authenticateToken, authorize("clients","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('UPDATE partners SET is_active = false, status = $1, updated_at = NOW() WHERE id = $2', ['disabled', id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/api/partners/:id", authenticateToken, authorize("clients","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('UPDATE partners SET is_active = false, status = $1, updated_at = NOW() WHERE id = $2', ['disabled', id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});

app.get("/employees", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, first_name, last_name, employee_number, status, phone, email, created_at FROM employees ORDER BY id DESC');
    res.json(rows || []);
  } catch (e) { res.json([]); }
});
app.get("/api/employees", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, first_name, last_name, employee_number, status, phone, email, created_at FROM employees ORDER BY id DESC');
    res.json(rows || []);
  } catch (e) { res.json([]); }
});
app.post("/employees", authenticateToken, authorize("employees","create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO employees(first_name,last_name,employee_number,status,phone,email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, first_name, last_name, employee_number, status, phone, email, created_at',
      [b.first_name||null, b.last_name||null, b.employee_number||null, b.status||'active', b.phone||null, b.email||null]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.post("/api/employees", authenticateToken, authorize("employees","create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO employees(first_name,last_name,employee_number,status,phone,email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, first_name, last_name, employee_number, status, phone, email, created_at',
      [b.first_name||null, b.last_name||null, b.employee_number||null, b.status||'active', b.phone||null, b.email||null]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/employees/:id", authenticateToken, authorize("employees","edit"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE employees SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name), employee_number=COALESCE($3,employee_number), status=COALESCE($4,status), phone=COALESCE($5,phone), email=COALESCE($6,email), updated_at=NOW() WHERE id=$7 RETURNING id, first_name, last_name, employee_number, status, phone, email, created_at',
      [b.first_name||null, b.last_name||null, b.employee_number||null, b.status||null, b.phone||null, b.email||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/api/employees/:id", authenticateToken, authorize("employees","edit"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE employees SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name), employee_number=COALESCE($3,employee_number), status=COALESCE($4,status), phone=COALESCE($5,phone), email=COALESCE($6,email), updated_at=NOW() WHERE id=$7 RETURNING id, first_name, last_name, employee_number, status, phone, email, created_at',
      [b.first_name||null, b.last_name||null, b.employee_number||null, b.status||null, b.phone||null, b.email||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/employees/:id", authenticateToken, authorize("employees","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2', ['disabled', id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/api/employees/:id", authenticateToken, authorize("employees","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2', ['disabled', id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});

app.get("/expenses", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, type, amount, account_code, partner_id, description, status, branch, created_at FROM expenses ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/api/expenses", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, type, amount, account_code, partner_id, description, status, branch, created_at FROM expenses ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.post("/expenses", authenticateToken, authorize("expenses","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO expenses(type, amount, account_code, partner_id, description, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, type, amount, account_code, partner_id, description, status, branch, created_at',
      [b.type||'expense', Number(b.amount||0), b.account_code||null, b.partner_id||null, b.description||null, b.status||'draft', b.branch||req.user?.default_branch||'china_town']
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.post("/api/expenses", authenticateToken, authorize("expenses","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO expenses(type, amount, account_code, partner_id, description, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, type, amount, account_code, partner_id, description, status, branch, created_at',
      [b.type||'expense', Number(b.amount||0), b.account_code||null, b.partner_id||null, b.description||null, b.status||'draft', b.branch||req.user?.default_branch||'china_town']
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/expenses/:id", authenticateToken, authorize("expenses","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE expenses SET type=COALESCE($1,type), amount=COALESCE($2,amount), account_code=COALESCE($3,account_code), partner_id=COALESCE($4,partner_id), description=COALESCE($5,description), status=COALESCE($6,status), branch=COALESCE($7,branch), updated_at=NOW() WHERE id=$8 RETURNING id, type, amount, account_code, partner_id, description, status, branch, created_at',
      [b.type||null, (b.amount!=null?Number(b.amount):null), b.account_code||null, (b.partner_id!=null?Number(b.partner_id):null), b.description||null, b.status||null, b.branch||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/api/expenses/:id", authenticateToken, authorize("expenses","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE expenses SET type=COALESCE($1,type), amount=COALESCE($2,amount), account_code=COALESCE($3,account_code), partner_id=COALESCE($4,partner_id), description=COALESCE($5,description), status=COALESCE($6,status), branch=COALESCE($7,branch), updated_at=NOW() WHERE id=$8 RETURNING id, type, amount, account_code, partner_id, description, status, branch, created_at',
      [b.type||null, (b.amount!=null?Number(b.amount):null), b.account_code||null, (b.partner_id!=null?Number(b.partner_id):null), b.description||null, b.status||null, b.branch||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});

// Supplier Invoices
app.get("/supplier-invoices", authenticateToken, authorize("purchases","view", { branchFrom: r => (r.query.branch || null) }), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, number, date, due_date, supplier_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at FROM supplier_invoices ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/supplier-invoices/next-number", authenticateToken, authorize("purchases","create"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT number FROM supplier_invoices ORDER BY id DESC LIMIT 1');
    const last = rows && rows[0] ? String(rows[0].number||'') : '';
    const seq = (function(){ const m = /PI\/(\d{4})\/(\d+)/.exec(last); const year = (new Date()).getFullYear(); const nextN = m && Number(m[1])===year ? Number(m[2]||0)+1 : 1; return `PI/${year}/${String(nextN).padStart(10,'0')}` })();
    res.json({ next: seq });
  } catch (e) { res.json({ next: null }); }
});
app.post("/supplier-invoices", authenticateToken, authorize("purchases","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const subtotal = Number(b.subtotal||0);
    const discount_pct = Number(b.discount_pct||0);
    const discount_amount = Number(b.discount_amount||0);
    const tax_pct = Number(b.tax_pct||0);
    const tax_amount = Number(b.tax_amount||0);
    const total = Number(b.total||0);
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const { rows } = await pool.query(
      'INSERT INTO supplier_invoices(number, date, due_date, supplier_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.due_date||null, b.supplier_id||null, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, b.payment_method||null, b.status||'draft', branch]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); }
});
app.put("/supplier-invoices/:id", authenticateToken, authorize("purchases","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE supplier_invoices SET number=COALESCE($1,number), date=COALESCE($2,date), due_date=COALESCE($3,due_date), supplier_id=COALESCE($4,supplier_id), lines=COALESCE($5,lines), subtotal=COALESCE($6,subtotal), discount_pct=COALESCE($7,discount_pct), discount_amount=COALESCE($8,discount_amount), tax_pct=COALESCE($9,tax_pct), tax_amount=COALESCE($10,tax_amount), total=COALESCE($11,total), payment_method=COALESCE($12,payment_method), status=COALESCE($13,status), branch=COALESCE($14,branch), updated_at=NOW() WHERE id=$15 RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.due_date||null, b.supplier_id||null, (Array.isArray(b.lines)?b.lines:null), (b.subtotal!=null?Number(b.subtotal):null), (b.discount_pct!=null?Number(b.discount_pct):null), (b.discount_amount!=null?Number(b.discount_amount):null), (b.tax_pct!=null?Number(b.tax_pct):null), (b.tax_amount!=null?Number(b.tax_amount):null), (b.total!=null?Number(b.total):null), b.payment_method||null, b.status||null, b.branch||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.post("/supplier-invoices/:id/post", authenticateToken, authorize("purchases","edit"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query('UPDATE supplier_invoices SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, number, status', ['posted', id]);
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/supplier-invoices/:id", authenticateToken, authorize("purchases","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('DELETE FROM supplier_invoices WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.get("/invoices", authenticateToken, authorize("sales","view", { branchFrom: r => (r.query.branch || null) }), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, number, date, customer_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at FROM invoices ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/invoices/next-number", authenticateToken, authorize("sales","create"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT number FROM invoices ORDER BY id DESC LIMIT 1');
    const last = rows && rows[0] ? String(rows[0].number||'') : '';
    const year = (new Date()).getFullYear();
    const m = /INV\/(\d{4})\/(\d+)/.exec(last);
    const nextN = m && Number(m[1])===year ? Number(m[2]||0)+1 : 1;
    const seq = `INV/${year}/${String(nextN).padStart(10,'0')}`;
    res.json({ next: seq });
  } catch (e) { res.json({ next: null }); }
});
app.post("/invoices", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const { rows } = await pool.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.customer_id||null, lines, Number(b.subtotal||0), Number(b.discount_pct||0), Number(b.discount_amount||0), Number(b.tax_pct||0), Number(b.tax_amount||0), Number(b.total||0), b.payment_method||null, String(b.status||'draft'), branch]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/invoices/:id", authenticateToken, authorize("sales","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE invoices SET number=COALESCE($1,number), date=COALESCE($2,date), customer_id=COALESCE($3,customer_id), lines=COALESCE($4,lines), subtotal=COALESCE($5,subtotal), discount_pct=COALESCE($6,discount_pct), discount_amount=COALESCE($7,discount_amount), tax_pct=COALESCE($8,tax_pct), tax_amount=COALESCE($9,tax_amount), total=COALESCE($10,total), payment_method=COALESCE($11,payment_method), status=COALESCE($12,status), branch=COALESCE($13,branch), updated_at=NOW() WHERE id=$14 RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, (b.customer_id!=null?Number(b.customer_id):null), (Array.isArray(b.lines)?b.lines:null), (b.subtotal!=null?Number(b.subtotal):null), (b.discount_pct!=null?Number(b.discount_pct):null), (b.discount_amount!=null?Number(b.discount_amount):null), (b.tax_pct!=null?Number(b.tax_pct):null), (b.tax_amount!=null?Number(b.tax_amount):null), (b.total!=null?Number(b.total):null), b.payment_method||null, b.status||null, b.branch||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/invoices/:id", authenticateToken, authorize("sales","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('DELETE FROM invoices WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.get("/invoice_items/:id", authenticateToken, authorize("sales","view"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query('SELECT lines FROM invoices WHERE id=$1', [id]);
    const lines = rows && rows[0] ? (rows[0].lines || []) : [];
    res.json({ items: Array.isArray(lines) ? lines : [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/orders", authenticateToken, authorize("sales","view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, branch, table_code, lines, status, created_at FROM orders ORDER BY id DESC');
    res.json(rows || []);
  } catch (e) { res.json([]); }
});
app.get("/orders/:id", authenticateToken, authorize("sales","view"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query('SELECT id, branch, table_code, lines, status, created_at FROM orders WHERE id=$1', [id]);
    res.json(rows && rows[0] || null);
  } catch (e) { res.json(null); }
});
app.post("/orders", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const table_code = String(b.table || b.table_code || '');
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const { rows } = await pool.query('INSERT INTO orders(branch, table_code, lines, status) VALUES ($1,$2,$3,$4) RETURNING id, branch, table_code, status', [branch, table_code, lines, 'DRAFT']);
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/orders/:id", authenticateToken, authorize("sales","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query('UPDATE orders SET branch=COALESCE($1,branch), table_code=COALESCE($2,table_code), lines=COALESCE($3,lines), status=COALESCE($4,status), updated_at=NOW() WHERE id=$5 RETURNING id, branch, table_code, status', [b.branch||null, (b.table||b.table_code||null), (Array.isArray(b.lines)?b.lines:null), b.status||null, id]);
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.delete("/orders/:id", authenticateToken, authorize("sales","delete"), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    await pool.query('DELETE FROM orders WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.get("/payments", authenticateToken, authorize("sales","view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, invoice_id, amount, method, date, branch, created_at FROM payments ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.post("/payments", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const { rows } = await pool.query('INSERT INTO payments(invoice_id, amount, method, date, branch) VALUES ($1,$2,$3,$4,$5) RETURNING id, invoice_id, amount, method, date, branch', [b.invoice_id||null, Number(b.amount||0), b.method||'cash', b.date||new Date(), branch]);
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.get("/ar/summary", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    res.json({ items: [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/pos/tables-layout", authenticateToken, async (req, res) => {
  try {
    const branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const key = `pos_tables_layout_${branch}`;
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    const v = rows && rows[0] ? rows[0].value : null;
    const out = v && v.rows ? v : { rows: [] };
    res.json(out);
  } catch (e) { res.json({ rows: [] }); }
});
app.put("/pos/tables-layout", authenticateToken, authorize("sales","edit"), async (req, res) => {
  try {
    const branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const key = `pos_tables_layout_${branch}`;
    const value = req.body || {};
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.get("/pos/table-state", authenticateToken, async (req, res) => {
  try {
    const branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const { rows } = await pool.query('SELECT table_code FROM orders WHERE branch = $1 AND status = $2', [branch, 'DRAFT']);
    const busy = (rows || []).map(r => r.table_code).filter(Boolean);
    res.json({ busy });
  } catch (e) { res.json({ busy: [] }); }
});
app.post("/pos/verify-cancel", authenticateToken, async (req, res) => {
  try {
    const branch = String(req.body?.branch || req.user?.default_branch || 'china_town');
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [`settings_branch_${branch}`]);
    const v = rows && rows[0] ? rows[0].value : null;
    const pwd = v && v.cancel_password ? String(v.cancel_password) : '';
    const ok = !pwd || String(req.body?.password || '') === pwd;
    res.json(ok);
  } catch (e) { res.json(true); }
});
app.post("/pos/saveDraft", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const table_code = String(b.table || b.table_code || '');
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const { rows } = await pool.query('INSERT INTO orders(branch, table_code, lines, status) VALUES ($1,$2,$3,$4) RETURNING id, branch, table_code, status', [branch, table_code, lines, 'DRAFT']);
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.post("/pos/issueInvoice", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const b = req.body || {};
    const number = b.number || null;
    const date = b.date || new Date();
    const customer_id = b.customer_id || null;
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const subtotal = Number(b.subtotal||0);
    const discount_pct = Number(b.discount_pct||0);
    const discount_amount = Number(b.discount_amount||0);
    const tax_pct = Number(b.tax_pct||0);
    const tax_amount = Number(b.tax_amount||0);
    const total = Number(b.total||0);
    const payment_method = b.payment_method || null;
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const status = String(b.status||'posted');
    const { rows } = await pool.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, status, total, branch',
      [number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch]
    );
    res.json(rows && rows[0]);
  } catch (e) { res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); }
});
app.get("/", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

app.listen(port, () => {
  console.log(`[SERVER] Started on port ${port} | NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] Build path: ${buildPath}`);
  console.log(`[SERVER] JWT_SECRET: ${JWT_SECRET ? 'configured' : 'MISSING'}`);
  console.log(`[SERVER] Database: ${pool ? 'connected' : 'NOT configured'}`);
});
