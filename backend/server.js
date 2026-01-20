import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import { createAdmin } from "./createAdmin.js";
import { pool } from "./db.js";
import { authenticateToken } from "./middleware/auth.js";
import { authorize } from "./middleware/authorize.js";
import { checkAccountingPeriod } from "./middleware/checkAccountingPeriod.js";
import { isAdminUser } from "./utils/auth.js";

// CRITICAL: Register JSONB type parser for pg library
// This ensures pg library correctly handles JSONB conversion
pg.types.setTypeParser(pg.types.builtins.JSONB, (val) => {
  return val ? JSON.parse(val) : null;
});

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4000); // Default 4000, but can be overridden (e.g., 5000 for dev)

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
// Serve favicon.ico from public folder
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(buildPath, 'favicon.ico'), (err) => {
    if (err) res.status(204).end();
  });
});

// Serve zatca.svg from public folder
app.get('/zatca.svg', (req, res) => {
  res.sendFile(path.join(buildPath, 'zatca.svg'), (err) => {
    if (err) res.status(404).json({ error: 'not_found' });
  });
});

// Handle nested paths for static files (e.g., /expenses/favicon.ico -> /favicon.ico)
app.get('*/favicon.ico', (req, res) => {
  res.sendFile(path.join(buildPath, 'favicon.ico'), (err) => {
    if (err) res.status(204).end();
  });
});

app.get('*/zatca.svg', (req, res) => {
  res.sendFile(path.join(buildPath, 'zatca.svg'), (err) => {
    if (err) res.status(404).json({ error: 'not_found' });
  });
});
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(buildPath, 'manifest.json'), (err) => {
    if (err) {
      console.warn('[STATIC] manifest.json not found, returning 404');
      res.status(404).end();
    }
  });
});
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(buildPath, 'robots.txt'), (err) => {
    if (err) {
      console.warn('[STATIC] robots.txt not found, returning 404');
      res.status(404).end();
    }
  });
});

// Health check endpoint for development
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    env: process.env.NODE_ENV || 'development',
    port: port,
    timestamp: new Date().toISOString()
  });
});

