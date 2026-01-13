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
app.use(express.static(buildPath));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  } catch {}
}
ensureSchema().catch(()=>{});

async function handleLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "invalid_credentials" });
    }
    if (!pool) {
      return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    }
    const { rows } = await pool.query(
      'SELECT id, email, password, role, default_branch, created_at FROM "users" WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = rows && rows[0];
    if (!user) {
      return res.status(404).json({ error: "not_found" });
    }
    const ok = await bcrypt.compare(String(password), String(user.password || ""));
    if (!ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role || "user" }, String(JWT_SECRET), { expiresIn: "12h" });
    let perms = {};
    try { perms = await loadUserPermissionsMap(user.id) } catch {}
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
    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role || "user", default_branch: user.default_branch || null, created_at: user.created_at },
      screens,
      branches
    });
  } catch (e) {
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

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json(req.user);
});
app.get("/auth/me", authenticateToken, (req, res) => {
  res.json(req.user);
});

function requireAdmin(req, res, next){
  const role = String((req.user && req.user.role) || "").toLowerCase();
  if (role !== "admin") return res.status(403).json({ error: "forbidden", required: "admin" });
  next();
}

app.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const { rows } = await pool.query('SELECT id, email, role, is_active, created_at FROM "users" ORDER BY id DESC');
    const items = Array.isArray(rows) ? rows.map(r => ({ id: r.id, email: r.email, role: r.role || "user", is_active: r.is_active !== false, created_at: r.created_at })) : [];
    res.json({ items });
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

function baseScreens(){
  return [
    "clients","suppliers","employees","expenses","products","sales","purchases","reports","accounting","journal"
  ];
}
function defaultPermissions(role){
  const sc = baseScreens();
  const m = {};
  for (const s of sc) {
    m[s] = { _global: { view: true, create: role === "admin", edit: role === "admin", delete: role === "admin", settings: role === "admin" } };
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

app.put("/users/:id/permissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const body = req.body || {};
    let rows = [];
    if (Array.isArray(body)) {
      rows = flattenPermissionsList(body, id);
    } else {
      rows = flattenPermissionsMap(body, id);
    }
    await saveUserPermissions(id, rows);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/roles", authenticateToken, requireAdmin, async (req, res) => {
  res.json({ items: [{ id: 1, name: "Admin" }, { id: 2, name: "User" }] });
});
app.get("/screens", authenticateToken, requireAdmin, async (req, res) => {
  const list = baseScreens().map((s, i) => ({
    id: i + 1,
    code: s,
    name: s,
    has_branches: s === "sales"
  }));
  res.json({ items: list });
});
app.get("/actions", authenticateToken, requireAdmin, async (req, res) => {
  const actions = ["view", "create", "edit", "delete", "settings"].map((code, i) => ({ id: i + 1, code }));
  res.json({ items: actions });
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
    res.json({ items: arr.map((code, idx) => ({ id: idx + 1, code, name: code })) });
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.get("/users/:id/user-permissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { items: screens } = await (async()=>({ items: baseScreens().map((s, i)=>({ id: i+1, code: s, name: s, has_branches: s==='sales' })) }))();
    const { items: actions } = await (async()=>({ items: ["view","create","edit","delete","settings"].map((code,i)=>({ id:i+1, code })) }))();
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

// Authorization guards for critical resources (prefix-level)
app.use("/invoices", authenticateToken, async (req, res, next) => {
  try {
    if (req.method === "GET") {
      return authorize("sales", "view", { branchFrom: r => (r.query.branch || r.query.branch_code || r.query.branchId || null) })(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("sales", "create", { branchFrom: r => (r.body.branch || r.body.branch_code || r.body.branchId || null) })(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("sales", "edit", { branchFrom: r => (r.body.branch || r.body.branch_code || r.body.branchId || null) })(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/drafts", authenticateToken, async (req, res, next) => {
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
  try {
    if (req.method === "GET") {
      return authorize("customers", "view")(req, res, next);
    }
    if (req.method === "POST") {
      return authorize("customers", "create")(req, res, next);
    }
    if (req.method === "PUT") {
      return authorize("customers", "edit")(req, res, next);
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
    if (req.method === "POST" || req.method === "PUT") {
      return authorize("employees", "manage")(req, res, next);
    }
    next();
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/journal", authenticateToken, async (req, res, next) => {
  try {
    return authorize("accounting", "view")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.use("/ledger", authenticateToken, async (req, res, next) => {
  try {
    return authorize("accounting", "view")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.use("/reports", authenticateToken, async (req, res, next) => {
  try {
    return authorize("reports", "view")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/settings", authenticateToken, async (req, res, next) => {
  try {
    return authorize("settings", "manage")(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/partners", authenticateToken, async (req, res, next) => {
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
  try {
    return authorize("reports", "view")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/pos", authenticateToken, async (req, res, next) => {
  try {
    const opts = { branchFrom: r => (r.params?.branch || r.query.branch || r.body?.branch || null) }
    return authorize("sales", "view", opts)(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/accounting-periods", authenticateToken, async (req, res, next) => {
  try {
    if (req.method === "GET") return authorize("accounting", "view")(req, res, next)
    return authorize("accounting", "settings")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});

app.use("/preview", authenticateToken, async (req, res, next) => {
  try {
    return authorize("sales", "view")(req, res, next)
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
});
app.get("/", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

app.listen(port, () => {});
