import { pool } from "../db.js";

function normalize(str){ return String(str||'').trim().toLowerCase() }

async function ensurePermissionsMap(req){
  if (req.user && req.user.permissionsMap) return req.user.permissionsMap
  const id = Number(req.user?.id || 0)
  if (!id) return {}
  const { rows } = await pool.query('SELECT screen_code, branch_code, action_code, allowed FROM user_permissions WHERE user_id = $1', [id])
  const map = {}
  for (const r of rows || []) {
    const sc = normalize(r.screen_code)
    const br = String(r.branch_code || '')
    const ac = normalize(r.action_code)
    map[sc] = map[sc] || { _global: {} }
    if (!br) {
      map[sc]._global[ac] = !!r.allowed
    } else {
      map[sc][br] = map[sc][br] || {}
      map[sc][br][ac] = !!r.allowed
    }
  }
  try { if (req.user) req.user.permissionsMap = map } catch {}
  return map
}

export function authorize(screen, action, options = {}) {
  return async (req, res, next) => {
    try {
      const sc = normalize(screen)
      const ac = normalize(action)
      if (!req.user) return res.status(401).json({ error: 'unauthorized' })
      const role = normalize(req.user.role)
      if (role === 'admin') return next()
      const perms = await ensurePermissionsMap(req)
      const p = perms[sc] || null
      if (!p) return res.status(403).json({ error: 'forbidden', required: `${sc}:${ac}` })
      if ((p._global || {})[ac] === true) return next()
      const branch =
        (typeof options.branchFrom === 'function' ? options.branchFrom(req) : null) ||
        req.body?.branch ||
        req.query?.branch ||
        req.user?.default_branch ||
        ''
      if (!branch) return res.status(400).json({ error: 'branch_required' })
      const bp = p[String(branch)] || null
      if (!bp || bp[ac] !== true) return res.status(403).json({ error: 'forbidden', required: `${sc}:${ac}:${branch}` })
      return next()
    } catch (e) {
      return res.status(500).json({ error: 'server_error', details: e?.message || 'unknown' })
    }
  }
}
