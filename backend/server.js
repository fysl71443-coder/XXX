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
import { isAdminUser } from "./utils/auth.js";

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

// 0️⃣ CRITICAL: Rewrite nested static paths to root static paths
// React Router lazy loading creates requests like /supplier-invoices/static/js/...
// These need to be rewritten to /static/js/... to find the actual files
app.use((req, res, next) => {
  const url = req.url || '';
  // Check if URL contains /static/ but not at the start
  // e.g., /supplier-invoices/static/js/... -> /static/js/...
  const staticMatch = url.match(/\/static\/(js|css|media)\/.+/);
  if (staticMatch && !url.startsWith('/static/')) {
    const newUrl = url.substring(url.indexOf('/static/'));
    console.log(`[STATIC REWRITE] ${url} -> ${newUrl}`);
    req.url = newUrl;
  }
  next();
});

// 1️⃣ Static files FIRST - before ANY middleware
app.use(express.static(buildPath));

// 2️⃣ Public paths that never need auth
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/manifest.json', express.static(buildPath));
app.get('/robots.txt', express.static(buildPath));

// 2.5️⃣ CRITICAL: SPA Fallback for Frontend Routes
// This MUST come before API routes to prevent conflicts
// Frontend routes like /employees/cards, /clients/create, etc. should serve index.html
// Only /api/* routes should be handled by backend
const frontendRoutes = [
  '/employees/cards', '/employees/new', '/employees/settings',
  '/clients/cards', '/clients/create', '/clients/cash', '/clients/credit',
  '/clients/receivables', '/clients/payments', '/clients/statements',
  '/clients/invoices', '/clients/paid', '/clients/aging', '/clients/due',
  '/suppliers/cards', '/suppliers/create',
  '/products/purchase-orders', '/products/sales-orders',
  '/pos/', '/invoices/new', '/supplier-invoices/new',
  '/payroll/', '/reports/', '/debug/',
  '/expenses/invoices', '/orders/'
];

app.use((req, res, next) => {
  const reqPath = req.path || '';
  
  // Skip API routes
  if (reqPath.startsWith('/api/')) {
    return next();
  }
  
  // Check if this is a known frontend route
  const isFrontendRoute = frontendRoutes.some(route => reqPath.startsWith(route));
  
  // Also check for patterns like /employees/:id/edit
  const isFrontendPattern = /^\/(employees|clients|suppliers|products|orders)\/\d+/.test(reqPath) ||
                           /^\/(pos|payroll|reports)\//.test(reqPath);
  
  if (isFrontendRoute || isFrontendPattern) {
    console.log(`[SPA FALLBACK] Serving index.html for frontend route: ${reqPath}`);
    return res.sendFile(path.join(buildPath, 'index.html'));
  }
  
  next();
});

