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
    const { rows } = await pool.query('SELECT id, email, role, created_at FROM "users" WHERE id = $1 LIMIT 1', [payload.id]);
    const user = rows && rows[0];
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

