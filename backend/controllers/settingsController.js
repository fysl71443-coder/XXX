import { pool } from '../db.js';

/**
 * List settings
 * GET /api/settings
 */
export async function list(req, res) {
  try {
    const { rows } = await pool.query('SELECT key, value, updated_at FROM settings ORDER BY key ASC');
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('[SETTINGS] Error listing settings:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get single setting
 * GET /api/settings/:key
 */
export async function get(req, res) {
  try {
    const key = String(req.params.key || "");
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    const value = rows && rows[0] ? rows[0].value : null;
    res.json(value);
  } catch (e) {
    console.error('[SETTINGS] Error getting setting:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Update setting
 * PUT /api/settings/:key
 */
export async function update(req, res) {
  try {
    const key = String(req.params.key || "");
    const value = req.body || null;
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[SETTINGS] Error updating setting:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Backup settings
 * POST /api/settings/backup
 */
export async function backup(req, res) {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings ORDER BY key ASC');
    const dump = {};
    for (const r of rows || []) {
      dump[r.key] = r.value;
    }
    res.json({ ok: true, data: dump });
  } catch (e) {
    console.error('[SETTINGS] Error backing up settings:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Restore settings
 * POST /api/settings/restore
 */
export async function restore(req, res) {
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
}
