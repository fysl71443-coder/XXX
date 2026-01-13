import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || "";
    const parts = authHeader.split(" ");
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const payload = jwt.verify(token, String(process.env.JWT_SECRET));
    if (!payload?.id) return res.status(401).json({ error: "unauthorized" });
    if (!pool) return res.status(500).json({ error: "server_error", details: "db_not_configured" });
    const { rows } = await pool.query('SELECT id, email, role, default_branch, created_at FROM "users" WHERE id = $1 LIMIT 1', [payload.id]);
    const user = rows && rows[0];
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    try {
      const { rows: pr } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [user.id]);
      const map = {};
      for (const r of pr || []) {
        const sc = String(r.screen_code||'').toLowerCase();
        const br = String(r.branch_code||'');
        const ac = String(r.action_code||'').toLowerCase();
        map[sc] = map[sc] || { _global: {} };
        if (!br) { map[sc]._global[ac] = !!r.allowed }
        else {
          map[sc][br] = map[sc][br] || {};
          map[sc][br][ac] = !!r.allowed;
        }
      }
      req.user.permissionsMap = map;
    } catch {}
    next();
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
}
