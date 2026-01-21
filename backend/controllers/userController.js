import { pool } from '../db.js';
import bcrypt from 'bcrypt';

/**
 * Helper functions for permissions
 */
function baseScreens() {
  return [
    "clients", "suppliers", "employees", "expenses", "products", "sales", "purchases", "reports", "accounting", "journal", "settings"
  ];
}

function defaultPermissions(role) {
  const sc = baseScreens();
  const m = {};
  for (const s of sc) {
    m[s] = { _global: { view: true, create: role === "admin", edit: role === "admin", delete: role === "admin" } };
  }
  return m;
}

function flattenPermissionsMap(map, userId) {
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

function flattenPermissionsList(list, userId) {
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

async function saveUserPermissions(userId, rows) {
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
 * List users
 * GET /api/users
 */
export async function list(req, res) {
  try {
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const { rows } = await pool.query('SELECT id, email, role, is_active, created_at FROM "users" ORDER BY id DESC');
    const items = Array.isArray(rows) ? rows.map(r => ({ id: r.id, email: r.email, role: r.role || "user", is_active: r.is_active !== false, created_at: r.created_at })) : [];
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get single user
 * GET /api/users/:id
 */
export async function get(req, res) {
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
}

/**
 * Create user
 * POST /api/users
 */
export async function create(req, res) {
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
}

/**
 * Update user
 * PUT /api/users/:id
 */
export async function update(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { email, role, default_branch } = req.body || {};
    if (!id) return res.status(400).json({ error: "invalid_payload" });
    const { rows } = await pool.query('UPDATE "users" SET email = COALESCE($1, email), role = COALESCE($2, role), default_branch = COALESCE($3, default_branch) WHERE id = $4 RETURNING id, email, role, default_branch, created_at', [email || null, role || null, default_branch || null, id]);
    res.json(rows && rows[0]);
  } catch (e) {
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Toggle user active status
 * POST /api/users/:id/toggle
 */
export async function toggle(req, res) {
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
}

/**
 * Reset user password
 * POST /api/users/:id/reset-password
 */
export async function resetPassword(req, res) {
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
}

/**
 * Get user permissions
 * GET /api/users/:id/permissions
 */
export async function getPermissions(req, res) {
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
}

/**
 * Update user permissions
 * PUT /api/users/:id/permissions
 */
export async function updatePermissions(req, res) {
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
}

/**
 * Delete user
 * DELETE /api/users/:id
 */
export async function remove(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const adminId = req.user?.id || 'unknown';
    
    if (!id) {
      return res.status(400).json({ error: "invalid_payload", details: "User ID is required" });
    }
    
    // Prevent deleting yourself
    if (id === adminId) {
      return res.status(400).json({ error: "invalid_operation", details: "Cannot delete yourself" });
    }
    
    // Check if user exists
    const { rows: existing } = await pool.query('SELECT id, role FROM "users" WHERE id = $1 LIMIT 1', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "not_found", details: "User not found" });
    }
    
    // Delete user permissions first
    await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [id]);
    
    // Delete the user
    await pool.query('DELETE FROM "users" WHERE id = $1', [id]);
    
    console.log(`[USERS] User deleted | adminId=${adminId} deletedUserId=${id}`);
    res.json({ ok: true, deleted_id: id });
  } catch (e) {
    console.error('[USERS] Error deleting user:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}