// Bootstrap endpoint - load all initial data in one request
app.get("/api/bootstrap", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // OPTIMIZATION: Load all data in parallel for faster response
    const [
      settings,
      branches,
      products,
      partners,
      permissions
    ] = await Promise.all([
      // Load company settings
      pool.query("SELECT key, value FROM settings WHERE key LIKE 'settings_%'").then(r => {
        const result = {};
        (r.rows || []).forEach(row => {
          try {
            result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          } catch {
            result[row.key] = row.value;
          }
        });
        return result;
      }).catch(() => ({})),
      
      // Load branches
      pool.query("SELECT id, name, code, address, phone FROM branches ORDER BY name").then(r => r.rows || []).catch(() => []),
      
      // Load products (active only, limit to 1000 for performance)
      pool.query("SELECT id, name, name_en, sku, barcode, category, unit, price, cost, COALESCE(stock_qty, 0) as stock_quantity, is_active FROM products WHERE is_active = true ORDER BY name LIMIT 1000").then(r => r.rows || []).catch(() => []),
      
      // Load partners (customers only, limit to 500)
      pool.query("SELECT id, name, phone, type, customer_type FROM partners WHERE type LIKE '%عميل%' OR type LIKE '%customer%' ORDER BY name LIMIT 500").then(r => r.rows || []).catch(() => []),
      
      // Load user permissions
      pool.query(`
        SELECT screen_code, branch_code, action_code, allowed
        FROM user_permissions
        WHERE user_id = $1
      `, [userId]).then(r => {
        const result = {};
        (r.rows || []).forEach(row => {
          const key = `${row.screen_code}_${row.action_code}`;
          result[key] = row.allowed;
        });
        return result;
      }).catch(() => ({}))
    ]);

    res.json({
      settings,
      branches,
      products,
      partners,
      permissions,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('[BOOTSTRAP] Error:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Bootstrap endpoint - load all initial data in one request
app.get("/api/bootstrap", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // OPTIMIZATION: Load all data in parallel for faster response
    const [
      settings,
      branches,
      products,
      partners,
      permissions
    ] = await Promise.all([
      // Load company settings
      pool.query("SELECT key, value FROM settings WHERE key LIKE 'settings_%'").then(r => {
        const result = {};
        (r.rows || []).forEach(row => {
          try {
            result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          } catch {
            result[row.key] = row.value;
          }
        });
        return result;
      }).catch(() => ({})),
      
      // Load branches
      pool.query("SELECT id, name, code, address, phone FROM branches ORDER BY name").then(r => r.rows || []).catch(() => []),
      
      // Load products (active only, limit to 1000 for performance)
      pool.query("SELECT id, name, name_en, sku, barcode, category, unit, price, cost, COALESCE(stock_qty, 0) as stock_quantity, is_active FROM products WHERE is_active = true ORDER BY name LIMIT 1000").then(r => r.rows || []).catch(() => []),
      
      // Load partners (customers only, limit to 500)
      pool.query("SELECT id, name, phone, type, customer_type FROM partners WHERE type LIKE '%عميل%' OR type LIKE '%customer%' ORDER BY name LIMIT 500").then(r => r.rows || []).catch(() => []),
      
      // Load user permissions
      pool.query(`
        SELECT s.code as screen_code, a.code as action_code, COALESCE(up.allowed, true) as allowed
        FROM users u
        LEFT JOIN role_permissions rp ON rp.role_id = u.role_id
        LEFT JOIN screens s ON s.id = rp.screen_id
        LEFT JOIN actions a ON a.id = rp.action_id
        LEFT JOIN user_permissions up ON up.user_id = u.id AND up.screen_code = s.code AND up.action_code = a.code
        WHERE u.id = $1
      `, [userId]).then(r => {
        const result = {};
        (r.rows || []).forEach(row => {
          if (row.screen_code && row.action_code) {
            const key = `${row.screen_code}_${row.action_code}`;
            result[key] = row.allowed;
          }
        });
        return result;
      }).catch(() => ({}))
    ]);

    res.json({
      settings,
      branches,
      products,
      partners,
      permissions,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('[BOOTSTRAP] Error:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// 2.5️⃣ CRITICAL: SPA Fallback for Frontend Routes
// This MUST come before API routes to prevent conflicts
// Frontend routes like /employees/cards, /clients/create, etc. should serve index.html
// Only /api/* routes should be handled by backend
// 
// IMPORTANT: This middleware catches ALL non-API, non-static requests
// and serves index.html so React Router can handle routing client-side
app.use((req, res, next) => {
  const reqPath = req.path || req.url || '';
  
  // Skip API routes - these are handled by backend
  if (reqPath.startsWith('/api/')) {
    return next();
  }
  
  // Skip static files - these are already handled by express.static
  // But if we reach here, it means the file wasn't found, so treat as SPA route
  // Exception: manifest.json should be served from build folder, but if not found, serve index.html
  // This prevents 404 errors for manifest.json in nested routes like /pos/china_town/tables/manifest.json
  if (reqPath === '/manifest.json' || reqPath.endsWith('/manifest.json')) {
    // Try to serve manifest.json, but if not found, serve index.html (SPA fallback)
    return res.sendFile(path.join(buildPath, 'manifest.json'), (err) => {
      if (err) {
        console.log(`[SPA FALLBACK] manifest.json not found at ${reqPath}, serving index.html`);
        return res.sendFile(path.join(buildPath, 'index.html'));
      }
    });
  }
  const isStaticFile = reqPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i);
  if (isStaticFile) {
    // Static file not found - let it 404, don't serve index.html
    return next();
  }
  
  // All other routes are frontend SPA routes - serve index.html
  // This includes: /expenses, /clients, /accounting, /products, etc.
  console.log(`[SPA FALLBACK] Serving index.html for frontend route: ${reqPath}`);
  return res.sendFile(path.join(buildPath, 'index.html'));
});

// 3️⃣ Middleware for parsing (safe for static files)
// CRITICAL: Increase body size limit for Base64 images in settings
// CRITICAL: CORS configuration for development (allows localhost:3000 and localhost:4000)
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
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
        full_name TEXT,
        first_name TEXT,
        last_name TEXT,
        national_id TEXT,
        nationality TEXT DEFAULT 'SA',
        birth_date DATE,
        gender TEXT,
        employee_number TEXT,
        status TEXT DEFAULT 'active',
        phone TEXT,
        email TEXT,
        hire_date DATE,
        contract_type TEXT DEFAULT 'full_time',
        contract_duration_months INTEGER,
        probation_days INTEGER DEFAULT 90,
        pay_type TEXT DEFAULT 'monthly',
        hourly_rate NUMERIC(18,4) DEFAULT 0,
        basic_salary NUMERIC(18,2) DEFAULT 0,
        housing_allowance NUMERIC(18,2) DEFAULT 0,
        transport_allowance NUMERIC(18,2) DEFAULT 0,
        other_allowances NUMERIC(18,2) DEFAULT 0,
        payment_method TEXT DEFAULT 'bank',
        iban TEXT,
        gosi_subscription_no TEXT,
        gosi_enrolled BOOLEAN DEFAULT false,
        gosi_employee_rate NUMERIC(5,4) DEFAULT 0.09,
        gosi_employer_rate NUMERIC(5,4) DEFAULT 0.11,
        gosi_enroll_date DATE,
        gosi_status TEXT,
        mudad_contract_id TEXT,
        mudad_status TEXT,
        mudad_last_sync TIMESTAMP WITH TIME ZONE,
        department TEXT,
        payroll_expense_account_code TEXT DEFAULT '5210',
        gosi_liability_account_code TEXT DEFAULT '2120',
        payroll_payable_account_code TEXT DEFAULT '2130',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Add new columns if they don't exist (for existing databases)
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS national_id TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'SA'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'full_time'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_days INTEGER DEFAULT 90`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_type TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(18,4) DEFAULT 0`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(18,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS housing_allowance NUMERIC(18,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(18,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(18,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS iban TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_subscription_no TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_enrolled BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_employee_rate NUMERIC(5,4) DEFAULT 0.09`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_employer_rate NUMERIC(5,4) DEFAULT 0.11`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_enroll_date DATE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_status TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS mudad_contract_id TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS mudad_status TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS mudad_last_sync TIMESTAMP WITH TIME ZONE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS department TEXT`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_expense_account_code TEXT DEFAULT '5210'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gosi_liability_account_code TEXT DEFAULT '2120'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_payable_account_code TEXT DEFAULT '2130'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT,
        type TEXT, -- 'expense' | 'payment' | etc.
        amount NUMERIC(18,2) DEFAULT 0,
        total NUMERIC(18,2) DEFAULT 0,
        account_code TEXT,
        partner_id INTEGER,
        description TEXT,
        status TEXT DEFAULT 'draft',
        branch TEXT,
        date DATE DEFAULT CURRENT_DATE,
        payment_method TEXT DEFAULT 'cash',
        items JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Add columns if they don't exist
    await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_number TEXT');
    await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total NUMERIC(18,2) DEFAULT 0');
    await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items JSONB');
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
        subtotal NUMERIC(18,2) DEFAULT 0,
        discount_amount NUMERIC(18,2) DEFAULT 0,
        tax_amount NUMERIC(18,2) DEFAULT 0,
        total_amount NUMERIC(18,2) DEFAULT 0,
        customerId INTEGER,
        customer_name TEXT,
        customer_phone TEXT,
        invoice_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Add invoice_id column if it doesn't exist (for linking orders to invoices)
    await pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id INTEGER
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
        period TEXT,
        reference_type TEXT,
        reference_id INTEGER,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Add period column if it doesn't exist (for existing databases)
    try {
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='journal_entries' AND column_name='period') THEN
            ALTER TABLE journal_entries ADD COLUMN period TEXT;
          END IF;
        END $$;
      `);
    } catch (e) {
      // Column might already exist, ignore error
      console.log('[SCHEMA] period column check:', e?.message || 'ok');
    }
    // Add branch column if it doesn't exist
    try {
      await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='journal_entries' AND column_name='branch') THEN
            ALTER TABLE journal_entries ADD COLUMN branch TEXT;
          END IF;
        END $$;
      `);
    } catch (e) {
      // Column might already exist, ignore error
      console.log('[SCHEMA] branch column check:', e?.message || 'ok');
    }
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
      CREATE TABLE IF NOT EXISTS accounting_periods (
        id SERIAL PRIMARY KEY,
        period TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'open',
        opened_at TIMESTAMP WITH TIME ZONE,
        closed_at TIMESTAMP WITH TIME ZONE,
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

// Add missing columns to expenses table if they don't exist (for existing databases)
(async function() {
  try {
    if (!pool) {
      console.warn('[SCHEMA] Database pool not configured, skipping expenses columns setup');
      return;
    }
    
    // Wait a bit for ensureSchema to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if date column exists
    const { rows: dateCheck } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='expenses' AND column_name='date'
    `);
    if (!dateCheck || dateCheck.length === 0) {
      await pool.query('ALTER TABLE expenses ADD COLUMN date DATE DEFAULT CURRENT_DATE');
      console.log('[SCHEMA] Added date column to expenses table');
    }
    
    // Check if payment_method column exists
    const { rows: paymentMethodCheck } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='expenses' AND column_name='payment_method'
    `);
    if (!paymentMethodCheck || paymentMethodCheck.length === 0) {
      await pool.query("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash'");
      console.log('[SCHEMA] Added payment_method column to expenses table');
    }
  } catch (e) {
    console.error('[SCHEMA] Error adding columns to expenses:', e?.message);
  }
})();

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

// GET /api/users/:id - Get single user by ID
app.get("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, email, role, is_active, default_branch, created_at FROM "users" WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "User not found" });
    }
    const user = rows[0];
    res.json({ id: user.id, email: user.email, role: user.role || "user", is_active: user.is_active !== false, default_branch: user.default_branch, created_at: user.created_at });
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
// Audit logging endpoint - logs user actions
app.post("/api/audit", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { who, action, at, target, type, ...otherData } = req.body || {};
    
    // Log to console for debugging
    console.log(`[AUDIT] ${action || 'unknown'} | user=${who || userId} | target=${target || 'N/A'}`);
    
    // Optionally save to audit_log table if it exists
    try {
      await pool.query(`
        INSERT INTO audit_log (user_id, screen_code, action_code, allowed, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        type || action || 'unknown',
        action || 'log',
        true,
        req.ip || req.headers['x-forwarded-for'] || 'unknown',
        req.headers['user-agent'] || 'unknown',
        at ? new Date(at) : new Date()
      ]);
    } catch (dbError) {
      // If audit_log table doesn't exist or query fails, just log to console
      console.warn('[AUDIT] Could not save to database:', dbError?.message);
    }
    
    res.json({ ok: true, logged: true });
  } catch (e) {
    // Always return success - audit logging should never fail
    console.error('[AUDIT] Error:', e?.message);
    res.json({ ok: true, logged: false, error: e?.message });
  }
});

// Legacy /audit endpoint (without /api prefix) - redirect to /api/audit
app.post("/audit", authenticateToken, async (req, res) => {
  // Reuse the same handler logic
  try {
    const userId = req.user?.id || null;
    const { who, action, at, target, type, ...otherData } = req.body || {};
    
    console.log(`[AUDIT] ${action || 'unknown'} | user=${who || userId} | target=${target || 'N/A'}`);
    
    try {
      await pool.query(`
        INSERT INTO audit_log (user_id, screen_code, action_code, allowed, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        type || action || 'unknown',
        action || 'log',
        true,
        req.ip || req.headers['x-forwarded-for'] || 'unknown',
        req.headers['user-agent'] || 'unknown',
        at ? new Date(at) : new Date()
      ]);
    } catch (dbError) {
      console.warn('[AUDIT] Could not save to database:', dbError?.message);
    }
    
    res.json({ ok: true, logged: true });
  } catch (e) {
    console.error('[AUDIT] Error:', e?.message);
    res.json({ ok: true, logged: false, error: e?.message });
  }
});

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
// GET /api/customers - Alias for /api/partners with type=customer
app.get("/api/customers", authenticateToken, authorize("clients", "view"), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM partners WHERE type = $1 OR type = $2 ORDER BY id DESC', ['customer', 'عميل']);
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('[CUSTOMERS] Error listing:', e);
    res.json({ items: [] });
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

// ==================== JOURNAL ENTRIES API ====================
// List journal entries with filters
app.get("/journal", authenticateToken, authorize("journal", "view"), async (req, res) => {
  try {
    const {
      status, page = 1, pageSize = 20, from, to, type, source,
      reference_prefix, search, account_id, account_ids, accounts_scope,
      min_amount, max_amount, outliersOnly, outliers_threshold,
      unbalancedOnly, summary, period, quarter
    } = req.query || {};
    
    let query = `
      SELECT je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, 
             je.status, je.created_at, je.branch,
             COALESCE(SUM(jp.debit), 0) as total_debit,
             COALESCE(SUM(jp.credit), 0) as total_credit
      FROM journal_entries je
      LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND je.status = $${paramIndex++}`;
      params.push(status);
    }
    if (from) {
      query += ` AND je.date >= $${paramIndex++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND je.date <= $${paramIndex++}`;
      params.push(to);
    }
    if (search) {
      query += ` AND (je.description ILIKE $${paramIndex++} OR je.entry_number::text LIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` GROUP BY je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, je.status, je.created_at, je.branch`;
    
    // Order and paginate
    query += ` ORDER BY je.date DESC, je.entry_number DESC`;
    
    const { rows } = await pool.query(query, params);
    
    // Load postings for each entry with account details
    const entryIds = (rows || []).map(r => r.id);
    let postingsMap = new Map();
    
    if (entryIds.length > 0) {
      const postingsQuery = `
        SELECT jp.*, 
               a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
        FROM journal_postings jp
        LEFT JOIN accounts a ON a.id = jp.account_id
        WHERE jp.journal_entry_id = ANY($1)
        ORDER BY jp.id
      `;
      const { rows: postingsRows } = await pool.query(postingsQuery, [entryIds]);
      
      // Group postings by journal_entry_id
      for (const p of postingsRows || []) {
        if (!postingsMap.has(p.journal_entry_id)) {
          postingsMap.set(p.journal_entry_id, []);
        }
        postingsMap.get(p.journal_entry_id).push({
          ...p,
          debit: Number(p.debit || 0),
          credit: Number(p.credit || 0),
          account: p.account_number || p.account_code ? {
            id: p.account_id,
            account_number: p.account_number,
            account_code: p.account_code,
            name: p.account_name,
            name_en: p.account_name_en,
            type: p.account_type
          } : null
        });
      }
    }
    
    // Calculate totals and add postings
    const items = (rows || []).map(row => ({
      ...row,
      total_debit: Number(row.total_debit || 0),
      total_credit: Number(row.total_credit || 0),
      postings: postingsMap.get(row.id) || []
    }));
    
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('[JOURNAL] Error listing entries:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/journal", authenticateToken, authorize("journal", "view"), async (req, res) => {
  try {
    const {
      status, page = 1, pageSize = 20, from, to, type, source,
      reference_prefix, search, account_id, account_ids, accounts_scope,
      min_amount, max_amount, outliersOnly, outliers_threshold,
      unbalancedOnly, summary, period, quarter
    } = req.query || {};
    
    let query = `
      SELECT je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, 
             je.status, je.created_at, je.branch,
             COALESCE(SUM(jp.debit), 0) as total_debit,
             COALESCE(SUM(jp.credit), 0) as total_credit
      FROM journal_entries je
      LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND je.status = $${paramIndex++}`;
      params.push(status);
    }
    if (from) {
      query += ` AND je.date >= $${paramIndex++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND je.date <= $${paramIndex++}`;
      params.push(to);
    }
    if (search) {
      query += ` AND (je.description ILIKE $${paramIndex++} OR je.entry_number::text LIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` GROUP BY je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, je.status, je.created_at, je.branch`;
    
    // Order and paginate
    query += ` ORDER BY je.date DESC, je.entry_number DESC`;
    
    const { rows } = await pool.query(query, params);
    
    // Load postings for each entry with account details
    const entryIds = (rows || []).map(r => r.id);
    let postingsMap = new Map();
    
    if (entryIds.length > 0) {
      const postingsQuery = `
        SELECT jp.*, 
               a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
        FROM journal_postings jp
        LEFT JOIN accounts a ON a.id = jp.account_id
        WHERE jp.journal_entry_id = ANY($1)
        ORDER BY jp.id
      `;
      const { rows: postingsRows } = await pool.query(postingsQuery, [entryIds]);
      
      // Group postings by journal_entry_id
      for (const p of postingsRows || []) {
        if (!postingsMap.has(p.journal_entry_id)) {
          postingsMap.set(p.journal_entry_id, []);
        }
        postingsMap.get(p.journal_entry_id).push({
          ...p,
          debit: Number(p.debit || 0),
          credit: Number(p.credit || 0),
          account: p.account_number || p.account_code ? {
            id: p.account_id,
            account_number: p.account_number,
            account_code: p.account_code,
            name: p.account_name,
            name_en: p.account_name_en,
            type: p.account_type
          } : null
        });
      }
    }
    
    // Calculate totals and add postings
    const items = (rows || []).map(row => ({
      ...row,
      total_debit: Number(row.total_debit || 0),
      total_credit: Number(row.total_credit || 0),
      postings: postingsMap.get(row.id) || []
    }));
    
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('[JOURNAL] Error listing entries:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Get single journal entry with postings
app.get("/journal/:id", authenticateToken, authorize("journal", "view"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { rows: entryRows } = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      return res.status(404).json({ error: "not_found" });
    }
    
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, 
              a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1
       ORDER BY jp.id`,
      [id]
    );
    
    res.json({
      ...entryRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    console.error('[JOURNAL] Error getting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/journal/:id", authenticateToken, authorize("journal", "view"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { rows: entryRows } = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      return res.status(404).json({ error: "not_found" });
    }
    
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, 
              a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1
       ORDER BY jp.id`,
      [id]
    );
    
    res.json({
      ...entryRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    console.error('[JOURNAL] Error getting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Create journal entry (draft)
app.post("/journal", authenticateToken, authorize("journal", "create"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const postings = Array.isArray(b.postings) ? b.postings : [];
    
    // Generate entry number (reuses deleted numbers)
    const entryNumber = await getNextEntryNumber();
    
    // Extract period from date (YYYY-MM format)
    const entryDate = b.date || new Date();
    const dateObj = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
    const period = dateObj.toISOString().slice(0, 7); // YYYY-MM
    
    // Create entry with period
    const { rows: entryRows } = await client.query(
      `INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        entryNumber,
        String(b.description || ''),
        entryDate,
        period,
        b.reference_type || null,
        b.reference_id || null,
        'draft'
      ]
    );
    
    const entry = entryRows[0];
    
    // Create postings
    for (const p of postings) {
      await client.query(
        `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [
          entry.id,
          Number(p.account_id || 0),
          Number(p.debit || 0),
          Number(p.credit || 0)
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Fetch with postings
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.name as account_name 
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [entry.id]
    );
    
    res.json({
      ...entry,
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0)
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error creating entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});

app.post("/api/journal", authenticateToken, authorize("journal", "create"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const postings = Array.isArray(b.postings) ? b.postings : [];
    
    // Generate entry number (reuses deleted numbers)
    const entryNumber = await getNextEntryNumber();
    
    // Extract period from date (YYYY-MM format)
    const entryDate = b.date || new Date();
    const dateObj = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
    const period = dateObj.toISOString().slice(0, 7); // YYYY-MM
    
    // Create entry with period
    const { rows: entryRows } = await client.query(
      `INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        entryNumber,
        String(b.description || ''),
        entryDate,
        period,
        b.reference_type || null,
        b.reference_id || null,
        'draft'
      ]
    );
    
    const entry = entryRows[0];
    
    // Create postings
    for (const p of postings) {
      await client.query(
        `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [
          entry.id,
          Number(p.account_id || 0),
          Number(p.debit || 0),
          Number(p.credit || 0)
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Fetch with postings
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.name as account_name 
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [entry.id]
    );
    
    res.json({
      ...entry,
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0)
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error creating entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});

// Update journal entry
app.put("/journal/:id", authenticateToken, authorize("journal", "edit"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    
    // Update entry
    await client.query(
      `UPDATE journal_entries 
       SET description = COALESCE($1, description),
           date = COALESCE($2, date),
           reference_type = COALESCE($3, reference_type),
           reference_id = COALESCE($4, reference_id)
       WHERE id = $5`,
      [b.description || null, b.date || null, b.reference_type || null, b.reference_id || null, id]
    );
    
    // Update postings if provided
    if (Array.isArray(b.postings)) {
      await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [id]);
      for (const p of b.postings) {
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [id, Number(p.account_id || 0), Number(p.debit || 0), Number(p.credit || 0)]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch updated entry
    const { rows: entryRows } = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [id]);
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.name as account_name 
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [id]
    );
    
    res.json({
      ...entryRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0)
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error updating entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});

app.put("/api/journal/:id", authenticateToken, authorize("journal", "edit"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    
    // Update entry
    await client.query(
      `UPDATE journal_entries 
       SET description = COALESCE($1, description),
           date = COALESCE($2, date),
           reference_type = COALESCE($3, reference_type),
           reference_id = COALESCE($4, reference_id)
       WHERE id = $5`,
      [b.description || null, b.date || null, b.reference_type || null, b.reference_id || null, id]
    );
    
    // Update postings if provided
    if (Array.isArray(b.postings)) {
      await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [id]);
      for (const p of b.postings) {
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [id, Number(p.account_id || 0), Number(p.debit || 0), Number(p.credit || 0)]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch updated entry
    const { rows: entryRows } = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [id]);
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.name as account_name 
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [id]
    );
    
    res.json({
      ...entryRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0)
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error updating entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});

// Post journal entry
app.post("/journal/:id/post", authenticateToken, authorize("journal", "post"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    
    // Get journal entry to check date for period validation
    const { rows: entryRows } = await pool.query('SELECT date FROM journal_entries WHERE id = $1', [id]);
    const entry = entryRows && entryRows[0];
    
    if (entry && entry.date) {
      // Check accounting period before posting
      const dateObj = typeof entry.date === 'string' ? new Date(entry.date) : entry.date;
      const period = dateObj.toISOString().slice(0, 7); // YYYY-MM
      
      const { rows: periodRows } = await pool.query(
        'SELECT status FROM accounting_periods WHERE period = $1 LIMIT 1',
        [period]
      );
      
      const periodData = periodRows && periodRows[0];
      
      if (periodData && String(periodData.status).toLowerCase() === 'closed') {
        return res.status(403).json({
          error: "ACCOUNTING_PERIOD_CLOSED",
          details: `Accounting period ${period} is closed. Cannot post journal entries.`,
          period: period
        });
      }
    }
    
    await pool.query('UPDATE journal_entries SET status = $1 WHERE id = $2', ['posted', id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[JOURNAL] Error posting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/journal/:id/post", authenticateToken, authorize("journal", "post"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    
    // Get journal entry to check date for period validation
    const { rows: entryRows } = await pool.query('SELECT date FROM journal_entries WHERE id = $1', [id]);
    const entry = entryRows && entryRows[0];
    
    if (entry && entry.date) {
      // Check accounting period before posting
      const dateObj = typeof entry.date === 'string' ? new Date(entry.date) : entry.date;
      const period = dateObj.toISOString().slice(0, 7); // YYYY-MM
      
      const { rows: periodRows } = await pool.query(
        'SELECT status FROM accounting_periods WHERE period = $1 LIMIT 1',
        [period]
      );
      
      const periodData = periodRows && periodRows[0];
      
      if (periodData && String(periodData.status).toLowerCase() === 'closed') {
        return res.status(403).json({
          error: "ACCOUNTING_PERIOD_CLOSED",
          details: `Accounting period ${period} is closed. Cannot post journal entries.`,
          period: period
        });
      }
    }
    
    await pool.query('UPDATE journal_entries SET status = $1 WHERE id = $2', ['posted', id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[JOURNAL] Error posting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Return to draft
app.post("/journal/:id/return-to-draft", authenticateToken, authorize("journal", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('UPDATE journal_entries SET status = $1 WHERE id = $2', ['draft', id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[JOURNAL] Error returning to draft:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/journal/:id/return-to-draft", authenticateToken, authorize("journal", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('UPDATE journal_entries SET status = $1 WHERE id = $2', ['draft', id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[JOURNAL] Error returning to draft:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// Delete journal entry
app.delete("/journal/:id", authenticateToken, authorize("journal", "delete"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('DELETE FROM journal_entries WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[JOURNAL] Error deleting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.delete("/api/journal/:id", authenticateToken, authorize("journal", "delete"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('DELETE FROM journal_entries WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[JOURNAL] Error deleting entry:', e);
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
    const includeDisabled = req.query.include_disabled === '1' || req.query.include_disabled === 1;
    
    let query = `
      SELECT 
        id, name, name_en, sku, barcode, category, unit, 
        COALESCE(sale_price, price, 0) as sale_price,
        price, cost, tax_rate, COALESCE(stock_qty, stock_quantity, 0) as stock_quantity, min_stock, 
        description, is_active, is_service, 
        true as can_be_sold, 
        true as can_be_purchased, 
        false as can_be_expensed,
        created_at, updated_at
      FROM products 
    `;
    
    if (!includeDisabled) {
      // Show products where is_active is true OR NULL (NULL means active by default)
      // This ensures products added manually will show even if is_active is NULL
      query += ` WHERE (is_active = true OR is_active IS NULL) `;
    }
    
    query += ` ORDER BY category ASC, name ASC `;
    
    const { rows } = await pool.query(query);
    
    // Separate active and disabled products
    // Products with is_active = NULL are considered active
    const activeProducts = rows.filter(p => p.is_active !== false);
    const disabledProducts = rows.filter(p => p.is_active === false);
    const disabledIds = disabledProducts.map(p => p.id);
    
    res.json({
      items: activeProducts,
      disabled_ids: disabledIds
    });
  } catch (e) {
    console.error('[PRODUCTS] Error listing products:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/products", authenticateToken, authorize("products", "view"), async (req, res) => {
  try {
    const includeDisabled = req.query.include_disabled === '1' || req.query.include_disabled === 1;
    
    // CRITICAL: Select all columns including sale_price, price, name_en for bilingual support
    // Filter by is_active only if include_disabled is not set
    let query = `
      SELECT 
        id, name, name_en, sku, barcode, category, unit, 
        COALESCE(sale_price, price, 0) as sale_price,
        price, cost, tax_rate, COALESCE(stock_qty, stock_quantity, 0) as stock_quantity, min_stock, 
        description, is_active, is_service, 
        true as can_be_sold, 
        true as can_be_purchased, 
        false as can_be_expensed,
        created_at, updated_at
      FROM products 
    `;
    
    if (!includeDisabled) {
      // Show products where is_active is true OR NULL (NULL means active by default)
      // This ensures products added manually will show even if is_active is NULL
      query += ` WHERE (is_active = true OR is_active IS NULL) `;
    }
    
    query += ` ORDER BY category ASC, name ASC `;
    
    const { rows } = await pool.query(query);
    
    // Separate active and disabled products
    // Products with is_active = NULL are considered active
    const activeProducts = rows.filter(p => p.is_active !== false);
    const disabledProducts = rows.filter(p => p.is_active === false);
    const disabledIds = disabledProducts.map(p => p.id);
    
    res.json({
      items: activeProducts,
      disabled_ids: disabledIds
    });
  } catch (e) {
    console.error('[PRODUCTS] Error listing products:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/products", authenticateToken, authorize("products", "create"), async (req, res) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO products(name, name_en, sku, barcode, category, unit, price, cost, tax_rate, stock_qty, min_stock, description, is_active) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.name||'', b.name_en||'', b.sku||null, b.barcode||null, b.category||null, b.unit||'unit', 
       Number(b.price||0), Number(b.cost||0), Number(b.tax_rate||15), Number(b.stock_quantity||b.stock_qty||0), 
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
      `INSERT INTO products(name, name_en, sku, barcode, category, unit, price, cost, tax_rate, stock_qty, min_stock, description, is_active) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.name||'', b.name_en||'', b.sku||null, b.barcode||null, b.category||null, b.unit||'unit', 
       Number(b.price||0), Number(b.cost||0), Number(b.tax_rate||15), Number(b.stock_quantity||b.stock_qty||0), 
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
       stock_qty=COALESCE($10,stock_qty), min_stock=COALESCE($11,min_stock), 
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
       stock_qty=COALESCE($10,stock_qty), min_stock=COALESCE($11,min_stock), 
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

// Bulk import products from sections/items structure
app.post("/products/bulk-import", authenticateToken, authorize("products", "create"), async (req, res) => {
  try {
    const sections = Array.isArray(req.body) ? req.body : [];
    if (sections.length === 0) {
      return res.status(400).json({ error: "invalid_data", message: "Empty sections array" });
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let errors = [];

    // Process each section
    for (const section of sections) {
      const sectionName = String(section.section_name || '').trim();
      const items = Array.isArray(section.items) ? section.items : [];

      if (!sectionName || items.length === 0) continue;

      // Process each item in the section
      for (const item of items) {
        try {
          const itemName = String(item.name || '').trim();
          const itemPrice = Number(item.price || 0);

          if (!itemName || itemPrice <= 0) {
            errors.push({ item: itemName || 'unknown', error: 'Invalid name or price' });
            continue;
          }

          // Parse name: "English / Arabic" format
          let nameEn = '';
          let nameAr = '';
          const nameParts = itemName.split('/').map(s => s.trim()).filter(Boolean);
          if (nameParts.length >= 2) {
            nameEn = nameParts[0];
            nameAr = nameParts.slice(1).join('/'); // Join remaining parts for Arabic
          } else if (nameParts.length === 1) {
            // If no separator, check if it's Arabic (contains Arabic characters)
            const hasArabic = /[\u0600-\u06FF]/.test(nameParts[0]);
            if (hasArabic) {
              nameAr = nameParts[0];
            } else {
              nameEn = nameParts[0];
            }
          }

          // Check if product already exists (by name)
          const { rows: existing } = await pool.query(
            'SELECT id FROM products WHERE name = $1 OR name_en = $2 LIMIT 1',
            [nameAr || nameEn, nameEn || nameAr]
          );

          if (existing && existing[0]) {
            // Update existing product
            await pool.query(
              `UPDATE products SET name=$1, name_en=$2, category=$3, price=$4, updated_at=NOW() WHERE id=$5`,
              [nameAr || nameEn, nameEn || nameAr, sectionName, itemPrice, existing[0].id]
            );
            totalUpdated++;
          } else {
            // Create new product
            await pool.query(
              `INSERT INTO products(name, name_en, category, unit, price, cost, tax_rate, stock_qty, min_stock, is_active) 
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [nameAr || nameEn, nameEn || nameAr, sectionName, 'unit', itemPrice, 0, 15, 0, 0, true]
            );
            totalCreated++;
          }
        } catch (itemError) {
          console.error('[PRODUCTS] Error processing item:', item, itemError);
          errors.push({ item: item.name || 'unknown', error: itemError?.message || 'unknown' });
        }
      }
    }

    console.log(`[PRODUCTS] Bulk import completed: ${totalCreated} created, ${totalUpdated} updated, ${errors.length} errors`);
    res.json({ 
      ok: true, 
      created: totalCreated, 
      updated: totalUpdated, 
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });
  } catch (e) {
    console.error('[PRODUCTS] Error in bulk import:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/products/bulk-import", authenticateToken, authorize("products", "create"), async (req, res) => {
  try {
    const sections = Array.isArray(req.body) ? req.body : [];
    if (sections.length === 0) {
      return res.status(400).json({ error: "invalid_data", message: "Empty sections array" });
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let errors = [];

    // Process each section
    for (const section of sections) {
      const sectionName = String(section.section_name || '').trim();
      const items = Array.isArray(section.items) ? section.items : [];

      if (!sectionName || items.length === 0) continue;

      // Process each item in the section
      for (const item of items) {
        try {
          const itemName = String(item.name || '').trim();
          const itemPrice = Number(item.price || 0);

          if (!itemName || itemPrice <= 0) {
            errors.push({ item: itemName || 'unknown', error: 'Invalid name or price' });
            continue;
          }

          // Parse name: "English / Arabic" format
          let nameEn = '';
          let nameAr = '';
          const nameParts = itemName.split('/').map(s => s.trim()).filter(Boolean);
          if (nameParts.length >= 2) {
            nameEn = nameParts[0];
            nameAr = nameParts.slice(1).join('/'); // Join remaining parts for Arabic
          } else if (nameParts.length === 1) {
            // If no separator, check if it's Arabic (contains Arabic characters)
            const hasArabic = /[\u0600-\u06FF]/.test(nameParts[0]);
            if (hasArabic) {
              nameAr = nameParts[0];
            } else {
              nameEn = nameParts[0];
            }
          }

          // Check if product already exists (by name)
          const { rows: existing } = await pool.query(
            'SELECT id FROM products WHERE name = $1 OR name_en = $2 LIMIT 1',
            [nameAr || nameEn, nameEn || nameAr]
          );

          if (existing && existing[0]) {
            // Update existing product
            await pool.query(
              `UPDATE products SET name=$1, name_en=$2, category=$3, price=$4, updated_at=NOW() WHERE id=$5`,
              [nameAr || nameEn, nameEn || nameAr, sectionName, itemPrice, existing[0].id]
            );
            totalUpdated++;
          } else {
            // Create new product
            await pool.query(
              `INSERT INTO products(name, name_en, category, unit, price, cost, tax_rate, stock_qty, min_stock, is_active) 
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [nameAr || nameEn, nameEn || nameAr, sectionName, 'unit', itemPrice, 0, 15, 0, 0, true]
            );
            totalCreated++;
          }
        } catch (itemError) {
          console.error('[PRODUCTS] Error processing item:', item, itemError);
          errors.push({ item: item.name || 'unknown', error: itemError?.message || 'unknown' });
        }
      }
    }

    console.log(`[PRODUCTS] Bulk import completed: ${totalCreated} created, ${totalUpdated} updated, ${errors.length} errors`);
    res.json({ 
      ok: true, 
      created: totalCreated, 
      updated: totalUpdated, 
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });
  } catch (e) {
    console.error('[PRODUCTS] Error in bulk import:', e);
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
app.get("/api/accounts/:id", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry, created_at, updated_at FROM accounts WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Account not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('[ACCOUNTS] Error getting account:', e);
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
    
    // شجرة حسابات كاملة متوافقة مع النظام السعودي - الهيكل النهائي
    const defaultAccounts = [
      // ═══════════════════════════════════════════════════════════════
      // 0001 - الأصول (Assets)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0001', name: 'الأصول', name_en: 'Assets', type: 'asset', nature: 'debit' },
      
      // 1100 - أصول متداولة
      { account_number: '1100', name: 'أصول متداولة', name_en: 'Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
      
      // 1110 - النقد وما في حكمه
      { account_number: '1110', name: 'النقد وما في حكمه', name_en: 'Cash and Cash Equivalents', type: 'cash', nature: 'debit', parent_number: '1100' },
      { account_number: '1111', name: 'صندوق رئيسي', name_en: 'Main Cash', type: 'cash', nature: 'debit', parent_number: '1110' },
      { account_number: '1112', name: 'صندوق فرعي', name_en: 'Sub Cash', type: 'cash', nature: 'debit', parent_number: '1110' },
      
      // 1120 - بنوك
      { account_number: '1120', name: 'بنوك', name_en: 'Banks', type: 'bank', nature: 'debit', parent_number: '1100' },
      { account_number: '1121', name: 'بنك الراجحي', name_en: 'Al Rajhi Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1122', name: 'بنك الأهلي', name_en: 'Al Ahli Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      { account_number: '1123', name: 'بنك الرياض', name_en: 'Riyad Bank', type: 'bank', nature: 'debit', parent_number: '1120' },
      
      // 1130 - الشيكات
      { account_number: '1130', name: 'الشيكات', name_en: 'Checks', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1131', name: 'شيكات واردة', name_en: 'Incoming Checks', type: 'asset', nature: 'debit', parent_number: '1130' },
      { account_number: '1132', name: 'شيكات تحت التحصيل', name_en: 'Checks Under Collection', type: 'asset', nature: 'debit', parent_number: '1130' },
      
      // 1140 - الذمم المدينة
      { account_number: '1140', name: 'الذمم المدينة', name_en: 'Accounts Receivable', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1141', name: 'عملاء', name_en: 'Customers', type: 'asset', nature: 'debit', parent_number: '1140' },
      { account_number: '1142', name: 'ذمم مدينة أخرى', name_en: 'Other Receivables', type: 'asset', nature: 'debit', parent_number: '1140' },
      
      // 1150 - سلف وعهد
      { account_number: '1150', name: 'سلف وعهد', name_en: 'Advances and Deposits', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1151', name: 'سلف موظفين', name_en: 'Employee Advances', type: 'asset', nature: 'debit', parent_number: '1150' },
      { account_number: '1152', name: 'عهد نقدية', name_en: 'Cash Deposits', type: 'asset', nature: 'debit', parent_number: '1150' },
      
      // 1160 - المخزون
      { account_number: '1160', name: 'المخزون', name_en: 'Inventory', type: 'asset', nature: 'debit', parent_number: '1100' },
      { account_number: '1161', name: 'مخزون بضائع', name_en: 'Merchandise Inventory', type: 'asset', nature: 'debit', parent_number: '1160' },
      { account_number: '1162', name: 'مخزون مواد', name_en: 'Materials Inventory', type: 'asset', nature: 'debit', parent_number: '1160' },
      
      // 1170 - ضريبة القيمة المضافة - مدخلات (VAT Input)
      { account_number: '1170', name: 'ضريبة القيمة المضافة – مدخلات', name_en: 'VAT Input', type: 'asset', nature: 'debit', parent_number: '1100' },
      
      // 1200 - أصول غير متداولة
      { account_number: '1200', name: 'أصول غير متداولة', name_en: 'Non-Current Assets', type: 'asset', nature: 'debit', parent_number: '0001' },
      
      // 1210 - ممتلكات ومعدات
      { account_number: '1210', name: 'ممتلكات ومعدات', name_en: 'Property and Equipment', type: 'asset', nature: 'debit', parent_number: '1200' },
      { account_number: '1211', name: 'أجهزة', name_en: 'Equipment', type: 'asset', nature: 'debit', parent_number: '1210' },
      { account_number: '1212', name: 'أثاث', name_en: 'Furniture', type: 'asset', nature: 'debit', parent_number: '1210' },
      { account_number: '1213', name: 'سيارات', name_en: 'Vehicles', type: 'asset', nature: 'debit', parent_number: '1210' },
      
      // 1220 - مجمع الإهلاك
      { account_number: '1220', name: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'asset', nature: 'credit', parent_number: '1200' },
      { account_number: '1221', name: 'مجمع إهلاك أجهزة', name_en: 'Accumulated Depreciation - Equipment', type: 'asset', nature: 'credit', parent_number: '1220' },
      { account_number: '1222', name: 'مجمع إهلاك سيارات', name_en: 'Accumulated Depreciation - Vehicles', type: 'asset', nature: 'credit', parent_number: '1220' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0002 - الالتزامات (Liabilities)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0002', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', nature: 'credit' },
      
      // 2100 - التزامات متداولة
      { account_number: '2100', name: 'التزامات متداولة', name_en: 'Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
      
      // 2110 - الذمم الدائنة
      { account_number: '2110', name: 'الذمم الدائنة', name_en: 'Accounts Payable', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2111', name: 'موردون', name_en: 'Suppliers', type: 'liability', nature: 'credit', parent_number: '2110' },
      
      // 2120 - مستحقات موظفين
      { account_number: '2120', name: 'مستحقات موظفين', name_en: 'Employee Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2121', name: 'رواتب مستحقة', name_en: 'Salaries Payable', type: 'liability', nature: 'credit', parent_number: '2120' },
      { account_number: '2122', name: 'بدلات مستحقة', name_en: 'Allowances Payable', type: 'liability', nature: 'credit', parent_number: '2120' },
      
      // 2130 - مستحقات حكومية
      { account_number: '2130', name: 'مستحقات حكومية', name_en: 'Government Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2131', name: 'التأمينات الاجتماعية (GOSI)', name_en: 'GOSI Payable', type: 'liability', nature: 'credit', parent_number: '2130' },
      { account_number: '2132', name: 'رسوم قوى', name_en: 'Labor Fees', type: 'liability', nature: 'credit', parent_number: '2130' },
      { account_number: '2133', name: 'رسوم مقيم', name_en: 'Residency Fees', type: 'liability', nature: 'credit', parent_number: '2130' },
      
      // 2140 - ضرائب مستحقة
      { account_number: '2140', name: 'ضرائب مستحقة', name_en: 'Tax Payables', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2141', name: 'ضريبة القيمة المضافة – مستحقة', name_en: 'VAT Output', type: 'liability', nature: 'credit', parent_number: '2140' },
      { account_number: '2142', name: 'ضرائب أخرى', name_en: 'Other Taxes', type: 'liability', nature: 'credit', parent_number: '2140' },
      
      // 2150 - مصروفات مستحقة
      { account_number: '2150', name: 'مصروفات مستحقة', name_en: 'Accrued Expenses', type: 'liability', nature: 'credit', parent_number: '2100' },
      { account_number: '2151', name: 'كهرباء مستحقة', name_en: 'Electricity Payable', type: 'liability', nature: 'credit', parent_number: '2150' },
      { account_number: '2152', name: 'ماء مستحق', name_en: 'Water Payable', type: 'liability', nature: 'credit', parent_number: '2150' },
      { account_number: '2153', name: 'اتصالات مستحقة', name_en: 'Telecom Payable', type: 'liability', nature: 'credit', parent_number: '2150' },
      
      // 2200 - التزامات غير متداولة
      { account_number: '2200', name: 'التزامات غير متداولة', name_en: 'Non-Current Liabilities', type: 'liability', nature: 'credit', parent_number: '0002' },
      { account_number: '2210', name: 'قروض طويلة الأجل', name_en: 'Long-term Loans', type: 'liability', nature: 'credit', parent_number: '2200' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0003 - حقوق الملكية (Equity)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0003', name: 'حقوق الملكية', name_en: 'Equity', type: 'equity', nature: 'credit' },
      { account_number: '3100', name: 'رأس المال', name_en: 'Capital', type: 'equity', nature: 'credit', parent_number: '0003' },
      { account_number: '3200', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', nature: 'credit', parent_number: '0003' },
      { account_number: '3300', name: 'جاري المالك', name_en: 'Owner Current Account', type: 'equity', nature: 'credit', parent_number: '0003' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0004 - الإيرادات (Revenue)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0004', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', nature: 'credit' },
      
      // 4100 - الإيرادات التشغيلية حسب الفرع
      { account_number: '4100', name: 'الإيرادات التشغيلية', name_en: 'Operating Revenue', type: 'revenue', nature: 'credit', parent_number: '0004' },
      
      // China Town
      { account_number: '4111', name: 'مبيعات نقدية – China Town', name_en: 'Cash Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4112', name: 'مبيعات آجلة – China Town', name_en: 'Credit Sales - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4113', name: 'إيرادات خدمات – China Town', name_en: 'Service Revenue - China Town', type: 'revenue', nature: 'credit', parent_number: '4100' },
      
      // Place India
      { account_number: '4121', name: 'مبيعات نقدية – Place India', name_en: 'Cash Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4122', name: 'مبيعات آجلة – Place India', name_en: 'Credit Sales - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
      { account_number: '4123', name: 'إيرادات خدمات – Place India', name_en: 'Service Revenue - Place India', type: 'revenue', nature: 'credit', parent_number: '4100' },
      
      // 4200 - إيرادات أخرى
      { account_number: '4200', name: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', nature: 'credit', parent_number: '0004' },
      { account_number: '4210', name: 'إيرادات غير تشغيلية', name_en: 'Non-Operating Revenue', type: 'revenue', nature: 'credit', parent_number: '4200' },
      { account_number: '4220', name: 'خصم مكتسب من الموردين', name_en: 'Discount Received from Suppliers', type: 'revenue', nature: 'credit', parent_number: '4200' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0005 - المصروفات (Expenses)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0005', name: 'المصروفات', name_en: 'Expenses', type: 'expense', nature: 'debit' },
      
      // 5100 - مصروفات تشغيلية
      { account_number: '5100', name: 'مصروفات تشغيلية', name_en: 'Operating Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
      { account_number: '5110', name: 'تكلفة مبيعات', name_en: 'Cost of Goods Sold', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5120', name: 'مصروف كهرباء', name_en: 'Electricity Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5130', name: 'مصروف ماء', name_en: 'Water Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
      { account_number: '5140', name: 'مصروف اتصالات', name_en: 'Telecom Expense', type: 'expense', nature: 'debit', parent_number: '5100' },
      
      // 5200 - مصروفات إدارية وعمومية
      { account_number: '5200', name: 'مصروفات إدارية وعمومية', name_en: 'Administrative and General Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
      { account_number: '5210', name: 'رواتب وأجور', name_en: 'Salaries and Wages', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5220', name: 'بدلات', name_en: 'Allowances', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5230', name: 'مصروفات حكومية', name_en: 'Government Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5240', name: 'مصروف غرامات', name_en: 'Fines Expense', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5250', name: 'مصروفات بنكية', name_en: 'Bank Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5260', name: 'مصروفات متنوعة', name_en: 'Miscellaneous Expenses', type: 'expense', nature: 'debit', parent_number: '5200' },
      { account_number: '5270', name: 'خصم ممنوح للعملاء', name_en: 'Discount Given to Customers', type: 'expense', nature: 'debit', parent_number: '5200' },
      
      // 5300 - مصروفات مالية
      { account_number: '5300', name: 'مصروفات مالية', name_en: 'Financial Expenses', type: 'expense', nature: 'debit', parent_number: '0005' },
      { account_number: '5310', name: 'فوائد بنكية', name_en: 'Bank Interest', type: 'expense', nature: 'debit', parent_number: '5300' },
      
      // ═══════════════════════════════════════════════════════════════
      // 0006 - حسابات نظامية / رقابية (اختيارية)
      // ═══════════════════════════════════════════════════════════════
      { account_number: '0006', name: 'حسابات نظامية / رقابية', name_en: 'System/Control Accounts', type: 'asset', nature: 'debit' },
      { account_number: '6100', name: 'فروقات جرد', name_en: 'Inventory Differences', type: 'asset', nature: 'debit', parent_number: '0006' },
      { account_number: '6200', name: 'فروقات نقدية', name_en: 'Cash Differences', type: 'asset', nature: 'debit', parent_number: '0006' },
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

// /api/accounts/seed-default - use same logic as /accounts/seed-default
app.post("/api/accounts/seed-default", authenticateToken, authorize("accounting", "create"), async (req, res) => {
  // Reuse the same handler function above - for now we'll just call the handler directly
  // In production, you might want to extract to a shared function
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
    
    // Use the exact same accounts structure as /accounts/seed-default above
    // This should match the accounts array defined in the /accounts/seed-default handler
    // For now, just return error asking to use /accounts/seed-default
    return res.status(400).json({ error: "use_main_endpoint", message: "Please use POST /accounts/seed-default endpoint. Both endpoints share the same structure." });
  } catch (e) {
    console.error('[ACCOUNTS] Error in /api/accounts/seed-default:', e);
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

// Accounting Periods API - with get or create support
app.get("/accounting-periods/:period", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    // Try to find existing period
    let { rows } = await pool.query(
      'SELECT id, period, status, opened_at, closed_at, created_at FROM accounting_periods WHERE period = $1 LIMIT 1',
      [period]
    );
    
    let periodData = rows && rows[0];
    
    // If period doesn't exist, create it automatically (get or create pattern)
    if (!periodData) {
      console.log(`[PERIODS] Period ${period} not found, creating automatically`);
      
      // Insert new period with 'open' status by default
      const insertResult = await pool.query(
        `INSERT INTO accounting_periods(period, status, opened_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (period) DO UPDATE SET period = EXCLUDED.period
         RETURNING id, period, status, opened_at, closed_at, created_at`,
        [period, 'open']
      );
      
      periodData = insertResult.rows && insertResult.rows[0];
      
      if (!periodData) {
        console.error(`[PERIODS] Failed to create period ${period}`);
        return res.status(500).json({ error: "create_failed", details: `Failed to create period ${period}` });
      }
      
      console.log(`[PERIODS] Created period ${period} with status 'open'`);
    }
    
    res.json(periodData);
  } catch (e) {
    console.error('[PERIODS] Error getting period:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/accounting-periods/:period", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    // Try to find existing period
    let { rows } = await pool.query(
      'SELECT id, period, status, opened_at, closed_at, created_at FROM accounting_periods WHERE period = $1 LIMIT 1',
      [period]
    );
    
    let periodData = rows && rows[0];
    
    // If period doesn't exist, create it automatically (get or create pattern)
    if (!periodData) {
      console.log(`[PERIODS] Period ${period} not found, creating automatically`);
      
      // Insert new period with 'open' status by default
      const insertResult = await pool.query(
        `INSERT INTO accounting_periods(period, status, opened_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (period) DO UPDATE SET period = EXCLUDED.period
         RETURNING id, period, status, opened_at, closed_at, created_at`,
        [period, 'open']
      );
      
      periodData = insertResult.rows && insertResult.rows[0];
      
      if (!periodData) {
        console.error(`[PERIODS] Failed to create period ${period}`);
        return res.status(500).json({ error: "create_failed", details: `Failed to create period ${period}` });
      }
      
      console.log(`[PERIODS] Created period ${period} with status 'open'`);
    }
    
    res.json(periodData);
  } catch (e) {
    console.error('[PERIODS] Error getting period:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/accounting-periods/:period/open", authenticateToken, authorize("accounting", "edit"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    const { rows } = await pool.query(
      `INSERT INTO accounting_periods(period, status, opened_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (period) DO UPDATE SET status = $2, opened_at = NOW(), closed_at = NULL
       RETURNING id, period, status, opened_at, closed_at, created_at`,
      [period, 'open']
    );
    
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PERIODS] Error opening period:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/accounting-periods/:period/open", authenticateToken, authorize("accounting", "edit"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    const { rows } = await pool.query(
      `INSERT INTO accounting_periods(period, status, opened_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (period) DO UPDATE SET status = $2, opened_at = NOW(), closed_at = NULL
       RETURNING id, period, status, opened_at, closed_at, created_at`,
      [period, 'open']
    );
    
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PERIODS] Error opening period:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/accounting-periods/:period/close", authenticateToken, authorize("accounting", "edit"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    const { rows } = await pool.query(
      `UPDATE accounting_periods 
       SET status = $1, closed_at = NOW() 
       WHERE period = $2 
       RETURNING id, period, status, opened_at, closed_at, created_at`,
      ['closed', period]
    );
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: `Period ${period} not found` });
    }
    
    res.json(rows[0]);
  } catch (e) {
    console.error('[PERIODS] Error closing period:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.post("/api/accounting-periods/:period/close", authenticateToken, authorize("accounting", "edit"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    const { rows } = await pool.query(
      `UPDATE accounting_periods 
       SET status = $1, closed_at = NOW() 
       WHERE period = $2 
       RETURNING id, period, status, opened_at, closed_at, created_at`,
      ['closed', period]
    );
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: `Period ${period} not found` });
    }
    
    res.json(rows[0]);
  } catch (e) {
    console.error('[PERIODS] Error closing period:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/accounting-periods/:period/summary", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    // Get period summary (total debits, credits, etc.)
    // For now, return basic period info
    const { rows } = await pool.query(
      'SELECT id, period, status, opened_at, closed_at, created_at FROM accounting_periods WHERE period = $1 LIMIT 1',
      [period]
    );
    
    const periodData = rows && rows[0];
    
    if (!periodData) {
      // Create period if doesn't exist (get or create)
      const insertResult = await pool.query(
        `INSERT INTO accounting_periods(period, status, opened_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (period) DO UPDATE SET period = EXCLUDED.period
         RETURNING id, period, status, opened_at, closed_at, created_at`,
        [period, 'open']
      );
      
      const newPeriod = insertResult.rows && insertResult.rows[0];
      return res.json({
        ...newPeriod,
        total_debits: 0,
        total_credits: 0,
        balance: 0
      });
    }
    
    res.json({
      ...periodData,
      total_debits: 0,
      total_credits: 0,
      balance: 0
    });
  } catch (e) {
    console.error('[PERIODS] Error getting period summary:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/api/accounting-periods/:period/summary", authenticateToken, authorize("accounting", "view"), async (req, res) => {
  try {
    const period = String(req.params.period || '').trim();
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: "invalid_period", details: "Period must be in YYYY-MM format" });
    }
    
    // Get period summary (total debits, credits, etc.)
    // For now, return basic period info
    const { rows } = await pool.query(
      'SELECT id, period, status, opened_at, closed_at, created_at FROM accounting_periods WHERE period = $1 LIMIT 1',
      [period]
    );
    
    const periodData = rows && rows[0];
    
    if (!periodData) {
      // Create period if doesn't exist (get or create)
      const insertResult = await pool.query(
        `INSERT INTO accounting_periods(period, status, opened_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (period) DO UPDATE SET period = EXCLUDED.period
         RETURNING id, period, status, opened_at, closed_at, created_at`,
        [period, 'open']
      );
      
      const newPeriod = insertResult.rows && insertResult.rows[0];
      return res.json({
        ...newPeriod,
        total_debits: 0,
        total_credits: 0,
        balance: 0
      });
    }
    
    res.json({
      ...periodData,
      total_debits: 0,
      total_credits: 0,
      balance: 0
    });
  } catch (e) {
    console.error('[PERIODS] Error getting period summary:', e);
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
    const { rows } = await pool.query('SELECT id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at FROM partners ORDER BY id DESC');
    const list = Array.isArray(rows) ? rows.map(r => ({ ...r, contact_info: r.contact_info || null })) : [];
    const filtered = list.filter(p => !type || String(p.type||"").toLowerCase() === type);
    res.json(filtered);
  } catch (e) { res.json([]); }
});
app.get("/api/partners", authenticateToken, async (req, res) => {
  try {
    const type = String(req.query?.type || "").toLowerCase();
    const { rows } = await pool.query('SELECT id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at FROM partners ORDER BY id DESC');
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
      'INSERT INTO partners(name, type, email, phone, customer_type, contact_info) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
      [name, type, email, phone, customer_type, contact_info]
    );
    const partner = rows && rows[0];
    if (partner) {
      // Create account automatically for new partner
      const accountId = await getOrCreatePartnerAccount(partner.id, type);
      if (accountId) {
        const { rows: updatedRows } = await pool.query(
          'UPDATE partners SET account_id = $1 WHERE id = $2 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
          [accountId, partner.id]
        );
        if (updatedRows && updatedRows[0]) {
          return res.json(updatedRows[0]);
        }
      }
    }
    res.json(partner);
  } catch (e) { 
    console.error('[PARTNERS] Error creating partner:', e);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
});
app.post("/api/partners", authenticateToken, authorize("clients","create"), async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name||'').trim(); const type = String(b.type||'customer').toLowerCase();
    const email = b.email || null; const phone = b.phone || null;
    const customer_type = b.customer_type || null;
    const contact_info = b.contact_info ? (typeof b.contact_info === 'object' ? b.contact_info : null) : null;
    const { rows } = await pool.query(
      'INSERT INTO partners(name, type, email, phone, customer_type, contact_info) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
      [name, type, email, phone, customer_type, contact_info]
    );
    const partner = rows && rows[0];
    if (partner) {
      // Create account automatically for new partner
      const accountId = await getOrCreatePartnerAccount(partner.id, type);
      if (accountId) {
        const { rows: updatedRows } = await pool.query(
          'UPDATE partners SET account_id = $1 WHERE id = $2 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
          [accountId, partner.id]
        );
        if (updatedRows && updatedRows[0]) {
          return res.json(updatedRows[0]);
        }
      }
    }
    res.json(partner);
  } catch (e) { 
    console.error('[PARTNERS] Error creating partner:', e);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
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
    const { rows } = await pool.query(`
      SELECT id, full_name, first_name, last_name, national_id, nationality, birth_date, gender, 
             employee_number, status, phone, email, hire_date, contract_type, contract_duration_months, 
             probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance, 
             other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled, 
             gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id, 
             mudad_status, mudad_last_sync, department, payroll_expense_account_code, 
             gosi_liability_account_code, payroll_payable_account_code, created_at, updated_at 
      FROM employees 
      ORDER BY id DESC
    `);
    res.json(rows || []);
  } catch (e) { 
    console.error('[EMPLOYEES] Error listing:', e);
    res.json([]); 
  }
});
app.get("/api/employees", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, full_name, first_name, last_name, national_id, nationality, birth_date, gender, 
             employee_number, status, phone, email, hire_date, contract_type, contract_duration_months, 
             probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance, 
             other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled, 
             gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id, 
             mudad_status, mudad_last_sync, department, payroll_expense_account_code, 
             gosi_liability_account_code, payroll_payable_account_code, created_at, updated_at 
      FROM employees 
      ORDER BY id DESC
    `);
    res.json(rows || []);
  } catch (e) { 
    console.error('[EMPLOYEES] Error listing:', e);
    res.json([]); 
  }
});
app.get("/employees/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query(`
      SELECT id, full_name, first_name, last_name, national_id, nationality, birth_date, gender, 
             employee_number, status, phone, email, hire_date, contract_type, contract_duration_months, 
             probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance, 
             other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled, 
             gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id, 
             mudad_status, mudad_last_sync, department, payroll_expense_account_code, 
             gosi_liability_account_code, payroll_payable_account_code, created_at, updated_at 
      FROM employees 
      WHERE id = $1
      LIMIT 1
    `, [id]);
    res.json(rows && rows[0] || null);
  } catch (e) { 
    console.error('[EMPLOYEE] Error getting employee:', e);
    res.status(404).json({ error: "not_found" }); 
  }
});
app.get("/api/employees/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query(`
      SELECT id, full_name, first_name, last_name, national_id, nationality, birth_date, gender, 
             employee_number, status, phone, email, hire_date, contract_type, contract_duration_months, 
             probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance, 
             other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled, 
             gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id, 
             mudad_status, mudad_last_sync, department, payroll_expense_account_code, 
             gosi_liability_account_code, payroll_payable_account_code, created_at, updated_at 
      FROM employees 
      WHERE id = $1
      LIMIT 1
    `, [id]);
    res.json(rows && rows[0] || null);
  } catch (e) { 
    console.error('[EMPLOYEE] Error getting employee:', e);
    res.status(404).json({ error: "not_found" }); 
  }
});
async function handleCreateEmployee(req, res) {
  try {
    console.log('[EMPLOYEE] Creating employee | userId=', req.user?.id, 'email=', req.user?.email);
    const b = req.body || {};
    console.log('[EMPLOYEE BODY]', JSON.stringify({ 
      full_name: b.full_name, 
      national_id: b.national_id, 
      employee_number: b.employee_number,
      basic_salary: b.basic_salary,
      housing_allowance: b.housing_allowance,
      status: b.status 
    }));
    
    // Generate employee_number if not provided
    let empNumber = b.employee_number;
    if (!empNumber || String(empNumber).trim() === '') {
      const { rows: lastEmp } = await pool.query('SELECT employee_number FROM employees WHERE employee_number IS NOT NULL AND employee_number != \'\' ORDER BY id DESC LIMIT 1');
      const lastNum = lastEmp && lastEmp[0] ? String(lastEmp[0].employee_number||'').replace(/[^0-9]/g, '') : '';
      const nextNum = lastNum ? String(Number(lastNum) + 1).padStart(6, '0') : '000001';
      empNumber = `EMP${nextNum}`;
    }
    
    // Split full_name into first_name and last_name if not provided
    let firstName = b.first_name;
    let lastName = b.last_name;
    if (!firstName || !lastName) {
      const fullName = String(b.full_name||'').trim();
      const parts = fullName.split(/\s+/).filter(p => p);
      if (parts.length > 0) {
        firstName = firstName || parts[0];
        lastName = lastName || parts.slice(1).join(' ') || parts[0];
      }
    }
    
    const { rows } = await pool.query(`
      INSERT INTO employees(
        full_name, first_name, last_name, national_id, nationality, birth_date, gender,
        employee_number, status, phone, email, hire_date, contract_type, contract_duration_months,
        probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance,
        other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled,
        gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id,
        mudad_status, mudad_last_sync, department, payroll_expense_account_code,
        gosi_liability_account_code, payroll_payable_account_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      ) RETURNING id, full_name, first_name, last_name, national_id, nationality, birth_date, gender,
        employee_number, status, phone, email, hire_date, contract_type, contract_duration_months,
        probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance,
        other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled,
        gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id,
        mudad_status, mudad_last_sync, department, payroll_expense_account_code,
        gosi_liability_account_code, payroll_payable_account_code, created_at, updated_at
    `, [
      b.full_name||null, firstName||null, lastName||null, b.national_id||null, b.nationality||'SA',
      b.birth_date||null, b.gender||null, empNumber, b.status||'active', b.phone||null, b.email||null,
      b.hire_date||null, b.contract_type||'full_time', (b.contract_duration_months!=null?Number(b.contract_duration_months):null),
      (b.probation_days!=null?Number(b.probation_days):90), b.pay_type||'monthly',
      (b.hourly_rate!=null?Number(b.hourly_rate):null), (b.basic_salary!=null?Number(b.basic_salary):null),
      (b.housing_allowance!=null?Number(b.housing_allowance):null), (b.transport_allowance!=null?Number(b.transport_allowance):null),
      (b.other_allowances!=null?Number(b.other_allowances):null), b.payment_method||'bank', b.iban||null,
      b.gosi_subscription_no||null, (b.gosi_enrolled!==undefined?Boolean(b.gosi_enrolled):false),
      (b.gosi_employee_rate!=null?Number(b.gosi_employee_rate):0.09), (b.gosi_employer_rate!=null?Number(b.gosi_employer_rate):0.11),
      b.gosi_enroll_date||null, b.gosi_status||null, b.mudad_contract_id||null, b.mudad_status||null,
      b.mudad_last_sync||null, b.department||null, b.payroll_expense_account_code||'5210',
      b.gosi_liability_account_code||'2120', b.payroll_payable_account_code||'2130'
    ]);
    
    console.log('[EMPLOYEE] SUCCESS | id=', rows?.[0]?.id);
    res.status(201).json(rows && rows[0]);
  } catch (e) { 
    console.error('[EMPLOYEE ERROR]', e);
    console.error('[EMPLOYEE ERROR STACK]', e?.stack);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
}
app.post("/employees", authenticateToken, authorize("employees","create"), handleCreateEmployee);
app.post("/api/employees", authenticateToken, authorize("employees","create"), handleCreateEmployee);
async function handleUpdateEmployee(req, res) {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    
    // Split full_name into first_name and last_name if full_name is provided but first/last are not
    let firstName = b.first_name;
    let lastName = b.last_name;
    if (b.full_name && (!firstName || !lastName)) {
      const fullName = String(b.full_name||'').trim();
      const parts = fullName.split(/\s+/).filter(p => p);
      if (parts.length > 0) {
        firstName = firstName || parts[0];
        lastName = lastName || parts.slice(1).join(' ') || parts[0];
      }
    }
    
    const { rows } = await pool.query(`
      UPDATE employees SET
        full_name=COALESCE($1,full_name),
        first_name=COALESCE($2,first_name),
        last_name=COALESCE($3,last_name),
        national_id=COALESCE($4,national_id),
        nationality=COALESCE($5,nationality),
        birth_date=COALESCE($6,birth_date),
        gender=COALESCE($7,gender),
        employee_number=COALESCE($8,employee_number),
        status=COALESCE($9,status),
        phone=COALESCE($10,phone),
        email=COALESCE($11,email),
        hire_date=COALESCE($12,hire_date),
        contract_type=COALESCE($13,contract_type),
        contract_duration_months=COALESCE($14,contract_duration_months),
        probation_days=COALESCE($15,probation_days),
        pay_type=COALESCE($16,pay_type),
        hourly_rate=COALESCE($17,hourly_rate),
        basic_salary=COALESCE($18,basic_salary),
        housing_allowance=COALESCE($19,housing_allowance),
        transport_allowance=COALESCE($20,transport_allowance),
        other_allowances=COALESCE($21,other_allowances),
        payment_method=COALESCE($22,payment_method),
        iban=COALESCE($23,iban),
        gosi_subscription_no=COALESCE($24,gosi_subscription_no),
        gosi_enrolled=COALESCE($25,gosi_enrolled),
        gosi_employee_rate=COALESCE($26,gosi_employee_rate),
        gosi_employer_rate=COALESCE($27,gosi_employer_rate),
        gosi_enroll_date=COALESCE($28,gosi_enroll_date),
        gosi_status=COALESCE($29,gosi_status),
        mudad_contract_id=COALESCE($30,mudad_contract_id),
        mudad_status=COALESCE($31,mudad_status),
        mudad_last_sync=COALESCE($32,mudad_last_sync),
        department=COALESCE($33,department),
        payroll_expense_account_code=COALESCE($34,payroll_expense_account_code),
        gosi_liability_account_code=COALESCE($35,gosi_liability_account_code),
        payroll_payable_account_code=COALESCE($36,payroll_payable_account_code),
        updated_at=NOW()
      WHERE id=$37
      RETURNING id, full_name, first_name, last_name, national_id, nationality, birth_date, gender,
        employee_number, status, phone, email, hire_date, contract_type, contract_duration_months,
        probation_days, pay_type, hourly_rate, basic_salary, housing_allowance, transport_allowance,
        other_allowances, payment_method, iban, gosi_subscription_no, gosi_enrolled,
        gosi_employee_rate, gosi_employer_rate, gosi_enroll_date, gosi_status, mudad_contract_id,
        mudad_status, mudad_last_sync, department, payroll_expense_account_code,
        gosi_liability_account_code, payroll_payable_account_code, created_at, updated_at
    `, [
      b.full_name||null, firstName||null, lastName||null, b.national_id||null, b.nationality||null,
      b.birth_date||null, b.gender||null, b.employee_number||null, b.status||null, b.phone||null,
      b.email||null, b.hire_date||null, b.contract_type||null, (b.contract_duration_months!=null?Number(b.contract_duration_months):null),
      (b.probation_days!=null?Number(b.probation_days):null), b.pay_type||null, (b.hourly_rate!=null?Number(b.hourly_rate):null),
      (b.basic_salary!=null?Number(b.basic_salary):null), (b.housing_allowance!=null?Number(b.housing_allowance):null),
      (b.transport_allowance!=null?Number(b.transport_allowance):null), (b.other_allowances!=null?Number(b.other_allowances):null),
      b.payment_method||null, b.iban||null, b.gosi_subscription_no||null, (b.gosi_enrolled!==undefined?Boolean(b.gosi_enrolled):null),
      (b.gosi_employee_rate!=null?Number(b.gosi_employee_rate):null), (b.gosi_employer_rate!=null?Number(b.gosi_employer_rate):null),
      b.gosi_enroll_date||null, b.gosi_status||null, b.mudad_contract_id||null, b.mudad_status||null,
      b.mudad_last_sync||null, b.department||null, b.payroll_expense_account_code||null,
      b.gosi_liability_account_code||null, b.payroll_payable_account_code||null, id
    ]);
    res.json(rows && rows[0]);
  } catch (e) { 
    console.error('[EMPLOYEE] Error updating:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
app.put("/employees/:id", authenticateToken, authorize("employees","edit"), handleUpdateEmployee);
app.put("/api/employees/:id", authenticateToken, authorize("employees","edit"), handleUpdateEmployee);
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
    const { rows } = await pool.query('SELECT id, invoice_number, type, amount, COALESCE(total, amount) as total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at FROM expenses ORDER BY id DESC');
    // Map items to format expected by frontend
    const items = (rows || []).map(row => {
      const status = String(row.status || 'draft');
      const hasPostedJournal = !!row.journal_entry_id;
      const isDraft = status === 'draft';
      const isPosted = status === 'posted';
      
      return {
        ...row,
        invoice_number: row.invoice_number || `EXP-${row.id}`,
        total: Number(row.total || row.amount || 0),
        derived_status: isPosted ? 'posted' : (isDraft ? 'draft' : status),
        has_posted_journal: hasPostedJournal,
        allowed_actions: {
          post: isDraft && !hasPostedJournal,
          edit: isDraft && !hasPostedJournal,
          delete: isDraft && !hasPostedJournal,
          reverse: isPosted && hasPostedJournal
        }
      };
    });
    res.json({ items });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/api/expenses", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, invoice_number, type, amount, COALESCE(total, amount) as total, account_code, partner_id, description, status, branch, date, payment_method, items, journal_entry_id, created_at FROM expenses ORDER BY id DESC');
    // Map items to format expected by frontend
    const items = (rows || []).map(row => {
      const status = String(row.status || 'draft');
      const hasPostedJournal = !!row.journal_entry_id;
      const isDraft = status === 'draft';
      const isPosted = status === 'posted';
      
      return {
        ...row,
        invoice_number: row.invoice_number || `EXP-${row.id}`,
        total: Number(row.total || row.amount || 0),
        derived_status: isPosted ? 'posted' : (isDraft ? 'draft' : status),
        has_posted_journal: hasPostedJournal,
        allowed_actions: {
          post: isDraft && !hasPostedJournal,
          edit: isDraft && !hasPostedJournal,
          delete: isDraft && !hasPostedJournal,
          reverse: isPosted && hasPostedJournal
        }
      };
    });
    res.json({ items });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/api/expenses/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, invoice_number, type, amount, COALESCE(total, amount) as total, account_code, partner_id, description, status, branch, date, payment_method, items, journal_entry_id, created_at, updated_at FROM expenses WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Expense not found" });
    }
    const expense = rows[0];
    expense.invoice_number = expense.invoice_number || `EXP-${expense.id}`;
    expense.total = Number(expense.total || expense.amount || 0);
    res.json(expense);
  } catch (e) {
    console.error('[EXPENSES] Error getting expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.post("/expenses", authenticateToken, authorize("expenses","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const expenseType = b.type || b.expense_type || 'expense';
    const amount = Number(b.amount || 0);
    const items = Array.isArray(b.items) ? b.items : [];
    const total = b.total != null ? Number(b.total) : (items.length > 0 ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : amount);
    const invoiceNumber = b.invoice_number || null;
    const accountCode = b.account_code || null;
    const partnerId = b.partner_id || null;
    const description = b.description || null;
    // ✅ ترحيل تلقائي عند الإنشاء إذا كان status = 'posted' أو auto_post = true
    const autoPost = b.auto_post === true || b.status === 'posted';
    const status = autoPost ? 'posted' : (b.status || 'draft');
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const date = b.date || new Date().toISOString().slice(0, 10);
    const paymentMethod = b.payment_method || 'cash';
    
    // Insert expense with date and payment_method
    const itemsJson = items.length > 0 ? JSON.stringify(items) : null;
    const { rows } = await client.query(
      'INSERT INTO expenses(invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id, invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at',
      [invoiceNumber, expenseType, amount, total, accountCode, partnerId, description, status, branch, date, paymentMethod, itemsJson]
    );
    const expense = rows && rows[0];
    
    if (!expense || !expense.id) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "create_failed", details: "Failed to create expense" });
    }
    
    console.log(`[EXPENSES] Created expense ${expense.id}, amount=${amount}, account=${accountCode}`);
    
    // ✅ If expense is posted (not draft), create journal entry automatically
    if (status === 'posted' && total > 0 && accountCode) {
      try {
        // CRITICAL FIX: Check if journal entry already exists
        const { rows: existingExpense } = await client.query('SELECT journal_entry_id FROM expenses WHERE id = $1', [expense.id]);
        if (existingExpense && existingExpense[0] && existingExpense[0].journal_entry_id) {
          console.log(`[EXPENSES] Expense ${expense.id} already has journal entry ${existingExpense[0].journal_entry_id}`);
          // Journal entry already exists, skip creation
        } else {
          // Get expense account ID
          const expenseAccountId = await getAccountIdByNumber(accountCode);
          
          // Get payment account ID (cash or bank based on payment_method)
          let paymentAccountId = null;
          if (paymentMethod && String(paymentMethod).toLowerCase() === 'bank') {
            paymentAccountId = await getAccountIdByNumber('1121'); // Default bank account
          } else {
            paymentAccountId = await getAccountIdByNumber('1111'); // Default cash account
          }
          
          if (expenseAccountId && paymentAccountId) {
            // ✅ استخدام SEQUENCE للترقيم التلقائي
            // Create journal entry (entry_number سيتم ملؤه تلقائياً من SEQUENCE)
            const entryDescription = expenseType ? `مصروف #${expense.id} - ${expenseType}` : `مصروف #${expense.id}${description ? ' - ' + description : ''}`;
            
            // CRITICAL FIX: Calculate totals before creating journal entry for balance validation
            let totalDebit = 0;
            let totalCredit = total;
            
            if (items.length > 0) {
              // Multiple items - calculate total debit
              for (const item of items) {
                totalDebit += Number(item.amount || 0);
              }
            } else {
              // Single expense
              totalDebit = total;
            }
            
            // CRITICAL FIX: Validate balance before creating journal entry
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
              console.error('[EXPENSES] Journal entry unbalanced:', { totalDebit, totalCredit, expenseId: expense.id });
              await client.query('ROLLBACK');
              return res.status(400).json({ error: "unbalanced_entry", details: "Journal entry is not balanced" });
            }
            
            // Get next entry number (reuses deleted numbers)
            const entryNumber = await getNextEntryNumber();
            
            const { rows: entryRows } = await client.query(
              `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
              [entryNumber, entryDescription, date, 'expense', expense.id, 'posted', branch]
            );
            
            const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
            
            if (entryId) {
              // Create postings for each item or single posting
              if (items.length > 0) {
                // Multiple items - create posting for each
                for (const item of items) {
                  const itemAmount = Number(item.amount || 0);
                  const itemAccountId = await getAccountIdByNumber(item.account_code);
                  if (itemAccountId && itemAmount > 0) {
                    await client.query(
                      `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                       VALUES ($1, $2, $3, $4)`,
                      [entryId, itemAccountId, itemAmount, 0]
                    );
                  }
                }
                // Payment posting (credit)
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, paymentAccountId, 0, total]
                );
              } else {
                // Single expense - create two postings
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, expenseAccountId, total, 0]
                );
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, paymentAccountId, 0, total]
                );
              }
              
              // ✅ ربط المصروف بالقيد
              await client.query(
                'UPDATE expenses SET journal_entry_id = $1 WHERE id = $2',
                [entryId, expense.id]
              );
              
              console.log(`[EXPENSES] Auto-posted expense ${expense.id}, created journal entry ${entryId}`);
            }
          } else {
            console.warn(`[EXPENSES] Could not create journal entry - expenseAccountId=${expenseAccountId}, paymentAccountId=${paymentAccountId}`);
          }
        }
      } catch (journalError) {
        console.error('[EXPENSES] Error creating journal entry:', journalError);
        // Don't fail expense creation if journal entry fails - just log it
      }
    }
    
    await client.query('COMMIT');
    res.json(expense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error creating expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
app.post("/api/expenses", authenticateToken, authorize("expenses","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const expenseType = b.type || b.expense_type || 'expense';
    const amount = Number(b.amount || 0);
    const items = Array.isArray(b.items) ? b.items : [];
    const total = b.total != null ? Number(b.total) : (items.length > 0 ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : amount);
    const invoiceNumber = b.invoice_number || null;
    const accountCode = b.account_code || null;
    const partnerId = b.partner_id || null;
    const description = b.description || null;
    // ✅ ترحيل تلقائي عند الإنشاء إذا كان status = 'posted' أو auto_post = true
    const autoPost = b.auto_post === true || b.status === 'posted';
    const status = autoPost ? 'posted' : (b.status || 'draft');
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const date = b.date || new Date().toISOString().slice(0, 10);
    const paymentMethod = b.payment_method || 'cash';
    
    // Insert expense
    const itemsJson = items.length > 0 ? JSON.stringify(items) : null;
    const { rows } = await client.query(
      'INSERT INTO expenses(invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id, invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at',
      [invoiceNumber, expenseType, amount, total, accountCode, partnerId, description, status, branch, date, paymentMethod, itemsJson]
    );
    const expense = rows && rows[0];
    
    if (!expense || !expense.id) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "create_failed", details: "Failed to create expense" });
    }
    
    console.log(`[EXPENSES] Created expense ${expense.id}, amount=${amount}, account=${accountCode}`);
    
    // ✅ If expense is posted (not draft), create journal entry automatically
    if (status === 'posted' && total > 0 && accountCode) {
      try {
        // Get expense account ID
        const expenseAccountId = await getAccountIdByNumber(accountCode);
        
        // Get payment account ID (cash or bank based on payment_method)
        let paymentAccountId = null;
        if (paymentMethod && String(paymentMethod).toLowerCase() === 'bank') {
          paymentAccountId = await getAccountIdByNumber('1121'); // Default bank account
        } else {
          paymentAccountId = await getAccountIdByNumber('1111'); // Default cash account
        }
        
        if (expenseAccountId && paymentAccountId) {
          // ✅ استخدام SEQUENCE للترقيم التلقائي
          // Create journal entry (entry_number سيتم ملؤه تلقائياً من SEQUENCE)
          const entryDescription = expenseType ? `مصروف #${expense.id} - ${expenseType}` : `مصروف #${expense.id}${description ? ' - ' + description : ''}`;
          
          // CRITICAL FIX: Calculate totals before creating journal entry for balance validation
          let totalDebit = 0;
          let totalCredit = total;
          
          if (items.length > 0) {
            // Multiple items - calculate total debit
            for (const item of items) {
              totalDebit += Number(item.amount || 0);
            }
          } else {
            // Single expense
            totalDebit = total;
          }
          
          // CRITICAL FIX: Validate balance before creating journal entry
          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            console.error('[EXPENSES] Journal entry unbalanced:', { totalDebit, totalCredit, expenseId: expense.id });
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "unbalanced_entry", details: "Journal entry is not balanced" });
          }
          
          // Get next entry number (reuses deleted numbers)
          const entryNumber = await getNextEntryNumber();
          
          const { rows: entryRows } = await client.query(
            `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
            [entryNumber, entryDescription, date, 'expense', expense.id, 'posted', branch]
          );
          
          const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
          
          if (entryId) {
            // Create postings for each item or single posting
            if (items.length > 0) {
              // Multiple items - create posting for each
              for (const item of items) {
                const itemAmount = Number(item.amount || 0);
                const itemAccountId = await getAccountIdByNumber(item.account_code);
                if (itemAccountId && itemAmount > 0) {
                  await client.query(
                    `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                     VALUES ($1, $2, $3, $4)`,
                    [entryId, itemAccountId, itemAmount, 0]
                  );
                }
              }
              // Payment posting (credit)
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, paymentAccountId, 0, total]
              );
            } else {
              // Single expense - create two postings
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, expenseAccountId, total, 0]
              );
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, paymentAccountId, 0, total]
              );
            }
            
            // ✅ المرحلة 4: ربط المصروف بالقيد
            await client.query(
              'UPDATE expenses SET journal_entry_id = $1 WHERE id = $2',
              [entryId, expense.id]
            );
            
            console.log(`[EXPENSES] Auto-posted expense ${expense.id}, created journal entry ${entryId}`);
          }
        } else {
          console.warn(`[EXPENSES] Could not create journal entry - expenseAccountId=${expenseAccountId}, paymentAccountId=${paymentAccountId}`);
        }
      } catch (journalError) {
        console.error('[EXPENSES] Error creating journal entry:', journalError);
        // Don't fail expense creation if journal entry fails - just log it
      }
    }
    
    await client.query('COMMIT');
    // Format expense response
    const formattedExpense = {
      ...expense,
      invoice_number: expense.invoice_number || `EXP-${expense.id}`,
      total: Number(expense.total || expense.amount || 0)
    };
    res.json(formattedExpense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error creating expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
app.put("/expenses/:id", authenticateToken, authorize("expenses","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const total = b.total != null ? Number(b.total) : (items.length > 0 ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : (b.amount != null ? Number(b.amount) : null));
    const itemsJson = items.length > 0 ? JSON.stringify(items) : null;
    const { rows } = await pool.query(
      'UPDATE expenses SET invoice_number=COALESCE($1,invoice_number), type=COALESCE($2,type), amount=COALESCE($3,amount), total=COALESCE($4,total), account_code=COALESCE($5,account_code), partner_id=COALESCE($6,partner_id), description=COALESCE($7,description), status=COALESCE($8,status), branch=COALESCE($9,branch), date=COALESCE($10,date), payment_method=COALESCE($11,payment_method), items=COALESCE($12::jsonb,items), updated_at=NOW() WHERE id=$13 RETURNING id, invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at',
      [b.invoice_number||null, b.type||b.expense_type||null, (b.amount!=null?Number(b.amount):null), total, b.account_code||null, (b.partner_id!=null?Number(b.partner_id):null), b.description||null, b.status||null, b.branch||null, b.date||null, b.payment_method||null, itemsJson, id]
    );
    const expense = rows && rows[0];
    if (expense) {
      expense.invoice_number = expense.invoice_number || `EXP-${expense.id}`;
      expense.total = Number(expense.total || expense.amount || 0);
    }
    res.json(expense);
  } catch (e) { res.status(500).json({ error: "server_error" }); }
});
app.put("/api/expenses/:id", authenticateToken, authorize("expenses","edit", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id||0);
    const b = req.body || {};
    
    // Get current expense to check status change
    const { rows: currentRows } = await client.query('SELECT status, journal_entry_id FROM expenses WHERE id = $1', [id]);
    const currentExpense = currentRows && currentRows[0];
    const oldStatus = currentExpense ? currentExpense.status : null;
    const hasJournalEntry = currentExpense && currentExpense.journal_entry_id;
    
    const items = Array.isArray(b.items) ? b.items : [];
    const total = b.total != null ? Number(b.total) : (items.length > 0 ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : (b.amount != null ? Number(b.amount) : null));
    const itemsJson = items.length > 0 ? JSON.stringify(items) : null;
    const newStatus = b.status || oldStatus;
    const accountCode = b.account_code || null;
    const paymentMethod = b.payment_method || null;
    const expenseType = b.type || b.expense_type || null;
    const description = b.description || null;
    const date = b.date || null;
    const branch = b.branch || null;
    
    const { rows } = await client.query(
      'UPDATE expenses SET invoice_number=COALESCE($1,invoice_number), type=COALESCE($2,type), amount=COALESCE($3,amount), total=COALESCE($4,total), account_code=COALESCE($5,account_code), partner_id=COALESCE($6,partner_id), description=COALESCE($7,description), status=COALESCE($8,status), branch=COALESCE($9,branch), date=COALESCE($10,date), payment_method=COALESCE($11,payment_method), items=COALESCE($12::jsonb,items), updated_at=NOW() WHERE id=$13 RETURNING id, invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at',
      [b.invoice_number||null, expenseType, (b.amount!=null?Number(b.amount):null), total, accountCode, (b.partner_id!=null?Number(b.partner_id):null), description, newStatus, branch, date, paymentMethod, itemsJson, id]
    );
    const expense = rows && rows[0];
    if (expense) {
      expense.invoice_number = expense.invoice_number || `EXP-${expense.id}`;
      expense.total = Number(expense.total || expense.amount || 0);
    }
    
    // CRITICAL FIX: Create journal entry if status changed to 'posted' and doesn't have one
    if (newStatus === 'posted' && oldStatus !== 'posted' && !hasJournalEntry && total > 0 && (accountCode || (items.length > 0 && items[0]?.account_code))) {
      try {
        const finalAccountCode = accountCode || (items.length > 0 ? items[0].account_code : null);
        if (finalAccountCode) {
          // Get expense account ID
          const expenseAccountId = await getAccountIdByNumber(finalAccountCode);
          
          // Get payment account ID (cash or bank based on payment_method)
          let paymentAccountId = null;
          const pm = paymentMethod || expense.payment_method || 'cash';
          if (pm && String(pm).toLowerCase() === 'bank') {
            paymentAccountId = await getAccountIdByNumber('1121'); // Default bank account
          } else {
            paymentAccountId = await getAccountIdByNumber('1111'); // Default cash account
          }
          
          if (expenseAccountId && paymentAccountId) {
            // Calculate totals for balance validation
            let totalDebit = 0;
            let totalCredit = total;
            
            if (items.length > 0) {
              for (const item of items) {
                totalDebit += Number(item.amount || 0);
              }
            } else {
              totalDebit = total;
            }
            
            // Validate balance
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: "unbalanced_entry", details: "Journal entry is not balanced" });
            }
            
            const entryDescription = expenseType ? `مصروف #${expense.id} - ${expenseType}` : `مصروف #${expense.id}${description ? ' - ' + description : ''}`;
            
            // Get next entry number (reuses deleted numbers)
            const entryNumber = await getNextEntryNumber();
            
            const { rows: entryRows } = await client.query(
              `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
              [entryNumber, entryDescription, date || expense.date || new Date().toISOString().slice(0, 10), 'expense', expense.id, 'posted', branch || expense.branch || 'china_town']
            );
            
            const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
            
            if (entryId) {
              // Create postings
              if (items.length > 0) {
                for (const item of items) {
                  const itemAmount = Number(item.amount || 0);
                  const itemAccountId = await getAccountIdByNumber(item.account_code);
                  if (itemAccountId && itemAmount > 0) {
                    await client.query(
                      `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                       VALUES ($1, $2, $3, $4)`,
                      [entryId, itemAccountId, itemAmount, 0]
                    );
                  }
                }
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, paymentAccountId, 0, total]
                );
              } else {
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, expenseAccountId, total, 0]
                );
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, paymentAccountId, 0, total]
                );
              }
              
              // Link expense to journal entry
              await client.query('UPDATE expenses SET journal_entry_id = $1 WHERE id = $2', [entryId, expense.id]);
              console.log(`[EXPENSES] Updated expense ${expense.id} to posted, created journal entry ${entryId}`);
            }
          }
        }
      } catch (journalError) {
        console.error('[EXPENSES] Error creating journal entry on update:', journalError);
        // Don't fail update if journal entry fails - just log it
      }
    }
    
    await client.query('COMMIT');
    res.json(expense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error updating expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});

// POST /expenses/:id/post - Post expense and create journal entry
app.post("/expenses/:id/post", authenticateToken, authorize("expenses","edit"), checkAccountingPeriod(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    
    // Get expense
    const { rows: expenseRows } = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (!expenseRows || !expenseRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", details: "Expense not found" });
    }
    
    const expense = expenseRows[0];
    
    // Check if already posted
    if (expense.status === 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "already_posted", details: "Expense is already posted" });
    }
    
    const amount = Number(expense.total || expense.amount || 0);
    const accountCode = expense.account_code;
    
    if (amount <= 0 || !accountCode) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_expense", details: "Expense amount or account code is missing" });
    }
    
    // Update status to posted
    await client.query('UPDATE expenses SET status = $1 WHERE id = $2', ['posted', id]);
    
    // Get expense account ID
    const expenseAccountId = await getAccountIdByNumber(accountCode);
    
    // Get payment account ID (cash or bank based on payment_method)
    let paymentAccountId = null;
    const paymentMethod = String(expense.payment_method || 'cash').toLowerCase();
    if (paymentMethod === 'bank') {
      paymentAccountId = await getAccountIdByNumber('1121'); // Default bank account
    } else {
      paymentAccountId = await getAccountIdByNumber('1111'); // Default cash account
    }
    
    if (expenseAccountId && paymentAccountId) {
      // ✅ Get next entry number (reuses deleted numbers)
      const entryNumber = await getNextEntryNumber();
      
      // ✅ نسخ جميع الحقول الضرورية من expense إلى journal_entry
      const description = expense.type ? `مصروف #${expense.id} - ${expense.type}` : `مصروف #${expense.id}${expense.description ? ' - ' + expense.description : ''}`;
      const { rows: entryRows } = await client.query(
        `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
        [entryNumber, description, expense.date, 'expense', expense.id, 'posted', expense.branch || null]
      );
      
      const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
      
      if (entryId) {
        // Create postings
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, expenseAccountId, amount, 0]
        );
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, paymentAccountId, 0, amount]
        );
        
        // ✅ المرحلة 4: ربط المصروف بالقيد
        await client.query(
          'UPDATE expenses SET journal_entry_id = $1 WHERE id = $2',
          [entryId, id]
        );
        
        console.log(`[EXPENSES] Posted expense ${id}, created journal entry ${entryId}`);
      }
    } else {
      console.warn(`[EXPENSES] Could not create journal entry - expenseAccountId=${expenseAccountId}, paymentAccountId=${paymentAccountId}`);
    }
    
    await client.query('COMMIT');
    
    // Fetch updated expense
    const { rows: updatedRows } = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    const updatedExpense = updatedRows && updatedRows[0];
    if (updatedExpense) {
      updatedExpense.invoice_number = updatedExpense.invoice_number || `EXP-${updatedExpense.id}`;
      updatedExpense.total = Number(updatedExpense.total || updatedExpense.amount || 0);
    }
    res.json(updatedExpense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error posting expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
app.post("/api/expenses/:id/post", authenticateToken, authorize("expenses","edit"), checkAccountingPeriod(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    
    // Get expense
    const { rows: expenseRows } = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (!expenseRows || !expenseRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", details: "Expense not found" });
    }
    
    const expense = expenseRows[0];
    
    // Check if already posted
    if (expense.status === 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "already_posted", details: "Expense is already posted" });
    }
    
    const amount = Number(expense.total || expense.amount || 0);
    const accountCode = expense.account_code;
    
    if (amount <= 0 || !accountCode) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_expense", details: "Expense amount or account code is missing" });
    }
    
    // Update status to posted
    await client.query('UPDATE expenses SET status = $1 WHERE id = $2', ['posted', id]);
    
    // Get expense account ID
    const expenseAccountId = await getAccountIdByNumber(accountCode);
    
    // Get payment account ID (cash or bank based on payment_method)
    let paymentAccountId = null;
    const paymentMethod = String(expense.payment_method || 'cash').toLowerCase();
    if (paymentMethod === 'bank') {
      paymentAccountId = await getAccountIdByNumber('1121'); // Default bank account
    } else {
      paymentAccountId = await getAccountIdByNumber('1111'); // Default cash account
    }
    
    if (expenseAccountId && paymentAccountId) {
      // ✅ Get next entry number (reuses deleted numbers)
      const entryNumber = await getNextEntryNumber();
      
      // ✅ نسخ جميع الحقول الضرورية من expense إلى journal_entry
      const description = expense.type ? `مصروف #${expense.id} - ${expense.type}` : `مصروف #${expense.id}${expense.description ? ' - ' + expense.description : ''}`;
      const { rows: entryRows } = await client.query(
        `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
        [entryNumber, description, expense.date, 'expense', expense.id, 'posted', expense.branch || null]
      );
      
      const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
      
      if (entryId) {
        // Create postings
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, expenseAccountId, amount, 0]
        );
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, paymentAccountId, 0, amount]
        );
        
        // ✅ المرحلة 4: ربط المصروف بالقيد
        await client.query(
          'UPDATE expenses SET journal_entry_id = $1 WHERE id = $2',
          [entryId, id]
        );
        
        console.log(`[EXPENSES] Posted expense ${id}, created journal entry ${entryId}`);
      }
    } else {
      console.warn(`[EXPENSES] Could not create journal entry - expenseAccountId=${expenseAccountId}, paymentAccountId=${paymentAccountId}`);
    }
    
    await client.query('COMMIT');
    
    // Fetch updated expense
    const { rows: updatedRows } = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    const updatedExpense = updatedRows && updatedRows[0];
    if (updatedExpense) {
      updatedExpense.invoice_number = updatedExpense.invoice_number || `EXP-${updatedExpense.id}`;
      updatedExpense.total = Number(updatedExpense.total || updatedExpense.amount || 0);
    }
    res.json(updatedExpense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error posting expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
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
// Helper function to get next supplier invoice number (reuses deleted numbers)
async function getNextSupplierInvoiceNumber() {
  try {
    const year = (new Date()).getFullYear();
    const pattern = /PI\/(\d{4})\/(\d+)/;
    
    // Get all supplier invoice numbers for current year, sorted
    const { rows } = await pool.query(
      `SELECT number FROM supplier_invoices 
       WHERE number ~ $1 
       ORDER BY number ASC`,
      [`^PI/${year}/\\d+$`]
    );
    
    // Extract numbers and find gaps
    const usedNumbers = (rows || [])
      .map(r => {
        const m = pattern.exec(String(r.number || ''));
        return m && Number(m[1]) === year ? Number(m[2] || 0) : null;
      })
      .filter(n => n !== null && n > 0)
      .sort((a, b) => a - b);
    
    // Find first gap or use next sequential number
    let nextN = 1;
    for (const num of usedNumbers) {
      if (num === nextN) {
        nextN++;
      } else if (num > nextN) {
        // Found a gap - reuse it
        return `PI/${year}/${String(nextN).padStart(10, '0')}`;
      }
    }
    
    // No gaps found, use next sequential number
    return `PI/${year}/${String(nextN).padStart(10, '0')}`;
  } catch (e) {
    console.error('[SUPPLIER INVOICES] Error getting next number:', e);
    // Fallback: use max + 1
    try {
      const { rows } = await pool.query('SELECT number FROM supplier_invoices ORDER BY id DESC LIMIT 1');
      const last = rows && rows[0] ? String(rows[0].number || '') : '';
      const year = (new Date()).getFullYear();
      const m = /PI\/(\d{4})\/(\d+)/.exec(last);
      const nextN = m && Number(m[1]) === year ? Number(m[2] || 0) + 1 : 1;
      return `PI/${year}/${String(nextN).padStart(10, '0')}`;
    } catch (e2) {
      const year = (new Date()).getFullYear();
      return `PI/${year}/0000000001`;
    }
  }
}

async function handleGetSupplierInvoiceNextNumber(req, res) {
  try {
    const next = await getNextSupplierInvoiceNumber();
    res.json({ next });
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
    const { rows } = await pool.query('SELECT id, number, date, customer_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, journal_entry_id, created_at FROM invoices ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/api/invoices", authenticateToken, authorize("sales","view", { branchFrom: r => (r.query.branch || null) }), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, number, date, customer_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, journal_entry_id, created_at FROM invoices ORDER BY id DESC');
    res.json({ items: rows || [] });
  } catch (e) { res.json({ items: [] }); }
});
app.get("/api/invoices/:id", authenticateToken, authorize("sales","view"), async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, journal_entry_id, created_at, updated_at FROM invoices WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Invoice not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('[INVOICES] Error getting invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
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
app.post("/invoices", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), async (req, res) => {
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
app.post("/api/invoices", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), async (req, res) => {
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const linesJson = lines.length > 0 ? JSON.stringify(lines) : null;
    const { rows } = await pool.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.customer_id||null, linesJson, Number(b.subtotal||0), Number(b.discount_pct||0), Number(b.discount_amount||0), Number(b.tax_pct||0), Number(b.tax_amount||0), Number(b.total||0), b.payment_method||null, String(b.status||'draft'), branch]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[INVOICES] Error creating invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.put("/api/invoices/:id", authenticateToken, authorize("sales","edit", { branchFrom: r => (r.body?.branch || null) }), async (req, res) => {
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
    // Normalize branch - same logic as handleSaveDraft
    let branch = req.query?.branch || null;
    if (branch) {
      const branchLower = String(branch).toLowerCase().replace(/\s+/g, '_');
      if (branchLower === 'palace_india' || branchLower === 'palce_india') {
        branch = 'place_india';
      } else {
        branch = branchLower;
      }
    }
    
    const table = req.query?.table || null;
    const status = req.query?.status || null;
    
    let query = 'SELECT id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customerId, customer_name, customer_phone, created_at FROM orders WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (branch) {
      query += ` AND LOWER(branch) = LOWER($${paramIndex})`;
      params.push(branch);
      paramIndex++;
    }
    if (table) {
      // Normalize table - handle both string and number
      const tableValue = String(table).trim();
      query += ` AND table_code = $${paramIndex}`;
      params.push(tableValue);
      paramIndex++;
    }
    if (status) {
      // Normalize status - convert to uppercase for comparison
      const statuses = status.split(',').map(s => s.trim().toUpperCase());
      query += ` AND UPPER(status) = ANY($${paramIndex})`;
      params.push(statuses.map(s => s.toUpperCase()));
      paramIndex++;
    }
    query += ' ORDER BY id DESC';
    
    console.log(`[ORDERS] GET /api/orders - Query: ${query}`);
    console.log(`[ORDERS] GET /api/orders - Params:`, params);
    
    const { rows } = await pool.query(query, params);
    console.log(`[ORDERS] GET /api/orders - Found ${rows?.length || 0} orders for branch=${branch}, table=${table}, status=${status}`);
    
    if (rows && rows.length > 0) {
      console.log(`[ORDERS] Sample order: id=${rows[0].id}, branch='${rows[0].branch}', table_code='${rows[0].table_code}', status='${rows[0].status}'`);
    }
    
    // Parse lines from JSONB/JSON string to array - handle all cases
    const orders = (rows || []).map(order => {
      // Ensure lines is always an array
      let lines = [];
      try {
        // Debug: Log raw lines data type
        const linesType = typeof order.lines;
        const linesIsArray = Array.isArray(order.lines);
        console.log(`[ORDERS] Order ${order.id}: lines type=${linesType}, isArray=${linesIsArray}, value=`, order.lines ? (linesIsArray ? `${order.lines.length} items` : String(order.lines).substring(0, 100)) : 'null');
        
        if (order.lines === null || order.lines === undefined) {
          lines = [];
        } else if (Array.isArray(order.lines)) {
          // PostgreSQL JSONB returns as array directly
          lines = order.lines;
          console.log(`[ORDERS] Order ${order.id}: Parsed ${lines.length} lines from array`);
        } else if (typeof order.lines === 'string') {
          // If stored as JSON string, parse it
          const parsed = JSON.parse(order.lines);
          lines = Array.isArray(parsed) ? parsed : [];
          console.log(`[ORDERS] Order ${order.id}: Parsed ${lines.length} lines from JSON string`);
        } else if (typeof order.lines === 'object') {
          // If it's an object but not array, try to convert
          if (Array.isArray(order.lines)) {
            lines = order.lines;
          } else {
            // Single object - wrap in array
            lines = [order.lines];
            console.log(`[ORDERS] Order ${order.id}: Wrapped object in array`);
          }
        }
      } catch (e) {
        console.error('[ORDERS] Error parsing lines for order', order.id, e);
        console.error('[ORDERS] Raw lines value:', order.lines);
        lines = [];
      }
      
      const result = {
        ...order,
        lines: lines,
        // Also add items alias for frontend compatibility
        items: lines
      };
      
      console.log(`[ORDERS] Order ${order.id} response: ${result.lines.length} lines/items`);
      return result;
    });
    
    console.log(`[ORDERS] Returning ${orders.length} orders with lines parsed`);
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
    const { rows } = await pool.query('SELECT id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customerId, customer_name, customer_phone, created_at FROM orders WHERE id=$1', [id]);
    const order = rows && rows[0];
    if (!order) {
      return res.json(null);
    }
    
    // CRITICAL: Parse lines from JSONB/JSON string/object to array - handle ALL cases
    let lines = [];
    try {
      if (order.lines === null || order.lines === undefined) {
        lines = [];
      } else if (Array.isArray(order.lines)) {
        // PostgreSQL JSONB returns as array directly - use as-is
        lines = order.lines;
        console.log(`[ORDERS] Order ${id}: lines is array, ${lines.length} items`);
      } else if (typeof order.lines === 'string') {
        // If stored as JSON string, parse it
        try {
          const parsed = JSON.parse(order.lines);
          lines = Array.isArray(parsed) ? parsed : [];
          console.log(`[ORDERS] Order ${id}: parsed JSON string, ${lines.length} items`);
        } catch (parseError) {
          console.warn(`[ORDERS] Order ${id}: Failed to parse JSON string:`, parseError);
          lines = [];
        }
      } else if (typeof order.lines === 'object') {
        // If it's an object but not array, convert to array
        // This handles cases where PostgreSQL JSONB returns as object instead of array
        try {
          // Try Object.values first (for objects like {0: {...}, 1: {...}})
          const values = Object.values(order.lines);
          if (values.length > 0 && Array.isArray(values[0])) {
            // If values are arrays, flatten
            lines = values.flat();
          } else if (values.length > 0) {
            // If values are objects, use them directly
            lines = values;
            console.log(`[ORDERS] Order ${id}: Converted object to array using Object.values, ${lines.length} items`);
          } else {
            // Empty object or single object - wrap in array
            lines = [order.lines];
            console.log(`[ORDERS] Order ${id}: Wrapped single object in array`);
          }
        } catch (convertError) {
          console.warn(`[ORDERS] Order ${id}: Failed to convert object to array:`, convertError);
          // Fallback: wrap in array if possible
          lines = Array.isArray(order.lines) ? order.lines : (order.lines ? [order.lines] : []);
        }
      }
      
      // CRITICAL: Final validation - ensure lines is always an array
      if (!Array.isArray(lines)) {
        console.warn(`[ORDERS] Order ${id}: lines is not array after parsing, forcing to array`);
        lines = [];
      }
    } catch (e) {
      console.error('[ORDERS] Error parsing lines for order', id, e);
      console.error('[ORDERS] Raw lines value:', order.lines);
      console.error('[ORDERS] Lines type:', typeof order.lines);
      lines = [];
    }
    
    // CRITICAL: Return unified response - lines is always an array, nothing else
    // Frontend expects: { ...order, lines: [...] }
    const response = {
      ...order,
      lines: Array.isArray(lines) ? lines : []  // CRITICAL: Always return lines as array, never null/undefined/object
    };
    
    console.log(`[ORDERS] Order ${id} response: lines=${response.lines.length} items`);
    
    res.json(response);
  } catch (e) { 
    console.error('[ORDERS] Error getting order:', e);
    res.json(null); 
  }
}
app.get("/orders/:id", authenticateToken, authorize("sales","view"), handleGetOrder);
app.get("/api/orders/:id", authenticateToken, authorize("sales","view"), handleGetOrder);

// Helper function to calculate totals from order lines
function calculateOrderTotals(lines) {
  const itemsOnly = Array.isArray(lines) ? lines.filter(it => it && it.type === 'item') : [];
  const meta = Array.isArray(lines) ? lines.find(it => it && it.type === 'meta') : null;
  
  // Calculate subtotal and discount from items
  let subtotal = 0;
  let discount_amount = 0;
  
  for (const item of itemsOnly) {
    const qty = Number(item.quantity || item.qty || 0);
    const price = Number(item.price || 0);
    const discount = Number(item.discount || 0);
    subtotal += qty * price;
    discount_amount += discount;
  }
  
  // Apply global discount if provided in meta
  const discountPct = meta ? Number(meta.discountPct || meta.discount_pct || 0) : 0;
  if (discountPct > 0) {
    const globalDiscount = subtotal * (discountPct / 100);
    discount_amount += globalDiscount;
  }
  
  // Calculate tax and total
  const taxPct = meta ? Number(meta.taxPct || meta.tax_pct || 15) : 15;
  const tax_amount = ((subtotal - discount_amount) * taxPct) / 100;
  const total_amount = subtotal - discount_amount + tax_amount;
  
  // Extract customer info from meta or first item
  const customer_name = meta ? (meta.customer_name || meta.customerName || '') : (lines[0]?.customer_name || '');
  const customer_phone = meta ? (meta.customer_phone || meta.customerPhone || '') : (lines[0]?.customer_phone || '');
  const customerid = meta ? (meta.customerId || meta.customer_id || null) : (lines[0]?.customerId || null);
  
  return {
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    customer_name,
    customer_phone,
    customerid
  };
}

async function handleCreateOrder(req, res) {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const table_code = String(b.table || b.table_code || '');
    const lines = Array.isArray(b.lines) ? b.lines : [];
    
    // Calculate totals from lines
    const totals = calculateOrderTotals(lines);
    
    // Insert order with calculated totals
    const { rows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid) 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid`,
      [branch, table_code, JSON.stringify(lines), 'DRAFT', totals.subtotal, totals.discount_amount, totals.tax_amount, totals.total_amount, totals.customer_name, totals.customer_phone, totals.customerid]
    );
    
    const order = rows && rows[0];
    
    // Parse lines back for response
    let parsedLines = [];
    if (order && order.lines) {
      if (Array.isArray(order.lines)) {
        parsedLines = order.lines;
      } else if (typeof order.lines === 'string') {
        try { parsedLines = JSON.parse(order.lines); } catch { parsedLines = lines; }
      }
    } else {
      parsedLines = lines;
    }
    
    res.json({
      ...order,
      lines: parsedLines,
      items: parsedLines.filter(l => l && l.type === 'item')
    });
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
    // Handle lines - convert to JSON string with jsonb cast if provided
    let linesJson = null;
    let parsedLines = [];
    
    if (b.lines !== undefined) {
      if (Array.isArray(b.lines)) {
        linesJson = JSON.stringify(b.lines);
        parsedLines = b.lines;
      } else if (b.lines) {
        linesJson = typeof b.lines === 'string' ? b.lines : JSON.stringify(b.lines);
        try { parsedLines = JSON.parse(linesJson); } catch { parsedLines = []; }
      }
    }
    
    // If lines are provided, calculate totals
    let totals = null;
    if (parsedLines.length > 0) {
      totals = calculateOrderTotals(parsedLines);
    }
    
    // Build UPDATE query - if totals are calculated, include them
    let updateQuery, updateParams;
    if (totals) {
      updateQuery = `UPDATE orders 
                     SET branch=COALESCE($1,branch), 
                         table_code=COALESCE($2,table_code), 
                         lines=COALESCE($3::jsonb,lines), 
                         status=COALESCE($4,status),
                         subtotal=$5,
                         discount_amount=$6,
                         tax_amount=$7,
                         total_amount=$8,
                         customer_name=COALESCE($9,customer_name),
                         customer_phone=COALESCE($10,customer_phone),
                         customerid=COALESCE($11,customerid),
                         updated_at=NOW() 
                     WHERE id=$12 
                     RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid`;
      updateParams = [b.branch||null, (b.table||b.table_code||null), linesJson, b.status||null, 
                      totals.subtotal, totals.discount_amount, totals.tax_amount, totals.total_amount,
                      totals.customer_name, totals.customer_phone, totals.customerid, id];
    } else {
      updateQuery = `UPDATE orders 
                     SET branch=COALESCE($1,branch), 
                         table_code=COALESCE($2,table_code), 
                         lines=COALESCE($3::jsonb,lines), 
                         status=COALESCE($4,status), 
                         updated_at=NOW() 
                     WHERE id=$5 
                     RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid`;
      updateParams = [b.branch||null, (b.table||b.table_code||null), linesJson, b.status||null, id];
    }
    
    const { rows } = await pool.query(updateQuery, updateParams);
    const order = rows && rows[0];
    
    // Parse lines back for response
    if (order && order.lines && parsedLines.length === 0) {
      if (Array.isArray(order.lines)) {
        parsedLines = order.lines;
      } else if (typeof order.lines === 'string') {
        try { parsedLines = JSON.parse(order.lines); } catch { parsedLines = []; }
      }
    }
    
    res.json({
      ...order,
      lines: parsedLines,
      items: parsedLines.filter(l => l && l.type === 'item')
    });
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
    let branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    
    // CRITICAL: Normalize branch name to handle variations (palace_india -> place_india)
    const normalizeBranch = (b) => {
      const s = String(b || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (s === 'palace_india' || s === 'palce_india') return 'place_india';
      return s;
    };
    
    const normalizedBranch = normalizeBranch(branch);
    const key = `pos_tables_layout_${normalizedBranch}`;
    
    // Try normalized branch first, then try original branch name
    let { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    
    // If not found with normalized name, try original branch name
    if (!rows || !rows[0] || !rows[0].value) {
      const originalKey = `pos_tables_layout_${branch}`;
      const result = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [originalKey]);
      rows = result.rows;
    }
    
    const v = rows && rows[0] ? rows[0].value : null;
    const out = v && (v.rows || v.sections) ? v : { rows: [] };
    res.json(out);
  } catch (e) { 
    console.error('[POS] tables-layout get error:', e);
    res.json({ rows: [] }); 
  }
}
app.get("/pos/tables-layout", authenticateToken, handleGetTablesLayout);
app.get("/api/pos/tables-layout", authenticateToken, handleGetTablesLayout);

async function handlePutTablesLayout(req, res) {
  try {
    let branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    
    // CRITICAL: Normalize branch name to handle variations (palace_india -> place_india)
    const normalizeBranch = (b) => {
      const s = String(b || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (s === 'palace_india' || s === 'palce_india') return 'place_india';
      return s;
    };
    
    const normalizedBranch = normalizeBranch(branch);
    const key = `pos_tables_layout_${normalizedBranch}`;
    const value = req.body || {};
    
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) { 
    console.error('[POS] tables-layout save error:', e);
    res.status(500).json({ error: "server_error" }); 
  }
}
app.put("/pos/tables-layout", authenticateToken, authorize("sales","edit"), handlePutTablesLayout);
app.put("/api/pos/tables-layout", authenticateToken, authorize("sales","edit"), handlePutTablesLayout);

async function handleGetTableState(req, res) {
  try {
    // CRITICAL: Guards - return empty array if branch is missing
    let branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    if (!branch || String(branch).trim() === '') {
      return res.json({ busy: [] });
    }
    
    // CRITICAL: Normalize branch name to handle variations (palace_india -> place_india)
    const normalizeBranch = (b) => {
      const s = String(b || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (s === 'palace_india' || s === 'palce_india') return 'place_india';
      return s;
    };
    
    const normalizedBranch = normalizeBranch(branch);
    
    // Query with both original and normalized branch names to handle all cases
    const { rows } = await pool.query(
      `SELECT table_code FROM orders 
       WHERE (branch = $1 OR branch = $2) 
       AND status = $3`,
      [branch, normalizedBranch, 'DRAFT']
    );
    
    // CRITICAL: Guards - ensure rows is array
    if (!Array.isArray(rows)) {
      return res.json({ busy: [] });
    }
    
    const busy = (rows || []).map(r => r?.table_code).filter(Boolean);
    res.json({ busy: Array.isArray(busy) ? busy : [] });
  } catch (e) {
    console.error('[POS] table-state error:', e);
    res.json({ busy: [] });
  }
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
// Legacy /pos/saveDraft endpoint - delegate to handleSaveDraft for consistency
app.post("/pos/saveDraft", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleSaveDraft);
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
    const parentAccountNumber = partnerType === 'supplier' ? '2111' : '1141'; // Suppliers: 2111 (موردون), Customers: 1141 (عملاء)
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
// Helper function to get next entry number (reuses deleted numbers)
async function getNextEntryNumber() {
  try {
    // Get all used entry numbers, sorted
    const { rows: usedNumbers } = await pool.query(
      'SELECT entry_number FROM journal_entries ORDER BY entry_number ASC'
    );
    
    const usedSet = new Set((usedNumbers || []).map(r => Number(r.entry_number || 0)));
    
    // Find first gap (deleted number) or use next sequential number
    let nextNumber = 1;
    for (const num of usedSet) {
      if (num === nextNumber) {
        nextNumber++;
      } else if (num > nextNumber) {
        // Found a gap - reuse it
        return nextNumber;
      }
    }
    
    // No gaps found, use next sequential number
    return nextNumber;
  } catch (e) {
    console.error('[ACCOUNTING] Error getting next entry number:', e);
    // Fallback: use max + 1
    try {
      const { rows: lastEntry } = await pool.query('SELECT entry_number FROM journal_entries ORDER BY entry_number DESC LIMIT 1');
      return lastEntry && lastEntry[0] ? Number(lastEntry[0].entry_number || 0) + 1 : 1;
    } catch (e2) {
      return 1;
    }
  }
}

// Helper function to get next invoice number (reuses deleted numbers)
async function getNextInvoiceNumber() {
  try {
    // Get all used invoice numbers (numeric only), sorted
    const { rows: usedNumbers } = await pool.query(
      `SELECT number FROM invoices 
       WHERE number IS NOT NULL 
       AND number ~ '^[0-9]+$'
       ORDER BY number::integer ASC`
    );
    
    const usedSet = new Set((usedNumbers || []).map(r => Number(r.number || 0)));
    
    // Find first gap (deleted number) or use next sequential number
    let nextNumber = 1;
    for (const num of usedSet) {
      if (num === nextNumber) {
        nextNumber++;
      } else if (num > nextNumber) {
        // Found a gap - reuse it
        return String(nextNumber);
      }
    }
    
    // No gaps found, use next sequential number
    return String(nextNumber);
  } catch (e) {
    console.error('[ACCOUNTING] Error getting next invoice number:', e);
    // Fallback: use max + 1
    try {
      const { rows: lastInvoice } = await pool.query(
        `SELECT number FROM invoices 
         WHERE number IS NOT NULL 
         AND number ~ '^[0-9]+$'
         ORDER BY number::integer DESC LIMIT 1`
      );
      return lastInvoice && lastInvoice[0] ? String(Number(lastInvoice[0].number || 0) + 1) : '1';
    } catch (e2) {
      return '1';
    }
  }
}

async function createInvoiceJournalEntry(invoiceId, customerId, subtotal, discount, tax, total, paymentMethod, branch) {
  try {
    // Get next entry number (reuses deleted numbers)
    const entryNumber = await getNextEntryNumber();

    const postings = [];
    
    // Determine sales account based on branch and payment method
    // Default: Cash sales - China Town (4111)
    let salesAccountNumber = '4111';
    if (branch) {
      const branchLower = String(branch).toLowerCase();
      if (branchLower.includes('place_india') || branchLower.includes('palace_india')) {
        salesAccountNumber = paymentMethod && String(paymentMethod).toLowerCase() === 'credit' ? '4122' : '4121';
      } else {
        salesAccountNumber = paymentMethod && String(paymentMethod).toLowerCase() === 'credit' ? '4112' : '4111';
      }
    }

    // Get customer account (if credit sale)
    if (customerId && paymentMethod && String(paymentMethod).toLowerCase() === 'credit') {
      const customerAccountId = await getOrCreatePartnerAccount(customerId, 'customer');
      if (customerAccountId) {
        // Debit: Customer Receivable (حساب فرعي تحت 1141)
        postings.push({ account_id: customerAccountId, debit: total, credit: 0 });
      }
    } else {
      // Cash sale - use main cash account (1111 - صندوق رئيسي)
      const cashAccountId = await getAccountIdByNumber('1111');
      if (cashAccountId) {
        postings.push({ account_id: cashAccountId, debit: total, credit: 0 });
      }
    }

    // Credit: Sales Revenue (حسب الفرع وطريقة الدفع)
    const salesAccountId = await getAccountIdByNumber(salesAccountNumber);
    if (salesAccountId) {
      postings.push({ account_id: salesAccountId, debit: 0, credit: subtotal - discount });
    }

    // Credit: VAT Output (2141) if tax > 0
    if (tax > 0) {
      const vatAccountId = await getAccountIdByNumber('2141');
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

    // Extract period from date (YYYY-MM format)
    const entryDate = new Date();
    const period = entryDate.toISOString().slice(0, 7); // YYYY-MM
    
    // Create journal entry with period
    // CRITICAL FIX: Set status='posted' when creating journal entry
    const { rows: entryRows } = await pool.query(
      'INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [entryNumber, `فاتورة مبيعات #${invoiceId}`, entryDate, period, 'invoice', invoiceId, 'posted', branch || 'china_town']
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    
    // CRITICAL: Log received body for debugging
    console.log('[BACKEND] /pos/issueInvoice received body:', JSON.stringify(b, null, 2));
    console.log('[BACKEND] /pos/issueInvoice order_id type:', typeof b.order_id, 'value:', b.order_id);
    
    // CRITICAL: order_id is REQUIRED for POS invoice issuing
    // Extract order_id explicitly - it MUST be provided
    // Force conversion to number (handle both string and number)
    const order_id = b.order_id ? (typeof b.order_id === 'number' ? b.order_id : Number(b.order_id)) : null;
    
    if (!order_id) {
      console.error('[ISSUE FAILED] Missing order_id in request body');
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: "missing_order_id", 
        details: "order_id is required to issue invoice from order" 
      });
    }
    
    console.log('[ISSUE DEBUG] order_id:', order_id);
    console.log('[ISSUE DEBUG] b.lines type:', typeof b.lines, 'isArray:', Array.isArray(b.lines));
    
    const number = b.number || null;
    const date = b.date || new Date();
    const customer_id = b.customer_id || null;
    const subtotal = Number(b.subtotal||0);
    const discount_pct = Number(b.discount_pct||0);
    const discount_amount = Number(b.discount_amount||0);
    const tax_pct = Number(b.tax_pct||0);
    const tax_amount = Number(b.tax_amount||0);
    const total = Number(b.total||0);
    const payment_method = b.payment_method || null;
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const status = String(b.status||'posted');
    
    // Variable to store items from order (if order_id provided)
    let orderItems = [];
    // CRITICAL: Initialize lines variable - use b.lines as fallback if order_id not provided
    let lines = Array.isArray(b.lines) ? b.lines : [];
    
    // If order_id provided, validate and lock order (DRAFT → ISSUED flow)
    if (order_id) {
      // Lock order and check status - CRITICAL: Must be DRAFT
      const { rows: orderRows } = await client.query(
        'SELECT id, status, invoice_id FROM orders WHERE id=$1 FOR UPDATE',
        [order_id]
      );
      const order = orderRows && orderRows[0];
      
      // CRITICAL: Log validation state for debugging
      const validationState = {
        orderId: order_id,
        orderExists: !!order,
        status: order?.status || null,
        hasInvoiceId: !!order?.invoice_id,
        invoiceId: order?.invoice_id || null
      };
      
      if (!order) {
        console.error('[ISSUE FAILED] Order not found:', validationState);
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "not_found", details: `Order ${order_id} not found` });
      }
      
      // CRITICAL: Only allow issuing from DRAFT status
      if (String(order.status||'').toUpperCase() !== 'DRAFT') {
        console.error('[ISSUE FAILED] Invalid order status:', validationState);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "invalid_state", 
          details: `Order status must be DRAFT, got: ${order.status}` 
        });
      }
      
      // CRITICAL: Prevent double-issuing
      if (order.invoice_id) {
        console.error('[ISSUE FAILED] Order already issued:', validationState);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "already_issued", 
          details: `Order ${order_id} already has invoice ${order.invoice_id}` 
        });
      }
      
      // CRITICAL: Load order and extract items - THE ONLY SOURCE OF TRUTH
      const { rows: orderFullRows } = await client.query(
        'SELECT lines FROM orders WHERE id=$1',
        [order_id]
      );
      const orderFull = orderFullRows && orderFullRows[0];
      let orderLines = [];
      try {
        if (Array.isArray(orderFull?.lines)) {
          orderLines = orderFull.lines;
        } else if (typeof orderFull?.lines === 'string') {
          orderLines = JSON.parse(orderFull.lines || '[]');
        }
      } catch (e) {
        console.error('[ISSUE] Failed to parse order.lines:', e);
      }
      
      // CRITICAL: Extract items from order.lines - THE ONLY SOURCE OF TRUTH
      // Filter by product_id/item_id and qty > 0 (more flexible than type='item')
      orderItems = Array.isArray(orderLines)
        ? orderLines.filter(l =>
            l &&
            (l.product_id || l.item_id || l.id) &&
            Number(l.qty ?? l.quantity ?? 1) > 0
          )
        : [];
      
      // CRITICAL: Log order.items for debugging
      console.log('[ISSUE INVOICE] order.lines =', orderLines?.length || 0);
      console.log('[ISSUE INVOICE] order.items (extracted) =', orderItems?.length || 0);
      console.log('[ISSUE INVOICE] orderItems sample:', orderItems.slice(0, 2));
      
      // CRITICAL: Validate orderItems - THE ONLY SOURCE, no reliance on req.body.lines
      if (orderItems.length === 0) {
        console.error('[ISSUE FAILED] Empty order:', { 
          ...validationState, 
          itemsCount: orderItems.length, 
          orderLinesCount: orderLines.length,
          orderLinesPreview: orderLines.slice(0, 3)
        });
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "empty_lines", 
          details: "Order has no items",
          debug: {
            orderId: order_id,
            orderLines: orderLines?.length || 0,
            extractedItems: orderItems.length
          }
        });
      }
      
      // Log successful validation
      console.log('[ISSUE VALIDATION] Order validated successfully:', { ...validationState, itemsCount: orderItems.length });
      console.log('[ISSUE INVOICE FINAL]', {
        orderId: order_id,
        orderLines: orderLines?.length || 0,
        extracted: orderItems.length
      });
      
      // CRITICAL: Map orderItems to invoice lines - NO CONDITIONAL, ALWAYS USE orderItems
      // Don't rely on req.body.lines - orderItems is THE ONLY SOURCE
      lines = orderItems.map(item => ({
        type: 'item',
        product_id: item.product_id ?? item.item_id ?? item.id ?? null,
        name: String(item.name || ''),
        name_en: String(item.name_en || ''), // Preserve bilingual name
        qty: Number(item.qty ?? item.quantity ?? 0),
        price: Number(item.price ?? item.unit_price ?? 0),
        discount: Number(item.discount ?? 0)
      }));
      console.log('[ISSUE] Using order items for invoice:', lines.length, 'items');
    }
    
    // Insert invoice
    // CRITICAL: Normalize and clean lines array - handle double stringification
    let linesArray = Array.isArray(lines) ? lines : [];
    
    // تطهير كل عناصر الـ array قبل الإدراج - CRITICAL: Normalize all values to correct types
    linesArray = linesArray
      .map(item => {
        // تحويل أي string JSON إلى object
        if (typeof item === 'string') {
          try {
            const parsed = JSON.parse(item);
            // Re-parse if still string (double stringification)
            if (typeof parsed === 'string') {
              try {
                return JSON.parse(parsed);
              } catch {
                return null;
              }
            }
            return parsed;
          } catch (err) {
            console.error('[ISSUE DEBUG] Invalid JSON string:', item.substring(0, 200));
            return null;
          }
        }
        // تنظيف object - CRITICAL: Ensure all numeric fields are numbers, not strings
        if (typeof item === 'object' && item !== null) {
          const clean = {};
          for (const [key, value] of Object.entries(item)) {
            // Skip undefined and functions
            if (value === undefined || typeof value === 'function') {
              continue;
            }
            // Normalize numeric fields to actual numbers
            if (key === 'qty' || key === 'quantity' || key === 'price' || key === 'discount' || key === 'amount') {
              const numValue = Number(value);
              clean[key] = isNaN(numValue) ? 0 : numValue;
            } else if (key === 'product_id') {
              const numValue = Number(value);
              clean[key] = isNaN(numValue) ? null : numValue;
            } else if (key === 'type' || key === 'name' || key === 'name_en') {
              // String fields - ensure they're strings
              clean[key] = String(value || '');
            } else {
              // Other fields - copy as-is if they're primitive types
              if (value !== null && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
                clean[key] = value;
              }
            }
          }
          return clean;
        }
        return null;
      })
      .filter(Boolean)
        .filter(item => {
        // CRITICAL: Filter only sale items - must have type='item' AND (product_id OR name)
        // Reject meta, tax, discount, or any non-sale items
        if (!item || typeof item !== 'object') return false;
        if (item.type && String(item.type).trim() !== 'item') return false; // Reject meta/tax/discount
        const hasProductId = item.product_id || item.item_id || item.id;
        const hasQty = (item.qty !== undefined && item.qty !== null) || (item.quantity !== undefined && item.quantity !== null);
        const hasName = item.name && String(item.name).trim().length > 0;
        // Must have qty AND (product_id OR name)
        return hasQty && (hasProductId || hasName);
      }); // فلترة - فقط عناصر البيع الفعلية (type='item' مع product_id)
    
    // Fallback: use items from order if lines is empty
    if (!linesArray.length && order_id && orderItems && orderItems.length > 0) {
      linesArray = orderItems
        .map(it => {
          // CRITICAL: Normalize all numeric values - ensure they're actual numbers, not strings
          const qty = Number(it.qty || it.quantity || 0);
          const price = Number(it.price || 0);
          const discount = Number(it.discount || 0);
          const productId = it.product_id ? Number(it.product_id) : null;
          
          return {
            type: 'item',
            product_id: isNaN(productId) ? null : productId,
            name: String(it.name || ''),
            name_en: String(it.name_en || ''), // Preserve bilingual name
            qty: isNaN(qty) ? 0 : qty,
            price: isNaN(price) ? 0 : price,
            discount: isNaN(discount) ? 0 : discount
          };
        })
        .filter(item => item.qty > 0); // فلترة العناصر التي لها كمية صفر
    }
    
    // CRITICAL: If still empty and order_id exists, try to load from order directly
    if (!linesArray.length && order_id) {
      try {
        const { rows: orderCheckRows } = await client.query('SELECT lines FROM orders WHERE id = $1', [order_id]);
        const orderCheck = orderCheckRows && orderCheckRows[0];
        if (orderCheck) {
          let orderCheckLines = [];
          if (Array.isArray(orderCheck.lines)) {
            orderCheckLines = orderCheck.lines;
          } else if (typeof orderCheck.lines === 'string') {
            try { orderCheckLines = JSON.parse(orderCheck.lines || '[]'); } catch {}
          }
          // CRITICAL: Filter only sale items (type='item' with product_id), not meta/tax/discount
          const orderCheckItems = Array.isArray(orderCheckLines) 
            ? orderCheckLines.filter(x => x && x.type === 'item' && (x.product_id || x.item_id || x.id))
            : [];
          if (orderCheckItems.length > 0) {
            linesArray = orderCheckItems.map(it => ({
              type: 'item',
              product_id: it.product_id || it.item_id || it.id ? Number(it.product_id || it.item_id || it.id) : null,
              name: String(it.name || ''),
              qty: Number(it.qty || it.quantity || 0),
              price: Number(it.price || 0),
              discount: Number(it.discount || 0)
            })).filter(item => item.qty > 0 && (item.product_id || item.name));
          }
        }
      } catch (e) {
        console.warn('[ISSUE] Failed to load lines from order:', e);
      }
    }
    
    // تحقق نهائي - CRITICAL: Do not allow empty lines for issued invoices
    if (!linesArray.length) {
      console.error('[ISSUE FAILED] Empty lines array after normalization', { 
        originalLines: lines, 
        linesType: typeof lines, 
        linesIsArray: Array.isArray(lines),
        orderItemsLength: orderItems?.length || 0,
        order_id: order_id,
        status: status
      });
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "empty_lines", details: "Invoice must have at least one line item. Make sure order has items." });
    }
    
    // التحقق النهائي قبل أي INSERT
    if (!linesArray.every(item => typeof item === 'object' && item !== null)) {
      console.error('[ISSUE FAILED] linesArray contains invalid elements:', linesArray);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_lines", details: "Lines array contains invalid elements" });
    }
    
    // CRITICAL: Final validation - ensure all values are properly typed
    linesArray = linesArray.map(item => {
      const clean = {
        type: String(item.type || 'item'),
        name: String(item.name || ''),
        qty: Number(item.qty || item.quantity || 0),
        price: Number(item.price || 0),
        discount: Number(item.discount || 0)
      };
      if (item.product_id != null) {
        clean.product_id = Number(item.product_id);
      }
      return clean;
    });
    
    // طباعة القيمة الفعلية قبل INSERT
    console.log('[ISSUE DEBUG] linesArray normalized:', JSON.stringify(linesArray, null, 2).substring(0, 1000));
    console.log('[ISSUE DEBUG] linesArray types:', linesArray.map(l => ({ type: typeof l, qtyType: typeof l.qty, priceType: typeof l.price })));
    
    // CRITICAL: Validate all numeric values are actual numbers (not NaN)
    const invalidItems = linesArray.filter(item => 
      isNaN(item.qty) || isNaN(item.price) || isNaN(item.discount)
    );
    if (invalidItems.length > 0) {
      console.error('[ISSUE FAILED] Invalid numeric values in linesArray:', invalidItems);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_values", details: "Lines contain invalid numeric values" });
    }
    
    // CRITICAL: Pass linesArray directly as object/array (same as supplier_invoices)
    // The pg library will automatically convert JavaScript objects/arrays to JSONB
    // This is safer than manual stringification and avoids escape issues
    
    // Validate JSON structure one more time
    try {
      JSON.stringify(linesArray);
    } catch (err) {
      console.error('[ISSUE FAILED] linesArray is not JSON-serializable:', err);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_json", details: "Lines array cannot be serialized to JSON" });
    }
    
    // Log final structure
    console.log('[ISSUE DEBUG] linesArray final:', JSON.stringify(linesArray, null, 2).substring(0, 500));
    console.log('[ISSUE DEBUG] linesArray count:', linesArray.length);
    console.log('[ISSUE DEBUG] linesArray sample:', linesArray[0] || 'N/A');
    
    // CRITICAL: EXACT same pattern as POST /invoices (line 4231-4232)
    // POST /invoices passes lines (object/array) directly WITHOUT stringify and WITHOUT cast
    // The pg library will automatically convert JavaScript objects/arrays to JSONB
    // CRITICAL: Inside transaction with client.query, must use stringified JSON (not array directly)
    // Test results proved: direct array FAILS, stringified JSON PASSES (with or without ::jsonb cast)
    console.log('[ISSUE DEBUG] linesArray final:', JSON.stringify(linesArray, null, 2).substring(0, 500));
    console.log('[ISSUE DEBUG] linesArray count:', linesArray.length);
    
    // CRITICAL: Stringify for client.query inside transaction
    const linesJson = JSON.stringify(linesArray);
    console.log('[ISSUE DEBUG] linesJson length:', linesJson.length);
    console.log('[ISSUE DEBUG] linesJson preview:', linesJson.substring(0, 300));
    
    // CRITICAL: Use stringified JSON WITHOUT ::jsonb cast (Test 2 pattern that PASSED)
    // Test 2: stringified JSON WITHOUT cast PASSED
    // Test 3: stringified JSON WITH cast PASSED
    // But Test 2 is simpler, so use it
    // PostgreSQL will automatically convert string to JSONB based on column type
    const { rows } = await client.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, status, total, branch',
      [number, date, customer_id, linesJson, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch]
    );
    
    console.log('[ISSUE DEBUG] Invoice inserted successfully', { invoiceId: rows[0]?.id, linesCount: linesArray.length });
    
    const invoice = rows && rows[0];
    if (!invoice) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "server_error", details: "Failed to create invoice" });
    }

    // Update order status to ISSUED and link invoice (if order_id provided)
    if (order_id) {
      await client.query(
        'UPDATE orders SET status=$1, invoice_id=$2 WHERE id=$3',
        ['ISSUED', invoice.id, order_id]
      );
      console.log(`[POS] Issue invoice: Order ${order_id} → ISSUED, Invoice ${invoice.id}`);
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

    await client.query('COMMIT');
    res.json(invoice);
  } catch (e) {
    await client.query('ROLLBACK');
    const errorMsg = e?.message || String(e || 'unknown');
    console.error('[POS] issueInvoice error:', errorMsg);
    console.error('[POS] issueInvoice error stack:', e?.stack);
    console.error('[POS] issueInvoice error code:', e?.code);
    console.error('[POS] issueInvoice error detail:', e?.detail);
    // Log lines state if error is about json
    if (errorMsg.includes('json') || errorMsg.includes('JSON')) {
      console.error('[POS] issueInvoice lines debug:', {
        bLinesType: typeof (req.body?.lines || 'N/A'),
        bLinesIsArray: Array.isArray(req.body?.lines),
        linesType: typeof lines,
        linesIsArray: Array.isArray(lines),
        linesLength: Array.isArray(lines) ? lines.length : 'N/A',
        linesArrayExists: typeof linesArray !== 'undefined',
        linesArrayLength: Array.isArray(linesArray) ? linesArray.length : 'N/A',
        linesJsonExists: typeof linesJson !== 'undefined',
        linesJsonType: typeof linesJson,
        linesJsonLength: typeof linesJson === 'string' ? linesJson.length : 'N/A',
        linesJsonPreview: typeof linesJson === 'string' ? linesJson.substring(0, 500) : 'N/A',
        orderItemsLength: orderItems?.length || 0
      });
      // Try to log what was actually sent to the query
      if (typeof linesJson !== 'undefined') {
        try {
          const parsed = JSON.parse(linesJson);
          console.error('[POS] issueInvoice linesJson is valid JSON:', typeof parsed, Array.isArray(parsed));
        } catch (parseErr) {
          console.error('[POS] issueInvoice linesJson is NOT valid JSON:', parseErr.message);
        }
      }
    }
    res.status(500).json({ error: "server_error", details: errorMsg });
  } finally {
    client.release();
  }
}
app.post("/pos/issueInvoice", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), handleIssueInvoice);
app.post("/api/pos/issueInvoice", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), handleIssueInvoice);

// GET /api/journal/account/:id - Get journal postings for a specific account
app.get("/journal/account/:id", authenticateToken, authorize("journal","view"), async (req, res) => {
  try {
    const accountId = Number(req.params.id || 0);
    const { page = 1, pageSize = 20, from, to } = req.query || {};
    const limit = Math.min(Number(pageSize) || 20, 500);
    const offset = (Number(page) || 1 - 1) * limit;
    
    let query = `
      SELECT jp.id, jp.journal_entry_id, jp.account_id, jp.debit, jp.credit,
             je.entry_number, je.description, je.date, je.status,
             a.account_number, a.name as account_name
      FROM journal_postings jp
      JOIN journal_entries je ON je.id = jp.journal_entry_id
      LEFT JOIN accounts a ON a.id = jp.account_id
      WHERE jp.account_id = $1
    `;
    const params = [accountId];
    let paramIndex = 2;
    
    if (from) {
      query += ` AND je.date >= $${paramIndex++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND je.date <= $${paramIndex++}`;
      params.push(to);
    }
    
    query += ` ORDER BY je.date DESC, je.entry_number DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      id: row.id,
      journal_entry_id: row.journal_entry_id,
      account_id: row.account_id,
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      entry_number: row.entry_number,
      description: row.description,
      date: row.date,
      status: row.status,
      account_number: row.account_number,
      account_name: row.account_name
    }));
    
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('[JOURNAL] Error getting account journal:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/journal/account/:id", authenticateToken, authorize("journal","view"), async (req, res) => {
  try {
    const accountId = Number(req.params.id || 0);
    const { page = 1, pageSize = 20, from, to } = req.query || {};
    const limit = Math.min(Number(pageSize) || 20, 500);
    const offset = (Number(page) || 1 - 1) * limit;
    
    let query = `
      SELECT jp.id, jp.journal_entry_id, jp.account_id, jp.debit, jp.credit,
             je.entry_number, je.description, je.date, je.status,
             a.account_number, a.name as account_name
      FROM journal_postings jp
      JOIN journal_entries je ON je.id = jp.journal_entry_id
      LEFT JOIN accounts a ON a.id = jp.account_id
      WHERE jp.account_id = $1
    `;
    const params = [accountId];
    let paramIndex = 2;
    
    if (from) {
      query += ` AND je.date >= $${paramIndex++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND je.date <= $${paramIndex++}`;
      params.push(to);
    }
    
    query += ` ORDER BY je.date DESC, je.entry_number DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      id: row.id,
      journal_entry_id: row.journal_entry_id,
      account_id: row.account_id,
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      entry_number: row.entry_number,
      description: row.description,
      date: row.date,
      status: row.status,
      account_number: row.account_number,
      account_name: row.account_name
    }));
    
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('[JOURNAL] Error getting account journal:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// GET /api/reports/trial-balance - Get trial balance report
app.get("/reports/trial-balance", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    const { from, to, period } = req.query || {};
    
    let query = `
      SELECT 
        a.id as account_id,
        a.account_number,
        a.name as account_name,
        COALESCE(SUM(CASE WHEN je.date < $1 THEN jp.debit - jp.credit ELSE 0 END), 0) as beginning,
        COALESCE(SUM(CASE WHEN je.date >= $1 AND ($2 IS NULL OR je.date <= $2) THEN jp.debit ELSE 0 END), 0) as debit,
        COALESCE(SUM(CASE WHEN je.date >= $1 AND ($2 IS NULL OR je.date <= $2) THEN jp.credit ELSE 0 END), 0) as credit,
        COALESCE(SUM(CASE WHEN $2 IS NULL OR je.date <= $2 THEN jp.debit - jp.credit ELSE 0 END), 0) as ending
      FROM accounts a
      LEFT JOIN journal_postings jp ON jp.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
      WHERE 1=1
    `;
    const params = [from || '1970-01-01', to || null];
    
    query += ` GROUP BY a.id, a.account_number, a.name
               HAVING COALESCE(SUM(jp.debit), 0) + COALESCE(SUM(jp.credit), 0) > 0
               ORDER BY a.account_number`;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      account_id: row.account_id,
      account_number: row.account_number,
      account_name: row.account_name,
      beginning: Number(row.beginning || 0),
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      ending: Number(row.ending || 0)
    }));
    
    const totals = items.reduce((acc, item) => ({
      debit: acc.debit + item.debit,
      credit: acc.credit + item.credit,
      beginning: acc.beginning + item.beginning,
      ending: acc.ending + item.ending
    }), { debit: 0, credit: 0, beginning: 0, ending: 0 });
    
    res.json({ items, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 });
  } catch (e) {
    console.error('[REPORTS] Error getting trial balance:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/reports/trial-balance", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    const { from, to, period } = req.query || {};
    
    // Convert empty strings to null - CRITICAL for PostgreSQL type resolution
    const fromDate = from?.trim() || null;
    const toDate = to?.trim() || null;
    
    // Validate dates if provided
    if (fromDate && isNaN(Date.parse(fromDate))) {
      return res.status(400).json({ error: "invalid_date", details: "Invalid from date format" });
    }
    if (toDate && isNaN(Date.parse(toDate))) {
      return res.status(400).json({ error: "invalid_date", details: "Invalid to date format" });
    }
    
    // Use a very early date as default for beginning balance calculation if fromDate is null
    const effectiveFromDate = fromDate || '1970-01-01';
    
    let query = `
      SELECT 
        a.id as account_id,
        a.account_number,
        a.account_code,
        COALESCE(a.name, a.name_en, '') as account_name,
        COALESCE(a.name_en, a.name, '') as account_name_en,
        a.type as account_type,
        COALESCE(SUM(CASE WHEN je.date < $1::date THEN jp.debit - jp.credit ELSE 0 END), 0) as beginning,
        COALESCE(SUM(CASE WHEN je.date >= $1::date AND ($2::date IS NULL OR je.date <= $2::date) THEN jp.debit ELSE 0 END), 0) as debit,
        COALESCE(SUM(CASE WHEN je.date >= $1::date AND ($2::date IS NULL OR je.date <= $2::date) THEN jp.credit ELSE 0 END), 0) as credit,
        COALESCE(SUM(CASE WHEN $2::date IS NULL OR je.date <= $2::date THEN jp.debit - jp.credit ELSE 0 END), 0) as ending
      FROM accounts a
      LEFT JOIN journal_postings jp ON jp.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
      WHERE 1=1
    `;
    const params = [effectiveFromDate, toDate];
    
    query += ` GROUP BY a.id, a.account_number, a.name
               HAVING COALESCE(SUM(jp.debit), 0) + COALESCE(SUM(jp.credit), 0) > 0
               ORDER BY a.account_number`;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      account_id: row.account_id,
      account_number: row.account_number,
      account_name: row.account_name,
      beginning: Number(row.beginning || 0),
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      ending: Number(row.ending || 0)
    }));
    
    const totals = items.reduce((acc, item) => ({
      debit: acc.debit + item.debit,
      credit: acc.credit + item.credit,
      beginning: acc.beginning + item.beginning,
      ending: acc.ending + item.ending
    }), { debit: 0, credit: 0, beginning: 0, ending: 0 });
    
    res.json({ items, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 });
  } catch (e) {
    console.error('[REPORTS] Error getting trial balance:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// GET /reports/sales-vs-expenses - Get sales vs expenses report (legacy endpoint - redirects to /api version)
app.get("/reports/sales-vs-expenses", authenticateToken, authorize("reports","view"), async (req, res) => {
  // Redirect to /api version which uses journal entries
  return res.redirect(307, `/api/reports/sales-vs-expenses?${new URLSearchParams(req.query).toString()}`);
});
app.get("/api/reports/sales-vs-expenses", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    const { from, to, period, branch } = req.query || {};
    
    // CRITICAL: Use journal entries (posted) instead of invoices/expenses directly
    // Sales revenue account codes: 4111, 4112 (china_town), 4121, 4122 (place_india)
    const salesAccountCodes = ['4111', '4112', '4121', '4122'];
    
    // Get account IDs
    const { rows: salesAccountRows } = await pool.query(
      `SELECT id FROM accounts WHERE account_code = ANY($1) OR account_number = ANY($1)`,
      [salesAccountCodes]
    );
    const salesAccountIds = salesAccountRows.map(r => r.id);
    
    const { rows: expenseAccountRows } = await pool.query(
      `SELECT id FROM accounts WHERE type = 'expense' OR account_code LIKE '5%' OR account_number LIKE '5%'`
    );
    const expenseAccountIds = expenseAccountRows.map(r => r.id);
    
    let salesWhere = [`je.status = 'posted'`, `jp.account_id = ANY($1::int[])`];
    let expensesWhere = [`je.status = 'posted'`, `jp.account_id = ANY($1::int[])`];
    const salesParams = [salesAccountIds];
    const expensesParams = [expenseAccountIds];
    let salesParamIndex = 2;
    let expensesParamIndex = 2;
    
    if (from) {
      salesWhere.push(`je.date >= $${salesParamIndex++}::date`);
      expensesWhere.push(`je.date >= $${expensesParamIndex++}::date`);
      salesParams.push(from);
      expensesParams.push(from);
    }
    if (to) {
      salesWhere.push(`je.date <= $${salesParamIndex++}::date`);
      expensesWhere.push(`je.date <= $${expensesParamIndex++}::date`);
      salesParams.push(to);
      expensesParams.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      salesWhere.push(`je.branch = $${salesParamIndex++}`);
      expensesWhere.push(`je.branch = $${expensesParamIndex++}`);
      salesParams.push(branch);
      expensesParams.push(branch);
    }
    
    // Get sales by date from journal entries (credit side)
    const salesQuery = `
      SELECT DATE(je.date) as date, COALESCE(SUM(jp.credit), 0) as total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${salesWhere.join(' AND ')}
      GROUP BY DATE(je.date)
      ORDER BY DATE(je.date)
    `;
    
    // Get expenses by date from journal entries (debit side)
    const expensesQuery = `
      SELECT DATE(je.date) as date, COALESCE(SUM(jp.debit), 0) as total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${expensesWhere.join(' AND ')}
      GROUP BY DATE(je.date)
      ORDER BY DATE(je.date)
    `;
    
    const [salesResult, expensesResult] = await Promise.all([
      pool.query(salesQuery, salesParams),
      pool.query(expensesQuery, expensesParams)
    ]);
    
    // Combine sales and expenses by date
    const dateMap = new Map();
    
    (salesResult.rows || []).forEach(row => {
      const date = row.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, sales: 0, expenses: 0 });
      }
      dateMap.get(date).sales = Number(row.total || 0);
    });
    
    (expensesResult.rows || []).forEach(row => {
      const date = row.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, sales: 0, expenses: 0 });
      }
      dateMap.get(date).expenses = Number(row.total || 0);
    });
    
    const items = Array.from(dateMap.values()).map(item => ({
      date: item.date,
      sales: item.sales,
      expenses: item.expenses,
      net: item.sales - item.expenses
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const totals = items.reduce((acc, item) => ({
      sales: acc.sales + item.sales,
      expenses: acc.expenses + item.expenses,
      net: acc.net + item.net
    }), { sales: 0, expenses: 0, net: 0 });
    
    res.json({ items, totals });
  } catch (e) {
    console.error('[REPORTS] Error getting sales vs expenses:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// GET /api/reports/sales-by-branch - Get sales by branch report
app.get("/reports/sales-by-branch", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    const { from, to, period, branch } = req.query || {};
    
    let whereConditions = [];
    const params = [];
    let paramIndex = 1;
    
    whereConditions.push(`status = 'paid'`);
    if (from) {
      whereConditions.push(`date >= $${paramIndex++}`);
      params.push(from);
    }
    if (to) {
      whereConditions.push(`date <= $${paramIndex++}`);
      params.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      whereConditions.push(`branch = $${paramIndex++}`);
      params.push(branch);
    }
    
    const query = `
      SELECT 
        branch,
        COUNT(*) as invoice_count,
        COALESCE(SUM(total), 0) as total_sales
      FROM invoices
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY branch
      ORDER BY branch
    `;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      branch: row.branch,
      invoice_count: Number(row.invoice_count || 0),
      total_sales: Number(row.total_sales || 0)
    }));
    
    const totals = items.reduce((acc, item) => ({
      invoice_count: acc.invoice_count + item.invoice_count,
      total_sales: acc.total_sales + item.total_sales
    }), { invoice_count: 0, total_sales: 0 });
    
    res.json({ items, totals });
  } catch (e) {
    console.error('[REPORTS] Error getting sales by branch:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/api/reports/sales-by-branch", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    const { from, to, period, branch } = req.query || {};
    
    // CRITICAL: Use journal entries (posted) instead of invoices directly
    // Sales revenue account codes: 4111, 4112 (china_town), 4121, 4122 (place_india)
    const salesAccountCodes = ['4111', '4112', '4121', '4122'];
    
    let whereConditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Get account IDs for sales accounts
    const { rows: accountRows } = await pool.query(
      `SELECT id, account_code, account_number FROM accounts WHERE account_code = ANY($1) OR account_number = ANY($1)`,
      [salesAccountCodes]
    );
    const salesAccountIds = accountRows.map(r => r.id);
    
    if (salesAccountIds.length === 0) {
      return res.json({ items: [], totals: { invoice_count: 0, total_sales: 0, gross_total: 0, net_total: 0, tax_total: 0, discount_total: 0 } });
    }
    
    // Build query using journal entries (posted only)
    whereConditions.push(`je.status = 'posted'`);
    whereConditions.push(`jp.account_id = ANY($${paramIndex++}::int[])`);
    params.push(salesAccountIds);
    
    if (from) {
      whereConditions.push(`je.date >= $${paramIndex++}::date`);
      params.push(from);
    }
    if (to) {
      whereConditions.push(`je.date <= $${paramIndex++}::date`);
      params.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      whereConditions.push(`je.branch = $${paramIndex++}`);
      params.push(branch);
    }
    
    // Get sales from journal entries - credit side of sales accounts
    const query = `
      SELECT 
        COALESCE(je.branch, 'unknown') as branch,
        COUNT(DISTINCT je.id) as invoice_count,
        COALESCE(SUM(jp.credit), 0) as net_total,
        COALESCE(SUM(jp.credit), 0) as gross_total,
        0 as tax_total,
        0 as discount_total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY je.branch
      ORDER BY je.branch
    `;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      branch: row.branch || 'unknown',
      invoice_count: Number(row.invoice_count || 0),
      gross_total: Number(row.gross_total || 0),
      net_total: Number(row.net_total || 0),
      tax_total: Number(row.tax_total || 0),
      discount_total: Number(row.discount_total || 0),
      total_sales: Number(row.gross_total || 0) // For backward compatibility
    }));
    
    const totals = items.reduce((acc, item) => ({
      invoice_count: acc.invoice_count + item.invoice_count,
      total_sales: acc.total_sales + item.total_sales,
      gross_total: acc.gross_total + (item.gross_total || 0),
      net_total: acc.net_total + (item.net_total || 0),
      tax_total: acc.tax_total + (item.tax_total || 0),
      discount_total: acc.discount_total + (item.discount_total || 0)
    }), { invoice_count: 0, total_sales: 0, gross_total: 0, net_total: 0, tax_total: 0, discount_total: 0 });
    
    res.json({ items, totals });
  } catch (e) {
    console.error('[REPORTS] Error getting sales by branch:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// GET /reports/expenses-by-branch - Get expenses by branch report (legacy endpoint - redirects to /api version)
app.get("/reports/expenses-by-branch", authenticateToken, authorize("reports","view"), async (req, res) => {
  // Redirect to /api version which uses journal entries
  return res.redirect(307, `/api/reports/expenses-by-branch?${new URLSearchParams(req.query).toString()}`);
});
app.get("/api/reports/expenses-by-branch", authenticateToken, authorize("reports","view"), async (req, res) => {
  try {
    const { from, to, period, branch } = req.query || {};
    
    // CRITICAL: Use journal entries (posted) instead of expenses directly
    // Expense account codes typically start with 5xxx
    const expenseAccountCodes = ['5110', '5210', '5220', '5230', '5240', '5250'];
    
    let whereConditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Get account IDs for expense accounts (accounts with type='expense' or codes starting with 5)
    const { rows: accountRows } = await pool.query(
      `SELECT id, account_code, account_number FROM accounts 
       WHERE type = 'expense' OR account_code LIKE '5%' OR account_number LIKE '5%'`
    );
    const expenseAccountIds = accountRows.map(r => r.id);
    
    if (expenseAccountIds.length === 0) {
      return res.json({ items: [], total: 0 });
    }
    
    // Build query using journal entries (posted only)
    whereConditions.push(`je.status = 'posted'`);
    whereConditions.push(`jp.account_id = ANY($${paramIndex++}::int[])`);
    params.push(expenseAccountIds);
    
    if (from) {
      whereConditions.push(`je.date >= $${paramIndex++}::date`);
      params.push(from);
    }
    if (to) {
      whereConditions.push(`je.date <= $${paramIndex++}::date`);
      params.push(to);
    }
    if (branch && branch !== 'كل الفروع') {
      whereConditions.push(`je.branch = $${paramIndex++}`);
      params.push(branch);
    }
    
    // Get expenses from journal entries - debit side of expense accounts
    const query = `
      SELECT 
        COALESCE(je.branch, 'unknown') as branch,
        COUNT(DISTINCT je.id) as expense_count,
        COALESCE(SUM(jp.debit), 0) as total
      FROM journal_entries je
      JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY je.branch
      ORDER BY je.branch
    `;
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      branch: row.branch || 'unknown',
      expense_count: Number(row.expense_count || 0),
      total: Number(row.total || 0)
    }));
    
    const total = items.reduce((acc, item) => acc + (item.total || 0), 0);
    
    const totals = {
      expense_count: items.reduce((acc, item) => acc + (item.expense_count || 0), 0),
      total_expenses: total
    };
    
    res.json({ items, totals, total });
  } catch (e) {
    console.error('[REPORTS] Error getting expenses by branch:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

// POS Save Draft - both paths for compatibility
async function handleSaveDraft(req, res) {
  try {
    console.log('[POS] saveDraft - Request received | userId=', req.user?.id, 'email=', req.user?.email);
    const b = req.body || {};
    
    // Normalize branch - handle variations like 'palace_india' -> 'place_india'
    let branch = b.branch || req.user?.default_branch || 'china_town';
    if (branch) {
      const branchLower = String(branch).toLowerCase().replace(/\s+/g, '_');
      if (branchLower === 'palace_india' || branchLower === 'palce_india') {
        branch = 'place_india';
      } else {
        branch = branchLower;
      }
    }
    
    // Normalize table_code - ensure it's a string (can be number or string)
    const table_code = b.table || b.table_code || b.tableId || null;
    const table_code_normalized = table_code ? String(table_code).trim() : null;
    const order_id = b.order_id ? Number(b.order_id) : null;
    
    // Handle both 'lines' and 'items' - frontend may send either
    // If lines is already in the correct format (with type), use it
    // Otherwise, if items is provided, convert it to the correct format
    let rawLines = Array.isArray(b.lines) ? b.lines : (Array.isArray(b.items) ? b.items : []);
    
    console.log(`[POS] saveDraft - branch=${branch}, table=${table_code_normalized}, order_id=${order_id}, raw_lines_count=${rawLines.length}`);
    console.log(`[POS] saveDraft - Full payload:`, JSON.stringify({
      branch: b.branch,
      table: b.table,
      table_code: b.table_code,
      tableId: b.tableId,
      order_id: b.order_id,
      lines_count: Array.isArray(b.lines) ? b.lines.length : 0,
      items_count: Array.isArray(b.items) ? b.items.length : 0
    }));
    
    // Build lines array in the format expected by frontend:
    // - Each item should have type: 'item'
    // - One meta object with type: 'meta' containing branch, table, customer info, etc.
    const linesArray = [];
    
    // Calculate totals from items
    const itemsOnly = Array.isArray(rawLines) ? rawLines.filter(it => it && it.type !== 'meta') : [];
    let subtotal = 0;
    let totalDiscount = 0;
    
    for (const item of itemsOnly) {
      const qty = Number(item.quantity || item.qty || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);
      subtotal += qty * price;
      totalDiscount += discount;
    }
    
    // Apply global discount if provided
    const globalDiscountPct = Number(b.discountPct || b.discount_pct || 0);
    if (globalDiscountPct > 0) {
      const globalDiscount = subtotal * (globalDiscountPct / 100);
      totalDiscount += globalDiscount;
    }
    
    // Calculate tax and total according to specification:
    // tax_amount = ((subtotal - discount_amount) * taxPct) / 100
    // total_amount = subtotal - discount_amount + tax_amount
    const taxPct = Number(b.taxPct || b.tax_pct || 15);
    const totalTax = ((subtotal - totalDiscount) * taxPct) / 100;
    const totalAmount = subtotal - totalDiscount + totalTax;
    
    // Add meta object with calculated totals
    const meta = {
      type: 'meta',
      branch: branch,
      table: table_code_normalized,
      customer_name: b.customerName || b.customer_name || '',
      customer_phone: b.customerPhone || b.customer_phone || '',
      customerId: b.customerId || null,
      discountPct: Number(b.discountPct || b.discount_pct || 0),
      taxPct: Number(b.taxPct || b.tax_pct || 15),
      paymentMethod: b.paymentMethod || b.payment_method || '',
      payLines: Array.isArray(b.payLines) ? b.payLines : [],
      // Calculated totals
      subtotal: subtotal,
      discount_amount: totalDiscount,
      tax_amount: totalTax,
      total_amount: totalAmount
    };
    linesArray.push(meta);
    
    // Process items - check if they already have type: 'item'
    const items = Array.isArray(rawLines) ? rawLines : [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      
      // If item already has type: 'item', use it as-is
      if (item.type === 'item') {
        linesArray.push(item);
        continue;
      }
      
      // If item has type: 'meta', skip it (we already have meta)
      if (item.type === 'meta') {
        continue;
      }
      
      // Convert plain item to format with type: 'item'
      const convertedItem = {
        type: 'item',
        product_id: item.id || item.product_id || null,
        id: item.id || item.product_id || null,
        name: item.name || '',
        name_en: item.name_en || '', // Preserve bilingual name
        qty: Number(item.quantity || item.qty || 0),
        quantity: Number(item.quantity || item.qty || 0),
        price: Number(item.price || 0),
        discount: Number(item.discount || 0)
      };
      
      // Only add if it has valid product_id or name
      if (convertedItem.product_id || convertedItem.name) {
        linesArray.push(convertedItem);
      }
    }
    
    console.log(`[POS] saveDraft - Converted lines: ${linesArray.length} items (1 meta + ${linesArray.length - 1} items)`);
    if (linesArray.length > 1) {
      const sampleItem = linesArray.find(l => l.type === 'item');
      if (sampleItem) {
        console.log(`[POS] saveDraft - Sample item:`, JSON.stringify(sampleItem).substring(0, 200));
      }
    }
    
    // Validate branch and table_code before insert
    if (!branch || String(branch).trim() === '') {
      console.error('[POS] saveDraft - Invalid branch:', branch);
      return res.status(400).json({ error: "invalid_branch", details: "Branch is required" });
    }
    
    if (!table_code_normalized || table_code_normalized === '') {
      console.error('[POS] saveDraft - Invalid table_code:', table_code);
      return res.status(400).json({ error: "invalid_table", details: "Table is required" });
    }
    
    // For PostgreSQL JSONB, we'll use JSON.stringify
    const linesJson = JSON.stringify(linesArray);
    
    if (order_id) {
      // Update existing order
      console.log(`[POS] saveDraft - Updating order ${order_id}`);
      const { rows } = await pool.query(
        `UPDATE orders 
         SET lines=$1::jsonb, 
             subtotal=$2, 
             discount_amount=$3, 
             tax_amount=$4, 
             total_amount=$5,
             customer_name=$6,
             customer_phone=$7,
             customerid=$8,
             updated_at=NOW() 
         WHERE id=$9 
         RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid`,
        [linesJson, subtotal, totalDiscount, totalTax, totalAmount, 
         meta.customer_name || '', meta.customer_phone || '', meta.customerId || null, order_id]
      );
      const order = rows && rows[0];
      
      if (!order) {
        console.error(`[POS] saveDraft - Order ${order_id} not found`);
        return res.status(404).json({ error: "not_found", details: `Order ${order_id} not found` });
      }
      
      console.log(`[POS] saveDraft - Updated order ${order_id}, lines type:`, typeof order?.lines);
      
      // Parse lines back for response
      let parsedLines = linesArray;
      if (order && order.lines) {
        if (Array.isArray(order.lines)) {
          parsedLines = order.lines;
        } else if (typeof order.lines === 'string') {
          try { 
            const parsed = JSON.parse(order.lines);
            parsedLines = Array.isArray(parsed) ? parsed : linesArray;
          } catch (e) { 
            console.warn('[POS] saveDraft - Failed to parse lines string:', e);
            parsedLines = linesArray; 
          }
        } else if (typeof order.lines === 'object') {
          // PostgreSQL JSONB may return as object - convert to array if possible
          parsedLines = Array.isArray(order.lines) ? order.lines : linesArray;
        }
      }
      
      // CRITICAL: Ensure parsedLines is always an array
      if (!Array.isArray(parsedLines)) {
        console.warn('[POS] saveDraft - parsedLines is not an array, using linesArray');
        parsedLines = linesArray;
      }
      
      console.log(`[POS] saveDraft - SUCCESS - Updated order ${order_id}, returning ${parsedLines.length} lines`);
      
      // Extract calculated totals from meta and items
      const metaData = parsedLines.find(l => l && l.type === 'meta') || {};
      const itemsArray = parsedLines.filter(l => l && l.type === 'item');
      const calculatedTotals = {
        subtotal: metaData.subtotal || 0,
        discount_amount: metaData.discount_amount || 0,
        tax_amount: metaData.tax_amount || 0,
        total_amount: metaData.total_amount || 0
      };
      
      const response = {
        ...order,
        lines: parsedLines,
        items: itemsArray,  // Filtered items (not meta)
        order_id: order.id,
        invoice: null,  // No invoice for draft orders
        // Add calculated totals to top level for easy access
        subtotal: calculatedTotals.subtotal,
        discount_amount: calculatedTotals.discount_amount,
        tax_amount: calculatedTotals.tax_amount,
        total_amount: calculatedTotals.total_amount,
        // Meta fields extracted for compatibility
        customerName: metaData.customer_name || '',
        customerPhone: metaData.customer_phone || '',
        customerId: metaData.customerId || null,
        discountPct: Number(metaData.discountPct || 0),
        taxPct: Number(metaData.taxPct || 15),
        paymentMethod: metaData.paymentMethod || '',
        payLines: Array.isArray(metaData.payLines) ? metaData.payLines : []
      };
      console.log(`[POS] saveDraft - Response includes order_id: ${response.order_id}, invoice: ${response.invoice}, total_amount: ${response.total_amount}, lines: ${response.lines.length}, items: ${response.items.length}`);
      return res.json(response);
    }
    
    // Create new order
    console.log(`[POS] saveDraft - Creating new order for branch=${branch}, table=${table_code_normalized}`);
    
    console.log(`[POS] saveDraft - INSERT VALUES: branch='${branch}', table_code='${table_code_normalized}', status='DRAFT'`);
    
    const { rows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid) 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, customerid, created_at`,
      [branch, table_code_normalized, linesJson, 'DRAFT', subtotal, totalDiscount, totalTax, totalAmount,
       meta.customer_name || '', meta.customer_phone || '', meta.customerId || null]
    );
    const order = rows && rows[0];
    
    if (!order || !order.id) {
      console.error('[POS] saveDraft - Failed to create order - no ID returned');
      console.error('[POS] saveDraft - Rows returned:', rows);
      return res.status(500).json({ error: "create_failed", details: "Failed to create order" });
    }
    
    console.log(`[POS] saveDraft - SUCCESS - Created order ${order.id}, branch='${order.branch}', table_code='${order.table_code}', status='${order.status}'`);
    
    // Parse lines back for response
    let parsedLines = linesArray;
    if (order && order.lines) {
      if (Array.isArray(order.lines)) {
        parsedLines = order.lines;
      } else if (typeof order.lines === 'string') {
        try { 
          const parsed = JSON.parse(order.lines);
          parsedLines = Array.isArray(parsed) ? parsed : linesArray;
        } catch (e) { 
          console.warn('[POS] saveDraft - Failed to parse lines string:', e);
          parsedLines = linesArray; 
        }
      } else if (typeof order.lines === 'object') {
        // PostgreSQL JSONB may return as object - convert to array if possible
        parsedLines = Array.isArray(order.lines) ? order.lines : linesArray;
      }
    }
    
    // CRITICAL: Ensure parsedLines is always an array
    if (!Array.isArray(parsedLines)) {
      console.warn('[POS] saveDraft - parsedLines is not an array, using linesArray');
      parsedLines = linesArray;
    }
    
    console.log(`[POS] saveDraft - Returning ${parsedLines.length} lines for new order ${order.id}`);
    
    // Extract calculated totals from meta and items
    const metaData = parsedLines.find(l => l && l.type === 'meta') || {};
    const itemsArray = parsedLines.filter(l => l && l.type === 'item');
    const calculatedTotals = {
      subtotal: metaData.subtotal || 0,
      discount_amount: metaData.discount_amount || 0,
      tax_amount: metaData.tax_amount || 0,
      total_amount: metaData.total_amount || 0
    };
    
    const response = {
      ...order,
      lines: parsedLines,
      items: itemsArray,  // Filtered items (not meta)
      order_id: order.id,
      invoice: null,  // No invoice for draft orders
      // Add calculated totals to top level for easy access
      subtotal: calculatedTotals.subtotal,
      discount_amount: calculatedTotals.discount_amount,
      tax_amount: calculatedTotals.tax_amount,
      total_amount: calculatedTotals.total_amount,
      // Meta fields extracted for compatibility
      customerName: metaData.customer_name || '',
      customerPhone: metaData.customer_phone || '',
      customerId: metaData.customerId || null,
      discountPct: Number(metaData.discountPct || 0),
      taxPct: Number(metaData.taxPct || 15),
      paymentMethod: metaData.paymentMethod || '',
      payLines: Array.isArray(metaData.payLines) ? metaData.payLines : []
    };
    console.log(`[POS] saveDraft - Response includes order_id: ${response.order_id}, invoice: ${response.invoice}, total_amount: ${response.total_amount}, lines: ${response.lines.length}, items: ${response.items.length}`);
    res.json(response);
  } catch (e) { 
    console.error('[POS] saveDraft error:', e);
    console.error('[POS] saveDraft error message:', e?.message);
    console.error('[POS] saveDraft error stack:', e?.stack);
    console.error('[POS] saveDraft error code:', e?.code);
    console.error('[POS] saveDraft error detail:', e?.detail);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown", code: e?.code, detail: e?.detail }); 
  }
}
app.post("/api/pos/saveDraft", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), handleSaveDraft);
// NOTE: SPA fallback is already handled above (line 71-92)
// These routes are redundant but kept for clarity
// The SPA fallback middleware will catch all non-API routes before they reach here

app.listen(port, () => {
  console.log(`[SERVER] Started on port ${port} | NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] Build path: ${buildPath}`);
  console.log(`[SERVER] JWT_SECRET: ${JWT_SECRET ? 'configured' : 'MISSING'}`);
  console.log(`[SERVER] Database: ${pool ? 'connected' : 'NOT configured'}`);
});
