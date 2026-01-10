
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as apiAuth, users as apiUsers } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [permissionsMap, setPermissionsMap] = useState({})

  function normalizeSlug(name){
    return String(name||'').trim().toLowerCase().replace(/\s+/g,'_')
  }
  function normalizePerms(pm){
    try {
      const out = {}
      for (const [screen, obj] of Object.entries(pm||{})){
        const sc = String(screen||'').toLowerCase()
        out[sc] = out[sc] || {}
        const g = obj?._global || {}
        out[sc]._global = {}
        for (const [ac,val] of Object.entries(g)) { out[sc]._global[String(ac).toLowerCase()] = !!val }
        for (const [k,v] of Object.entries(obj||{})){
          if (k === '_global') continue
          const slug = normalizeSlug(k)
          out[sc][slug] = {}
          for (const [ac,val] of Object.entries(v||{})) { out[sc][slug][String(ac).toLowerCase()] = !!val }
        }
      }
      return out
    } catch { return pm||{} }
  }

  const loadUser = useCallback(async () => {
    const tk = localStorage.getItem('token');
    if (!tk) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiAuth.me();
      setUser(data);
      setToken(tk);
      try { const pm = await apiUsers.permissions(data?.id||data?.user?.id); setPermissionsMap(normalizePerms(pm||{})) } catch {}
    } catch (e) {
      console.error('Failed to load user', e);
      setUser(null);
      setToken(null);
      setPermissionsMap({})
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const refresh = loadUser;
  const refreshPermissions = useCallback(async () => {
    try {
      const id = (user && (user.id || user?.user?.id))
      if (!id) return
      const pm = await apiUsers.permissions(id)
      setPermissionsMap(normalizePerms(pm||{}))
    } catch {}
  }, [user])

  const login = useCallback(async (email, password) => {
    const r = await apiAuth.login({ email, password });
    const tk = r.token || r?.token;
    if (tk) {
      localStorage.setItem('token', tk);
      setToken(tk);
      try {
        const data = await apiAuth.me();
        setUser(data);
        try { const pm = await apiUsers.permissions(data?.id||data?.user?.id); setPermissionsMap(normalizePerms(pm||{})) } catch {}
        return data;
      } catch (e) {
        const fallbackUser = (r && (r.user || r)) || null
        if (fallbackUser) {
          setUser(fallbackUser)
          try { const pm = await apiUsers.permissions(fallbackUser?.id||fallbackUser?.user?.id); setPermissionsMap(normalizePerms(pm||{})) } catch {}
          return fallbackUser
        }
        throw e
      }
    }
    const e = new Error('invalid_credentials');
    e.code = 'invalid_credentials';
    throw e;
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('remember');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const can = (permission) => {
    if (!user) return false;
    if (user.isSuperAdmin === true) return true;
    if (user.isAdmin === true) return true;
    if (String(user.role).toLowerCase() === 'admin') return true;
    const perms = Array.isArray(user.permissions)
      ? user.permissions
      : (user.user && user.user.permissions && typeof user.user.permissions === 'object'
          ? Object.keys(user.user.permissions).filter(k => user.user.permissions[k] === true)
          : []);
    if (perms.includes('*')) return true;
    return perms.includes(permission);
  };

  const canScreen = (screenCode, actionCode, branch = null) => {
    if (!user) return false
    if (user.isSuperAdmin === true) return true
    if (user.isAdmin === true) return true
    if (String(user.role).toLowerCase() === 'admin') return true
    const sc = String(screenCode||'').toLowerCase()
    const ac = String(actionCode||'').toLowerCase()
    const perms = permissionsMap[sc] || null
    if (!perms) return false
    if (branch === null || typeof branch === 'undefined') {
      const g = perms._global || {}
      return g[ac] === true
    } else {
      const bkey = typeof branch === 'string' ? branch : String(branch||'')
      const bp = perms[bkey] || {}
      return bp[ac] === true
    }
  }

  const isLoggedIn = !!token;

  async function impersonatePermissionsForUser(id){
    try { const pm = await apiUsers.permissions(id); setPermissionsMap(normalizePerms(pm||{})) } catch {}
  }
  async function clearImpersonation(){ try { await refreshPermissions() } catch {} }

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn, loading, refresh, refreshPermissions, login, logout, can, canScreen, permissionsMap, impersonatePermissionsForUser, clearImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