// 3️⃣ Middleware for parsing (safe for static files)
// CRITICAL: Increase body size limit for Base64 images in settings
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
// NOTE: This logs BEFORE authentication, so userId will always be 'anon' at this point
// The actual user info is logged in authenticateToken middleware after token validation
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method || 'UNKNOWN';
  const url = req.url || req.path || '/';
  // Check if Authorization header is present (but don't validate token here)
  const hasAuthHeader = !!req.headers['authorization'];
  console.log(`[REQUEST] ${timestamp} | ${method} ${url} | auth_header=${hasAuthHeader ? 'present' : 'missing'}`);
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
        account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'active',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Add account_id column if it doesn't exist (for existing databases)
    await pool.query('ALTER TABLE partners ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL');
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        account_number TEXT,
        account_code TEXT,
        name TEXT NOT NULL,
        name_en TEXT,
        type TEXT NOT NULL DEFAULT 'asset',
        nature TEXT DEFAULT 'debit',
        parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        opening_balance NUMERIC(18,2) DEFAULT 0,
        allow_manual_entry BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id SERIAL PRIMARY KEY,
        entry_number INTEGER,
        description TEXT,
        date DATE,
        reference_type TEXT,
        reference_id INTEGER,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_postings (
        id SERIAL PRIMARY KEY,
        journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id INTEGER REFERENCES accounts(id),
        debit NUMERIC(18,2) DEFAULT 0,
        credit NUMERIC(18,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        name_en TEXT,
        sku TEXT,
        barcode TEXT,
        category TEXT,
        unit TEXT DEFAULT 'unit',
        price NUMERIC(18,2) DEFAULT 0,
        cost NUMERIC(18,2) DEFAULT 0,
        tax_rate NUMERIC(5,2) DEFAULT 15,
        stock_quantity NUMERIC(18,2) DEFAULT 0,
        min_stock NUMERIC(18,2) DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  
  // Use centralized admin check
  const isAdmin = isAdminUser(req.user);
  
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
    
    // Admin gets ALL branches
    const isAdmin = isAdminUser(req.user);
    if (isAdmin) {
      const allBranches = [
        { id: 1, code: 'china_town', name: 'CHINA TOWN' },
        { id: 2, code: 'place_india', name: 'PLACE INDIA' }
      ];
      return res.json(allBranches);
    }
    
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

// CRITICAL: Error logging endpoint - NO authentication required
// This endpoint is used by ErrorBoundary to log frontend errors
// It should NEVER cause auth failures or redirects
app.post("/api/error-log", (req, res) => {
  try {
    const { error, stack, componentStack, url, userAgent, timestamp } = req.body || {};
    console.log(`[ERROR-LOG] Frontend error captured:`, {
      error: error || 'Unknown',
      url: url || 'Unknown',
      timestamp: timestamp || new Date().toISOString(),
      hasStack: !!stack,
      hasComponentStack: !!componentStack
    });
    // Always return success - error logging should never fail
    res.json({ ok: true });
  } catch (e) {
    // Even if logging fails, return success to prevent frontend issues
    res.json({ ok: true });
  }
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

// REMOVED: /employees middleware - conflicts with frontend routes
// All /employees API calls should use /api/employees instead
// Frontend routes like /employees/cards are handled by SPA fallback

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

// ==================== PRODUCTS API ====================
app.get("/products", authenticateToken, authorize("products", "view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows || []);
  } catch (e) {
    console.error('[PRODUCTS] Error listing products:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/products", authenticateToken, authorize("products", "view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows || []);
  } catch (e) {
    console.error('[PRODUCTS] Error listing products:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/products", authenticateToken, authorize("products", "create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO products(name, name_en, sku, barcode, category, unit, price, cost, tax_rate, stock_quantity, min_stock, description, is_active) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.name||'', b.name_en||'', b.sku||null, b.barcode||null, b.category||null, b.unit||'unit', 
       Number(b.price||0), Number(b.cost||0), Number(b.tax_rate||15), Number(b.stock_quantity||0), 
       Number(b.min_stock||0), b.description||null, b.is_active!==false]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error creating product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/products", authenticateToken, authorize("products", "create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO products(name, name_en, sku, barcode, category, unit, price, cost, tax_rate, stock_quantity, min_stock, description, is_active) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.name||'', b.name_en||'', b.sku||null, b.barcode||null, b.category||null, b.unit||'unit', 
       Number(b.price||0), Number(b.cost||0), Number(b.tax_rate||15), Number(b.stock_quantity||0), 
       Number(b.min_stock||0), b.description||null, b.is_active!==false]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error creating product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.put("/products/:id", authenticateToken, authorize("products", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    const { rows } = await pool.query(
      `UPDATE products SET name=COALESCE($1,name), name_en=COALESCE($2,name_en), sku=COALESCE($3,sku), 
       barcode=COALESCE($4,barcode), category=COALESCE($5,category), unit=COALESCE($6,unit), 
       price=COALESCE($7,price), cost=COALESCE($8,cost), tax_rate=COALESCE($9,tax_rate), 
       stock_quantity=COALESCE($10,stock_quantity), min_stock=COALESCE($11,min_stock), 
       description=COALESCE($12,description), is_active=COALESCE($13,is_active), updated_at=NOW() 
       WHERE id=$14 RETURNING *`,
      [b.name||null, b.name_en||null, b.sku||null, b.barcode||null, b.category||null, b.unit||null,
       b.price!=null?Number(b.price):null, b.cost!=null?Number(b.cost):null, b.tax_rate!=null?Number(b.tax_rate):null,
       b.stock_quantity!=null?Number(b.stock_quantity):null, b.min_stock!=null?Number(b.min_stock):null,
       b.description||null, b.is_active, id]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error updating product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.put("/api/products/:id", authenticateToken, authorize("products", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    const { rows } = await pool.query(
      `UPDATE products SET name=COALESCE($1,name), name_en=COALESCE($2,name_en), sku=COALESCE($3,sku), 
       barcode=COALESCE($4,barcode), category=COALESCE($5,category), unit=COALESCE($6,unit), 
       price=COALESCE($7,price), cost=COALESCE($8,cost), tax_rate=COALESCE($9,tax_rate), 
       stock_quantity=COALESCE($10,stock_quantity), min_stock=COALESCE($11,min_stock), 
       description=COALESCE($12,description), is_active=COALESCE($13,is_active), updated_at=NOW() 
       WHERE id=$14 RETURNING *`,
      [b.name||null, b.name_en||null, b.sku||null, b.barcode||null, b.category||null, b.unit||null,
       b.price!=null?Number(b.price):null, b.cost!=null?Number(b.cost):null, b.tax_rate!=null?Number(b.tax_rate):null,
       b.stock_quantity!=null?Number(b.stock_quantity):null, b.min_stock!=null?Number(b.min_stock):null,
       b.description||null, b.is_active, id]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error updating product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.delete("/products/:id", authenticateToken, authorize("products", "delete"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[PRODUCTS] Error deleting product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.delete("/api/products/:id", authenticateToken, authorize("products", "delete"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[PRODUCTS] Error deleting product:', e);
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

// Supplier invoices middleware - REMOVED: This was causing requests to hang
// The individual routes already have authorize() middleware
// This middleware was intercepting requests and not calling next() properly, causing silent failures

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

// ==================== ACCOUNTS API ====================
// Get accounts tree
app.get("/accounts", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry, created_at FROM accounts ORDER BY account_number ASC');
    // Build tree structure
    const accounts = rows || [];
    const byId = new Map(accounts.map(a => [a.id, { ...a, children: [] }]));
    const roots = [];
    for (const a of byId.values()) {
      if (a.parent_id) {
        const p = byId.get(a.parent_id);
        if (p) p.children.push(a);
        else roots.push(a);
      } else {
        roots.push(a);
      }
    }
    res.json(roots);
  } catch (e) {
    console.error('[ACCOUNTS] Error fetching accounts tree:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/accounts", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry, created_at FROM accounts ORDER BY account_number ASC');
    const accounts = rows || [];
    const byId = new Map(accounts.map(a => [a.id, { ...a, children: [] }]));
    const roots = [];
    for (const a of byId.values()) {
      if (a.parent_id) {
        const p = byId.get(a.parent_id);
        if (p) p.children.push(a);
        else roots.push(a);
      } else {
        roots.push(a);
      }
    }
    res.json(roots);
  } catch (e) {
    console.error('[ACCOUNTS] Error fetching accounts tree:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Create account
app.post("/accounts", authenticateToken, authorize("accounting", "create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [b.account_number||null, b.account_code||b.account_number||null, b.name||'', b.name_en||'', b.type||'asset', b.nature||'debit', b.parent_id||null, Number(b.opening_balance||0), b.allow_manual_entry!==false]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error creating account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/accounts", authenticateToken, authorize("accounting", "create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [b.account_number||null, b.account_code||b.account_number||null, b.name||'', b.name_en||'', b.type||'asset', b.nature||'debit', b.parent_id||null, Number(b.opening_balance||0), b.allow_manual_entry!==false]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error creating account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Update account
app.put("/accounts/:id", authenticateToken, authorize("accounting", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE accounts SET name=COALESCE($1,name), name_en=COALESCE($2,name_en), type=COALESCE($3,type), nature=COALESCE($4,nature), opening_balance=COALESCE($5,opening_balance), allow_manual_entry=COALESCE($6,allow_manual_entry), updated_at=NOW() WHERE id=$7 RETURNING *',
      [b.name||null, b.name_en||null, b.type||null, b.nature||null, b.opening_balance!=null?Number(b.opening_balance):null, b.allow_manual_entry, id]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error updating account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.put("/api/accounts/:id", authenticateToken, authorize("accounting", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE accounts SET name=COALESCE($1,name), name_en=COALESCE($2,name_en), type=COALESCE($3,type), nature=COALESCE($4,nature), opening_balance=COALESCE($5,opening_balance), allow_manual_entry=COALESCE($6,allow_manual_entry), updated_at=NOW() WHERE id=$7 RETURNING *',
      [b.name||null, b.name_en||null, b.type||null, b.nature||null, b.opening_balance!=null?Number(b.opening_balance):null, b.allow_manual_entry, id]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error updating account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Delete account
app.delete("/accounts/:id", authenticateToken, authorize("accounting", "delete"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const force = req.query.force === '1' || req.query.force === 'true';
    // Check if account has journal postings
    const { rows: postings } = await pool.query('SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1', [id]);
    if (!force && postings && postings[0] && Number(postings[0].count) > 0) {
      return res.status(400).json({ error: "account_has_postings", message: "Cannot delete account with journal postings" });
    }
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ACCOUNTS] Error deleting account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.delete("/api/accounts/:id", authenticateToken, authorize("accounting", "delete"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const force = req.query.force === '1' || req.query.force === 'true';
    const { rows: postings } = await pool.query('SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1', [id]);
    if (!force && postings && postings[0] && Number(postings[0].count) > 0) {
      return res.status(400).json({ error: "account_has_postings", message: "Cannot delete account with journal postings" });
    }
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ACCOUNTS] Error deleting account:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Seed default accounts tree
app.post("/accounts/seed-default", authenticateToken, authorize("accounting", "create"), async (req, res) => {
  try {
    // Check if accounts already exist - allow force recreate
    const forceRecreate = req.body?.force === true;
    const { rows: existing } = await pool.query('SELECT COUNT(*) as count FROM accounts');
    if (!forceRecreate && existing && existing[0] && Number(existing[0].count) > 0) {
      return res.status(400).json({ error: "accounts_exist", message: "Accounts already exist. Use force=true to recreate." });
    }
    
    // Clear existing accounts if force recreate
    if (forceRecreate) {
      await pool.query('DELETE FROM journal_postings');
      await pool.query('DELETE FROM accounts');
    }
    
    // شجرة حسابات كاملة متوافقة مع النظام السعودي
    const defaultAccounts = [
      // ═══════════════════════════════════════════════════════════════
      // 1000 - الأصول (Assets)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '1000', name: 'الأصول', name_en: 'Assets', type: 'asset', nature: 'debit' },
      
      // 1100 - الأصول المتداولة
      { account_number: '1100', name: 'الأصول المتداولة', name_en: 'Current Assets', type: 'asset', nature: 'debit', parent_number: '1000' },
      { account_number: '1110', name: 'النقدية والصندوق', name_en: 'Cash on Hand', type: 'cash', nature: 'debit', parent_number: '1100' },
      { account_number: '1111', name: 'صندوق فرع CHINA TOWN', name_en: 'Cash - China Town', type: 'cash', nature: 'debit', parent_number: '1110' },
      { account_number: '1112', name: 'صندوق فرع PLACE INDIA', name_en: 'Cash - Place India', type: 'cash', nature: 'debit', parent_number: '1110' },
      { account_number: '1120', name: 'البنوك', name_en: 'Banks', type: 'bank', nature: 'debit', parent_number: '1100' },
      { account_number: '1121', name: 'البنك الأهلي', name_en: 'Al Ahli Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1122', name: 'بنك الراجحي', name_en: 'Al Rajhi Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1123', name: 'بنك الإنماء', name_en: 'Alinma Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1130', name: 'الذمم المدينة', name_en: 'Accounts Receivable', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1131', name: 'ذمم العملاء', name_en: 'Customer Receivables', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1132', name: 'شيكات تحت التحصيل', name_en: 'Checks Under Collection', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1133', name: 'سلف الموظفين', name_en: 'Employee Advances', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1140', name: 'المخزون', name_en: 'Inventory', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1141', name: 'مخزون المواد الغذائية', name_en: 'Food Inventory', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1142', name: 'مخزون المشروبات', name_en: 'Beverages Inventory', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1143', name: 'مخزون مواد التعبئة', name_en: 'Packaging Inventory', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1150', name: 'مصروفات مدفوعة مقدماً', name_en: 'Prepaid Expenses', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1160', name: 'ضريبة القيمة المضافة المدفوعة', name_en: 'VAT Input', type: 'asset', nature: 'debit', parent_number: '1100' },
      
      // 1200 - الأصول الثابتة
      { account_number: '1200', name: 'الأصول الثابتة', name_en: 'Fixed Assets', type: 'asset', nature: 'debit', parent_number: '1000' },
      { account_number: '1210', name: 'المباني والإنشاءات', name_en: 'Buildings', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1220', name: 'الأثاث والتجهيزات', name_en: 'Furniture & Fixtures', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1230', name: 'معدات المطبخ', name_en: 'Kitchen Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1240', name: 'أجهزة الكمبيوتر', name_en: 'Computer Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1250', name: 'السيارات', name_en: 'Vehicles', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1290', name: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'asset', nature: 'credit', parent_number: '1200' },
      
      // ═══════════════════════════════════════════════════════════════
      // 2000 - الالتزامات (Liabilities)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '2000', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', nature: 'credit' },
      
      // 2100 - الالتزامات المتداولة
      { account_number: '2100', name: 'الالتزامات المتداولة', name_en: 'Current Liabilities', type: 'liability', nature: 'credit', parent_number: '2000' },
      { account_number: '2110', name: 'الذمم الدائنة', name_en: 'Accounts Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2111', name: 'ذمم الموردين', name_en: 'Supplier Payables', type: 'liability', nature: 'credit', parent_number: '2110' },
      { account_number: '2120', name: 'ضريبة القيمة المضافة المستحقة', name_en: 'VAT Output', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2130', name: 'الرواتب المستحقة', name_en: 'Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2131', name: 'رواتب الموظفين المستحقة', name_en: 'Employee Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2130' },
      { account_number: '2132', name: 'التأمينات الاجتماعية المستحقة', name_en: 'GOSI Payable', type: 'liability', nature: 'credit', parent_number: '2130' },
      { account_number: '2140', name: 'إيرادات مقبوضة مقدماً', name_en: 'Unearned Revenue', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2150', name: 'مصروفات مستحقة', name_en: 'Accrued Expenses', type: 'liability', nature: 'credit', parent_number: '2100' },
      
      // 2200 - الالتزامات طويلة الأجل
      { account_number: '2200', name: 'الالتزامات طويلة الأجل', name_en: 'Long-term Liabilities', type: 'liability', nature: 'credit', parent_number: '2000' },
      { account_number: '2210', name: 'القروض البنكية', name_en: 'Bank Loans', type: 'liability', nature: 'credit', parent_number: '2200' },
      { account_number: '2220', name: 'مكافأة نهاية الخدمة', name_en: 'End of Service Benefits', type: 'liability', nature: 'credit', parent_number: '2200' },
      
      // ═══════════════════════════════════════════════════════════════
      // 3000 - حقوق الملكية (Equity)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '3000', name: 'حقوق الملكية', name_en: 'Equity', type: 'equity', nature: 'credit' },
      { account_number: '3100', name: 'رأس المال', name_en: 'Capital', type: 'equity', nature: 'credit', parent_number: '3000' },
      { account_number: '3200', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', nature: 'credit', parent_number: '3000' },
      { account_number: '3300', name: 'أرباح/خسائر العام الحالي', name_en: 'Current Year P/L', type: 'equity', nature: 'credit', parent_number: '3000' },
      { account_number: '3400', name: 'المسحوبات الشخصية', name_en: 'Owner Withdrawals', type: 'equity', nature: 'debit', parent_number: '3000' },
      
      // ═══════════════════════════════════════════════════════════════
      // 4000 - الإيرادات (Revenue)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '4000', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', nature: 'credit' },
      { account_number: '4100', name: 'إيرادات المبيعات', name_en: 'Sales Revenue', type: 'revenue', nature: 'credit', parent_number: '4000' },
      { account_number: '4110', name: 'مبيعات فرع CHINA TOWN', name_en: 'Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4120', name: 'مبيعات فرع PLACE INDIA', name_en: 'Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4130', name: 'مبيعات التوصيل', name_en: 'Delivery Sales', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4200', name: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', nature: 'credit', parent_number: '4000' },
      { account_number: '4300', name: 'مردودات المبيعات', name_en: 'Sales Returns', type: 'revenue', nature: 'debit', parent_number: '4000' },
      { account_number: '4400', name: 'خصومات المبيعات', name_en: 'Sales Discounts', type: 'revenue', nature: 'debit', parent_number: '4000' },
      
      // ═══════════════════════════════════════════════════════════════
      // 5000 - المصروفات (Expenses)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '5000', name: 'المصروفات', name_en: 'Expenses', type: 'expense', nature: 'debit' },
      
      // 5100 - تكلفة المبيعات
      { account_number: '5100', name: 'تكلفة المبيعات', name_en: 'Cost of Goods Sold', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5110', name: 'تكلفة المواد الغذائية', name_en: 'Food Cost', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5120', name: 'تكلفة المشروبات', name_en: 'Beverage Cost', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5130', name: 'تكلفة التعبئة والتغليف', name_en: 'Packaging Cost', type: 'expense', nature: 'debit', parent_number: '5100' },
      
      // 5200 - مصروفات تشغيلية
      { account_number: '5200', name: 'مصروفات تشغيلية', name_en: 'Operating Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5210', name: 'الإيجار', name_en: 'Rent Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5220', name: 'الكهرباء', name_en: 'Electricity Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5230', name: 'المياه', name_en: 'Water Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5240', name: 'الاتصالات والإنترنت', name_en: 'Telecom & Internet', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5250', name: 'الصيانة والإصلاحات', name_en: 'Maintenance & Repairs', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5260', name: 'النظافة والتعقيم', name_en: 'Cleaning & Sanitation', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5270', name: 'الغاز', name_en: 'Gas Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      
      // 5300 - مصروفات إدارية وعمومية
      { account_number: '5300', name: 'مصروفات إدارية وعمومية', name_en: 'Administrative Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5310', name: 'الرواتب والأجور', name_en: 'Salaries & Wages', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5311', name: 'رواتب الموظفين', name_en: 'Employee Salaries', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5312', name: 'بدل السكن', name_en: 'Housing Allowance', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5313', name: 'بدل النقل', name_en: 'Transport Allowance', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5314', name: 'بدلات أخرى', name_en: 'Other Allowances', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5315', name: 'العمل الإضافي', name_en: 'Overtime', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5320', name: 'التأمينات الاجتماعية', name_en: 'GOSI Expense', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5330', name: 'التأمين الطبي', name_en: 'Medical Insurance', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5340', name: 'مصروفات التدريب', name_en: 'Training Expense', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5350', name: 'القرطاسية والمطبوعات', name_en: 'Stationery & Printing', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5360', name: 'الرسوم الحكومية', name_en: 'Government Fees', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5370', name: 'الاستشارات المهنية', name_en: 'Professional Fees', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5380', name: 'الإهلاك', name_en: 'Depreciation Expense', type: 'expense', nature: 'debit', parent_number: '5300' },
      
      // 5400 - مصروفات مالية
      { account_number: '5400', name: 'مصروفات مالية', name_en: 'Financial Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5410', name: 'عمولات البنوك', name_en: 'Bank Charges', type: 'expense', nature: 'debit', parent_number: '5400' },
      { account_number: '5420', name: 'عمولات نقاط البيع', name_en: 'POS Fees', type: 'expense', nature: 'debit', parent_number: '5400' },
      { account_number: '5430', name: 'فوائد القروض', name_en: 'Loan Interest', type: 'expense', nature: 'debit', parent_number: '5400' },
      
      // 5500 - مصروفات التسويق
      { account_number: '5500', name: 'مصروفات التسويق', name_en: 'Marketing Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5510', name: 'الإعلانات', name_en: 'Advertising', type: 'expense', nature: 'debit', parent_number: '5500' },
      { account_number: '5520', name: 'العروض والتخفيضات', name_en: 'Promotions', type: 'expense', nature: 'debit', parent_number: '5500' },
      
      // 5600 - مصروفات أخرى
      { account_number: '5600', name: 'مصروفات أخرى', name_en: 'Other Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5610', name: 'خسائر متنوعة', name_en: 'Miscellaneous Losses', type: 'expense', nature: 'debit', parent_number: '5600' },
      { account_number: '5620', name: 'غرامات وجزاءات', name_en: 'Fines & Penalties', type: 'expense', nature: 'debit', parent_number: '5600' },
    ];
    
    // Insert accounts
    const accountIdByNumber = {};
    for (const acc of defaultAccounts) {
      const parentId = acc.parent_number ? accountIdByNumber[acc.parent_number] : null;
      const { rows } = await pool.query(
        'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [acc.account_number, acc.account_number, acc.name, acc.name_en, acc.type, acc.nature, parentId, 0, true]
      );
      if (rows && rows[0]) {
        accountIdByNumber[acc.account_number] = rows[0].id;
      }
    }
    
    console.log(`[ACCOUNTS] Seeded ${defaultAccounts.length} accounts successfully`);
    res.json({ ok: true, count: defaultAccounts.length });
  } catch (e) {
    console.error('[ACCOUNTS] Error seeding default accounts:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// /api/accounts/seed-default - same handler as /accounts/seed-default
app.post("/api/accounts/seed-default", authenticateToken, authorize("accounting", "create"), async (req, res) => {
  try {
    const forceRecreate = req.body?.force === true;
    const { rows: existing } = await pool.query('SELECT COUNT(*) as count FROM accounts');
    if (!forceRecreate && existing && existing[0] && Number(existing[0].count) > 0) {
      return res.status(400).json({ error: "accounts_exist", message: "Accounts already exist. Use force=true to recreate." });
    }
    
    if (forceRecreate) {
      await pool.query('DELETE FROM journal_postings');
      await pool.query('DELETE FROM accounts');
    }
    
    // Same accounts as /accounts/seed-default
    const defaultAccounts = [
      { account_number: '1000', name: 'الأصول', name_en: 'Assets', type: 'asset', nature: 'debit' },
      { account_number: '1100', name: 'الأصول المتداولة', name_en: 'Current Assets', type: 'asset', nature: 'debit', parent_number: '1000' },
      { account_number: '1110', name: 'النقدية والصندوق', name_en: 'Cash on Hand', type: 'cash', nature: 'debit', parent_number: '1100' },
      { account_number: '1111', name: 'صندوق فرع CHINA TOWN', name_en: 'Cash - China Town', type: 'cash', nature: 'debit', parent_number: '1110' },
      { account_number: '1112', name: 'صندوق فرع PLACE INDIA', name_en: 'Cash - Place India', type: 'cash', nature: 'debit', parent_number: '1110' },
      { account_number: '1120', name: 'البنوك', name_en: 'Banks', type: 'bank', nature: 'debit', parent_number: '1100' },
      { account_number: '1121', name: 'البنك الأهلي', name_en: 'Al Ahli Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1122', name: 'بنك الراجحي', name_en: 'Al Rajhi Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1123', name: 'بنك الإنماء', name_en: 'Alinma Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1130', name: 'الذمم المدينة', name_en: 'Accounts Receivable', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1131', name: 'ذمم العملاء', name_en: 'Customer Receivables', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1132', name: 'شيكات تحت التحصيل', name_en: 'Checks Under Collection', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1133', name: 'سلف الموظفين', name_en: 'Employee Advances', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1140', name: 'المخزون', name_en: 'Inventory', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1141', name: 'مخزون المواد الغذائية', name_en: 'Food Inventory', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1142', name: 'مخزون المشروبات', name_en: 'Beverages Inventory', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1143', name: 'مخزون مواد التعبئة', name_en: 'Packaging Inventory', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1150', name: 'مصروفات مدفوعة مقدماً', name_en: 'Prepaid Expenses', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1160', name: 'ضريبة القيمة المضافة المدفوعة', name_en: 'VAT Input', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1200', name: 'الأصول الثابتة', name_en: 'Fixed Assets', type: 'asset', nature: 'debit', parent_number: '1000' },
      { account_number: '1210', name: 'المباني والإنشاءات', name_en: 'Buildings', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1220', name: 'الأثاث والتجهيزات', name_en: 'Furniture & Fixtures', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1230', name: 'معدات المطبخ', name_en: 'Kitchen Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1240', name: 'أجهزة الكمبيوتر', name_en: 'Computer Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1250', name: 'السيارات', name_en: 'Vehicles', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1290', name: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'asset', nature: 'credit', parent_number: '1200' },
      { account_number: '2000', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', nature: 'credit' },
      { account_number: '2100', name: 'الالتزامات المتداولة', name_en: 'Current Liabilities', type: 'liability', nature: 'credit', parent_number: '2000' },
      { account_number: '2110', name: 'الذمم الدائنة', name_en: 'Accounts Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2111', name: 'ذمم الموردين', name_en: 'Supplier Payables', type: 'liability', nature: 'credit', parent_number: '2110' },
      { account_number: '2120', name: 'ضريبة القيمة المضافة المستحقة', name_en: 'VAT Output', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2130', name: 'الرواتب المستحقة', name_en: 'Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2131', name: 'رواتب الموظفين المستحقة', name_en: 'Employee Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2130' },
      { account_number: '2132', name: 'التأمينات الاجتماعية المستحقة', name_en: 'GOSI Payable', type: 'liability', nature: 'credit', parent_number: '2130' },
      { account_number: '2140', name: 'إيرادات مقبوضة مقدماً', name_en: 'Unearned Revenue', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2150', name: 'مصروفات مستحقة', name_en: 'Accrued Expenses', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2200', name: 'الالتزامات طويلة الأجل', name_en: 'Long-term Liabilities', type: 'liability', nature: 'credit', parent_number: '2000' },
      { account_number: '2210', name: 'القروض البنكية', name_en: 'Bank Loans', type: 'liability', nature: 'credit', parent_number: '2200' },
      { account_number: '2220', name: 'مكافأة نهاية الخدمة', name_en: 'End of Service Benefits', type: 'liability', nature: 'credit', parent_number: '2200' },
      { account_number: '3000', name: 'حقوق الملكية', name_en: 'Equity', type: 'equity', nature: 'credit' },
      { account_number: '3100', name: 'رأس المال', name_en: 'Capital', type: 'equity', nature: 'credit', parent_number: '3000' },
      { account_number: '3200', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', nature: 'credit', parent_number: '3000' },
      { account_number: '3300', name: 'أرباح/خسائر العام الحالي', name_en: 'Current Year P/L', type: 'equity', nature: 'credit', parent_number: '3000' },
      { account_number: '3400', name: 'المسحوبات الشخصية', name_en: 'Owner Withdrawals', type: 'equity', nature: 'debit', parent_number: '3000' },
      { account_number: '4000', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', nature: 'credit' },
      { account_number: '4100', name: 'إيرادات المبيعات', name_en: 'Sales Revenue', type: 'revenue', nature: 'credit', parent_number: '4000' },
      { account_number: '4110', name: 'مبيعات فرع CHINA TOWN', name_en: 'Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4120', name: 'مبيعات فرع PLACE INDIA', name_en: 'Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4130', name: 'مبيعات التوصيل', name_en: 'Delivery Sales', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4200', name: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', nature: 'credit', parent_number: '4000' },
      { account_number: '4300', name: 'مردودات المبيعات', name_en: 'Sales Returns', type: 'revenue', nature: 'debit', parent_number: '4000' },
      { account_number: '4400', name: 'خصومات المبيعات', name_en: 'Sales Discounts', type: 'revenue', nature: 'debit', parent_number: '4000' },
      { account_number: '5000', name: 'المصروفات', name_en: 'Expenses', type: 'expense', nature: 'debit' },
      { account_number: '5100', name: 'تكلفة المبيعات', name_en: 'Cost of Goods Sold', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5110', name: 'تكلفة المواد الغذائية', name_en: 'Food Cost', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5120', name: 'تكلفة المشروبات', name_en: 'Beverage Cost', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5130', name: 'تكلفة التعبئة والتغليف', name_en: 'Packaging Cost', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5200', name: 'مصروفات تشغيلية', name_en: 'Operating Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5210', name: 'الإيجار', name_en: 'Rent Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5220', name: 'الكهرباء', name_en: 'Electricity Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5230', name: 'المياه', name_en: 'Water Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5240', name: 'الاتصالات والإنترنت', name_en: 'Telecom & Internet', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5250', name: 'الصيانة والإصلاحات', name_en: 'Maintenance & Repairs', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5260', name: 'النظافة والتعقيم', name_en: 'Cleaning & Sanitation', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5270', name: 'الغاز', name_en: 'Gas Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5300', name: 'مصروفات إدارية وعمومية', name_en: 'Administrative Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5310', name: 'الرواتب والأجور', name_en: 'Salaries & Wages', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5311', name: 'رواتب الموظفين', name_en: 'Employee Salaries', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5312', name: 'بدل السكن', name_en: 'Housing Allowance', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5313', name: 'بدل النقل', name_en: 'Transport Allowance', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5314', name: 'بدلات أخرى', name_en: 'Other Allowances', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5315', name: 'العمل الإضافي', name_en: 'Overtime', type: 'expense', nature: 'debit', parent_number: '5310' },
      { account_number: '5320', name: 'التأمينات الاجتماعية', name_en: 'GOSI Expense', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5330', name: 'التأمين الطبي', name_en: 'Medical Insurance', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5340', name: 'مصروفات التدريب', name_en: 'Training Expense', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5350', name: 'القرطاسية والمطبوعات', name_en: 'Stationery & Printing', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5360', name: 'الرسوم الحكومية', name_en: 'Government Fees', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5370', name: 'الاستشارات المهنية', name_en: 'Professional Fees', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5380', name: 'الإهلاك', name_en: 'Depreciation Expense', type: 'expense', nature: 'debit', parent_number: '5300' },
      { account_number: '5400', name: 'مصروفات مالية', name_en: 'Financial Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5410', name: 'عمولات البنوك', name_en: 'Bank Charges', type: 'expense', nature: 'debit', parent_number: '5400' },
      { account_number: '5420', name: 'عمولات نقاط البيع', name_en: 'POS Fees', type: 'expense', nature: 'debit', parent_number: '5400' },
      { account_number: '5430', name: 'فوائد القروض', name_en: 'Loan Interest', type: 'expense', nature: 'debit', parent_number: '5400' },
      { account_number: '5500', name: 'مصروفات التسويق', name_en: 'Marketing Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5510', name: 'الإعلانات', name_en: 'Advertising', type: 'expense', nature: 'debit', parent_number: '5500' },
      { account_number: '5520', name: 'العروض والتخفيضات', name_en: 'Promotions', type: 'expense', nature: 'debit', parent_number: '5500' },
      { account_number: '5600', name: 'مصروفات أخرى', name_en: 'Other Expenses', type: 'expense', nature: 'debit', parent_number: '5000' },
      { account_number: '5610', name: 'خسائر متنوعة', name_en: 'Miscellaneous Losses', type: 'expense', nature: 'debit', parent_number: '5600' },
      { account_number: '5620', name: 'غرامات وجزاءات', name_en: 'Fines & Penalties', type: 'expense', nature: 'debit', parent_number: '5600' },
    ];
    
    const accountIdByNumber = {};
    for (const acc of defaultAccounts) {
      const parentId = acc.parent_number ? accountIdByNumber[acc.parent_number] : null;
      const { rows } = await pool.query(
        'INSERT INTO accounts(account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [acc.account_number, acc.account_number, acc.name, acc.name_en, acc.type, acc.nature, parentId, 0, true]
      );
      if (rows && rows[0]) accountIdByNumber[acc.account_number] = rows[0].id;
    }
    
    console.log(`[ACCOUNTS] Seeded ${defaultAccounts.length} accounts via /api path`);
    res.json({ ok: true, count: defaultAccounts.length });
  } catch (e) {
    console.error('[ACCOUNTS] Error seeding default accounts:', e);
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
      'UPDATE partners SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), customer_type=COALESCE($4,customer_type), contact_info=COALESCE($5,contact_info), updated_at=NOW() WHERE id=$6 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
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
      'UPDATE partners SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), customer_type=COALESCE($4,customer_type), contact_info=COALESCE($5,contact_info), updated_at=NOW() WHERE id=$6 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
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
async function handleGetSupplierInvoices(req, res) {
  try {
    const { rows } = await pool.query('SELECT id, number, date, due_date, supplier_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at FROM supplier_invoices ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { 
    console.error('[SUPPLIER INVOICES] Error listing:', e);
    res.json({ items: [] }); 
  }
}
app.get("/supplier-invoices", authenticateToken, authorize("purchases","view", { branchFrom: r => (r.query.branch || null) }), handleGetSupplierInvoices);
app.get("/api/supplier-invoices", authenticateToken, authorize("purchases","view", { branchFrom: r => (r.query.branch || null) }), handleGetSupplierInvoices);
async function handleGetSupplierInvoiceNextNumber(req, res) {
  try {
    const { rows } = await pool.query('SELECT number FROM supplier_invoices ORDER BY id DESC LIMIT 1');
    const last = rows && rows[0] ? String(rows[0].number||'') : '';
    const seq = (function(){ const m = /PI\/(\d{4})\/(\d+)/.exec(last); const year = (new Date()).getFullYear(); const nextN = m && Number(m[1])===year ? Number(m[2]||0)+1 : 1; return `PI/${year}/${String(nextN).padStart(10,'0')}` })();
    res.json({ next: seq });
  } catch (e) { 
    console.error('[SUPPLIER INVOICES] Error getting next number:', e);
    res.json({ next: null }); 
  }
}
app.get("/supplier-invoices/next-number", authenticateToken, authorize("purchases","create"), handleGetSupplierInvoiceNextNumber);
app.get("/api/supplier-invoices/next-number", authenticateToken, authorize("purchases","create"), handleGetSupplierInvoiceNextNumber);
// Supplier Invoices - both /supplier-invoices and /api/supplier-invoices
async function handleCreateSupplierInvoice(req, res) {
  try {
    console.log('[SUPPLIER INVOICE] Creating invoice | userId=', req.user?.id, 'email=', req.user?.email);
    const b = req.body || {};
    console.log('[SUPPLIER INVOICE BODY]', JSON.stringify({ 
      number: b.number, 
      date: b.date, 
      supplier_id: b.supplier_id, 
      lines_count: Array.isArray(b.lines) ? b.lines.length : 0,
      status: b.status,
      total: b.total 
    }));
    
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const subtotal = Number(b.subtotal||0);
    const discount_pct = Number(b.discount_pct||0);
    const discount_amount = Number(b.discount_amount||0);
    const tax_pct = Number(b.tax_pct||0);
    const tax_amount = Number(b.tax_amount||0);
    const total = Number(b.total||0);
    const branch = b.branch || req.user?.default_branch || 'china_town';
    
    // CRITICAL: Stringify lines array for JSONB storage
    const linesJson = JSON.stringify(lines);
    
    console.log('[SUPPLIER INVOICE] Executing INSERT...');
    const { rows } = await pool.query(
      'INSERT INTO supplier_invoices(number, date, due_date, supplier_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.due_date||null, b.supplier_id||null, linesJson, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, b.payment_method||null, b.status||'draft', branch]
    );
    
    console.log('[SUPPLIER INVOICE] SUCCESS | id=', rows?.[0]?.id);
    res.status(201).json(rows && rows[0]);
  } catch (e) { 
    console.error('[SUPPLIER INVOICE ERROR]', e);
    console.error('[SUPPLIER INVOICE ERROR STACK]', e?.stack);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
}
app.post("/supplier-invoices", authenticateToken, authorize("purchases","create", { branchFrom: r => (r.body?.branch || null) }), handleCreateSupplierInvoice);
app.post("/api/supplier-invoices", authenticateToken, authorize("purchases","create", { branchFrom: r => (r.body?.branch || null) }), handleCreateSupplierInvoice);
async function handleUpdateSupplierInvoice(req, res) {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? JSON.stringify(b.lines) : (b.lines || null);
    const { rows } = await pool.query(
      'UPDATE supplier_invoices SET number=COALESCE($1,number), date=COALESCE($2,date), due_date=COALESCE($3,due_date), supplier_id=COALESCE($4,supplier_id), lines=COALESCE($5,lines), subtotal=COALESCE($6,subtotal), discount_pct=COALESCE($7,discount_pct), discount_amount=COALESCE($8,discount_amount), tax_pct=COALESCE($9,tax_pct), tax_amount=COALESCE($10,tax_amount), total=COALESCE($11,total), payment_method=COALESCE($12,payment_method), status=COALESCE($13,status), branch=COALESCE($14,branch), updated_at=NOW() WHERE id=$15 RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.due_date||null, b.supplier_id||null, lines, (b.subtotal!=null?Number(b.subtotal):null), (b.discount_pct!=null?Number(b.discount_pct):null), (b.discount_amount!=null?Number(b.discount_amount):null), (b.tax_pct!=null?Number(b.tax_pct):null), (b.tax_amount!=null?Number(b.tax_amount):null), (b.total!=null?Number(b.total):null), b.payment_method||null, b.status||null, b.branch||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { 
    console.error('[SUPPLIER INVOICES] Error updating:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.put("/supplier-invoices/:id", authenticateToken, authorize("purchases","edit", { branchFrom: r => (r.body?.branch || null) }), handleUpdateSupplierInvoice);
app.put("/api/supplier-invoices/:id", authenticateToken, authorize("purchases","edit", { branchFrom: r => (r.body?.branch || null) }), handleUpdateSupplierInvoice);

async function handlePostSupplierInvoice(req, res) {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query('UPDATE supplier_invoices SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, number, status', ['posted', id]);
    res.json(rows && rows[0]);
  } catch (e) { 
    console.error('[SUPPLIER INVOICES] Error posting:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.post("/supplier-invoices/:id/post", authenticateToken, authorize("purchases","edit"), handlePostSupplierInvoice);
app.post("/api/supplier-invoices/:id/post", authenticateToken, authorize("purchases","edit"), handlePostSupplierInvoice);

async function handleDeleteSupplierInvoice(req, res) {
  try {
    const id = Number(req.params.id||0);
    await pool.query('DELETE FROM supplier_invoices WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { 
    console.error('[SUPPLIER INVOICES] Error deleting:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.delete("/supplier-invoices/:id", authenticateToken, authorize("purchases","delete"), handleDeleteSupplierInvoice);
app.delete("/api/supplier-invoices/:id", authenticateToken, authorize("purchases","delete"), handleDeleteSupplierInvoice);
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
// Orders API - both /orders and /api/orders paths
async function handleGetOrders(req, res) {
  try {
    const branch = req.query?.branch || null;
    const table = req.query?.table || null;
    const status = req.query?.status || null;
    let query = 'SELECT id, branch, table_code, lines, status, created_at FROM orders WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (branch) {
      query += ` AND branch = $${paramIndex}`;
      params.push(branch);
      paramIndex++;
    }
    if (table) {
      query += ` AND table_code = $${paramIndex}`;
      params.push(table);
      paramIndex++;
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim().toUpperCase());
      query += ` AND status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }
    query += ' ORDER BY id DESC';
    
    const { rows } = await pool.query(query, params);
    // Parse lines from JSON string to array
    const orders = (rows || []).map(order => {
      if (order.lines && typeof order.lines === 'string') {
        try {
          order.lines = JSON.parse(order.lines);
        } catch {}
      }
      return order;
    });
    res.json(orders);
  } catch (e) { 
    console.error('[ORDERS] Error listing orders:', e);
    res.json([]); 
  }
}
app.get("/orders", authenticateToken, authorize("sales","view"), handleGetOrders);
app.get("/api/orders", authenticateToken, authorize("sales","view"), handleGetOrders);

async function handleGetOrder(req, res) {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query('SELECT id, branch, table_code, lines, status, created_at FROM orders WHERE id=$1', [id]);
    const order = rows && rows[0];
    if (order && order.lines && typeof order.lines === 'string') {
      try {
        order.lines = JSON.parse(order.lines);
      } catch {}
    }
    res.json(order || null);
  } catch (e) { 
    console.error('[ORDERS] Error getting order:', e);
    res.json(null); 
  }
}
app.get("/orders/:id", authenticateToken, authorize("sales","view"), handleGetOrder);
app.get("/api/orders/:id", authenticateToken, authorize("sales","view"), handleGetOrder);

async function handleCreateOrder(req, res) {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const table_code = String(b.table || b.table_code || '');
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const { rows } = await pool.query('INSERT INTO orders(branch, table_code, lines, status) VALUES ($1,$2,$3,$4) RETURNING id, branch, table_code, status', [branch, table_code, JSON.stringify(lines), 'DRAFT']);
    res.json(rows && rows[0]);
  } catch (e) { 
    console.error('[ORDERS] Error creating order:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.post("/orders", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleCreateOrder);
app.post("/api/orders", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleCreateOrder);

async function handleUpdateOrder(req, res) {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? JSON.stringify(b.lines) : (b.lines || null);
    const { rows } = await pool.query('UPDATE orders SET branch=COALESCE($1,branch), table_code=COALESCE($2,table_code), lines=COALESCE($3,lines), status=COALESCE($4,status), updated_at=NOW() WHERE id=$5 RETURNING id, branch, table_code, lines, status', [b.branch||null, (b.table||b.table_code||null), lines, b.status||null, id]);
    const order = rows && rows[0];
    if (order && order.lines && typeof order.lines === 'string') {
      try {
        order.lines = JSON.parse(order.lines);
      } catch {}
    }
    res.json(order);
  } catch (e) { 
    console.error('[ORDERS] Error updating order:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.put("/orders/:id", authenticateToken, authorize("sales","edit", { branchFrom: r => (r.body?.branch || null) }), handleUpdateOrder);
app.put("/api/orders/:id", authenticateToken, authorize("sales","edit", { branchFrom: r => (r.body?.branch || null) }), handleUpdateOrder);

async function handleDeleteOrder(req, res) {
  try {
    const id = Number(req.params.id||0);
    await pool.query('DELETE FROM orders WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { 
    console.error('[ORDERS] Error deleting order:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.delete("/orders/:id", authenticateToken, authorize("sales","delete"), handleDeleteOrder);
app.delete("/api/orders/:id", authenticateToken, authorize("sales","delete"), handleDeleteOrder);
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
// POS Tables Layout - both paths
async function handleGetTablesLayout(req, res) {
  try {
    const branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const key = `pos_tables_layout_${branch}`;
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    const v = rows && rows[0] ? rows[0].value : null;
    const out = v && v.rows ? v : { rows: [] };
    res.json(out);
  } catch (e) { res.json({ rows: [] }); }
}
app.get("/pos/tables-layout", authenticateToken, handleGetTablesLayout);
app.get("/api/pos/tables-layout", authenticateToken, handleGetTablesLayout);

async function handlePutTablesLayout(req, res) {
  try {
    const branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const key = `pos_tables_layout_${branch}`;
    const value = req.body || {};
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "server_error" }); }
}
app.put("/pos/tables-layout", authenticateToken, authorize("sales","edit"), handlePutTablesLayout);
app.put("/api/pos/tables-layout", authenticateToken, authorize("sales","edit"), handlePutTablesLayout);

async function handleGetTableState(req, res) {
  try {
    const branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const { rows } = await pool.query('SELECT table_code FROM orders WHERE branch = $1 AND status = $2', [branch, 'DRAFT']);
    const busy = (rows || []).map(r => r.table_code).filter(Boolean);
    res.json({ busy });
  } catch (e) { res.json({ busy: [] }); }
}
app.get("/pos/table-state", authenticateToken, handleGetTableState);
app.get("/api/pos/table-state", authenticateToken, handleGetTableState);

async function handleVerifyCancel(req, res) {
  try {
    const branch = String(req.body?.branch || req.user?.default_branch || 'china_town');
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [`settings_branch_${branch}`]);
    const v = rows && rows[0] ? rows[0].value : null;
    const pwd = v && v.cancel_password ? String(v.cancel_password) : '';
    const ok = !pwd || String(req.body?.password || '') === pwd;
    res.json(ok);
  } catch (e) { res.json(true); }
}
app.post("/pos/verify-cancel", authenticateToken, handleVerifyCancel);
app.post("/api/pos/verify-cancel", authenticateToken, handleVerifyCancel);

// Legacy saveDraft - kept for compatibility
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
// ============================================================================
// ACCOUNTING HELPER FUNCTIONS
// ============================================================================

/**
 * Get account ID by account number
 */
async function getAccountIdByNumber(accountNumber) {
  if (!accountNumber) return null;
  try {
    const { rows } = await pool.query('SELECT id FROM accounts WHERE account_number = $1 OR account_code = $1 LIMIT 1', [String(accountNumber)]);
    return rows && rows[0] ? rows[0].id : null;
  } catch (e) {
    console.error('[ACCOUNTING] Error getting account by number:', accountNumber, e);
    return null;
  }
}

/**
 * Get or create partner account (customer/supplier sub-account)
 */
async function getOrCreatePartnerAccount(partnerId, partnerType) {
  if (!partnerId) return null;
  try {
    // Check if partner already has an account
    const { rows: partnerRows } = await pool.query('SELECT account_id, name FROM partners WHERE id = $1', [partnerId]);
    if (partnerRows && partnerRows[0] && partnerRows[0].account_id) {
      return partnerRows[0].account_id;
    }

    // Get parent account based on type
    const parentAccountNumber = partnerType === 'supplier' ? '2111' : '1131'; // Suppliers: 2111, Customers: 1131
    const parentAccountId = await getAccountIdByNumber(parentAccountNumber);
    if (!parentAccountId) {
      console.warn(`[ACCOUNTING] Parent account ${parentAccountNumber} not found for partner ${partnerId}`);
      return null;
    }

    // Get partner name
    const partnerName = partnerRows && partnerRows[0] ? partnerRows[0].name : `Partner ${partnerId}`;

    // Create sub-account for partner
    const { rows: accountRows } = await pool.query(
      'INSERT INTO accounts(account_number, account_code, name, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [null, null, partnerName, partnerType === 'supplier' ? 'liability' : 'asset', partnerType === 'supplier' ? 'credit' : 'debit', parentAccountId, 0, false]
    );

    const accountId = accountRows && accountRows[0] ? accountRows[0].id : null;
    if (accountId) {
      // Update partner with account_id
      await pool.query('UPDATE partners SET account_id = $1 WHERE id = $2', [accountId, partnerId]);
    }
    return accountId;
  } catch (e) {
    console.error('[ACCOUNTING] Error getting/creating partner account:', partnerId, e);
    return null;
  }
}

/**
 * Create journal entry for invoice
 */
async function createInvoiceJournalEntry(invoiceId, customerId, subtotal, discount, tax, total, paymentMethod, branch) {
  try {
    // Get next entry number
    const { rows: lastEntry } = await pool.query('SELECT entry_number FROM journal_entries ORDER BY entry_number DESC LIMIT 1');
    const entryNumber = lastEntry && lastEntry[0] ? lastEntry[0].entry_number + 1 : 1;

    const postings = [];
    
    // Get customer account (if credit sale)
    if (customerId && paymentMethod && String(paymentMethod).toLowerCase() === 'credit') {
      const customerAccountId = await getOrCreatePartnerAccount(customerId, 'customer');
      if (customerAccountId) {
        // Debit: Customer Receivable
        postings.push({ account_id: customerAccountId, debit: total, credit: 0 });
      }
    } else {
      // Cash sale - use cash account (1101)
      const cashAccountId = await getAccountIdByNumber('1101');
      if (cashAccountId) {
        postings.push({ account_id: cashAccountId, debit: total, credit: 0 });
      }
    }

    // Credit: Sales Revenue (4101)
    const salesAccountId = await getAccountIdByNumber('4101');
    if (salesAccountId) {
      postings.push({ account_id: salesAccountId, debit: 0, credit: subtotal - discount });
    }

    // Credit: VAT Output (2120) if tax > 0
    if (tax > 0) {
      const vatAccountId = await getAccountIdByNumber('2120');
      if (vatAccountId) {
        postings.push({ account_id: vatAccountId, debit: 0, credit: tax });
      }
    }

    // Validate postings balance
    const totalDebit = postings.reduce((sum, p) => sum + Number(p.debit || 0), 0);
    const totalCredit = postings.reduce((sum, p) => sum + Number(p.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.error('[ACCOUNTING] Journal entry unbalanced:', { totalDebit, totalCredit, postings });
      return null;
    }

    // Create journal entry
    const { rows: entryRows } = await pool.query(
      'INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [entryNumber, `فاتورة مبيعات #${invoiceId}`, new Date(), 'invoice', invoiceId]
    );

    const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
    if (!entryId) return null;

    // Create postings
    for (const posting of postings) {
      await pool.query(
        'INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,$4)',
        [entryId, posting.account_id, posting.debit, posting.credit]
      );
    }

    console.log(`[ACCOUNTING] Created journal entry #${entryNumber} for invoice ${invoiceId}`);
    return entryId;
  } catch (e) {
    console.error('[ACCOUNTING] Error creating journal entry for invoice:', invoiceId, e);
    return null;
  }
}

// POS Issue Invoice - both paths for compatibility
async function handleIssueInvoice(req, res) {
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
    
    // Insert invoice
    const { rows } = await pool.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, status, total, branch',
      [number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch]
    );
    
    const invoice = rows && rows[0];
    if (!invoice) {
      return res.status(500).json({ error: "server_error", details: "Failed to create invoice" });
    }

    // Create journal entry automatically
    if (status === 'posted' && total > 0) {
      await createInvoiceJournalEntry(
        invoice.id,
        customer_id,
        subtotal,
        discount_amount,
        tax_amount,
        total,
        payment_method,
        branch
      );
    }

    res.json(invoice);
  } catch (e) { 
    console.error('[POS] issueInvoice error:', e);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
}
app.post("/pos/issueInvoice", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleIssueInvoice);
app.post("/api/pos/issueInvoice", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleIssueInvoice);

// POS Save Draft - both paths for compatibility
async function handleSaveDraft(req, res) {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const table_code = b.table || b.table_code || null;
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const order_id = b.order_id || null;
    
    if (order_id) {
      // Update existing order
      const { rows } = await pool.query(
        'UPDATE orders SET lines=$1, updated_at=NOW() WHERE id=$2 RETURNING id, branch, table_code, status',
        [JSON.stringify(lines), order_id]
      );
      return res.json(rows && rows[0]);
    }
    
    // Create new order
    const { rows } = await pool.query(
      'INSERT INTO orders(branch, table_code, lines, status) VALUES ($1,$2,$3,$4) RETURNING id, branch, table_code, status',
      [branch, table_code, JSON.stringify(lines), 'DRAFT']
    );
    res.json(rows && rows[0]);
  } catch (e) { 
    console.error('[POS] saveDraft error:', e);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
}
app.post("/api/pos/saveDraft", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleSaveDraft);
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
