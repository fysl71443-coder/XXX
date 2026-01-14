
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth as apiAuth, users as apiUsers } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [permissionsMap, setPermissionsMap] = useState({})
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const loadingUserRef = useRef(false) // Use ref to prevent concurrent loads without causing re-renders
  const lastLoadedUserIdRef = useRef(null) // Track last loaded user ID

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
    // Prevent concurrent loads using functional update
    setLoadingUser(prev => {
      if (prev) {
        console.log('[AuthContext] loadUser already in progress, skipping...');
        return prev; // Keep true
      }
      return true; // Set to true
    });
    
    // Check again after state update (async)
    const tk = localStorage.getItem('token');
    if (!tk) {
      setUser(null);
      setToken(null);
      setPermissionsMap({});
      setPermissionsLoaded(false);
      setLoading(false);
      setLoadingUser(false);
      return;
    }
    
    try {
      console.log('[AuthContext] Loading user...');
      const data = await apiAuth.me();
      if (!data || !data.id) {
        throw new Error('Invalid user data');
      }
      
      const userId = data?.id || data?.user?.id;
      
      // Use functional updates to check current state
      setUser(prevUser => {
        const currentUserId = prevUser?.id || prevUser?.user?.id;
        
        // Load permissions only if user changed or not loaded yet
        setPermissionsLoaded(prevLoaded => {
          if (!prevLoaded || (currentUserId && currentUserId !== userId)) {
            // Load permissions
            if (userId) {
              console.log('[AuthContext] Loading permissions...');
              apiUsers.permissions(userId)
                .then(pm => {
                  setPermissionsMap(normalizePerms(pm || {}));
                  setPermissionsLoaded(true);
                  console.log('[AuthContext] Permissions loaded successfully');
                })
                .catch(permErr => {
                  console.error('[AuthContext] Error loading permissions:', permErr);
                  // Admin doesn't need permissions
                  if (String(data?.role || '').toLowerCase() === 'admin') {
                    setPermissionsLoaded(true);
                  }
                });
            } else if (String(data?.role || '').toLowerCase() === 'admin') {
              // Admin doesn't need permissions
              return true;
            }
          }
          return prevLoaded;
        });
        
        return data;
      });
      
      setToken(tk);
    } catch (e) {
      console.error('[AuthContext] Error loading user:', e);
      try { localStorage.removeItem('token'); localStorage.removeItem('auth_user') } catch {}
      setUser(null);
      setToken(null);
      setPermissionsMap({});
      setPermissionsLoaded(false);
    } finally {
      setLoading(false);
      setLoadingUser(false);
    }
  }, []); // Empty deps - only create once

  useEffect(() => {
    // Only load once on mount
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const refresh = loadUser;
  const refreshPermissions = useCallback(async () => {
    try {
      const id = (user && (user.id || user?.user?.id))
      if (!id) {
        console.warn('[AuthContext] refreshPermissions: No user ID');
        return;
      }
      console.log('[AuthContext] Refreshing permissions...');
      const pm = await apiUsers.permissions(id);
      setPermissionsMap(normalizePerms(pm || {}));
      setPermissionsLoaded(true);
      console.log('[AuthContext] Permissions refreshed successfully');
    } catch (e) {
      console.error('[AuthContext] Error refreshing permissions:', e);
    }
  }, [user])

  const login = useCallback(async (email, password) => {
    const r = await apiAuth.login({ email, password });
    const tk = r.token || r?.token;
    if (tk) {
      localStorage.setItem('token', tk);
      try { if (r?.user) localStorage.setItem('auth_user', JSON.stringify(r.user)); } catch {}
      try { if (Array.isArray(r?.screens)) localStorage.setItem('screens', JSON.stringify(r.screens)); } catch {}
      try { if (Array.isArray(r?.branches)) localStorage.setItem('branches', JSON.stringify(r.branches)); } catch {}
      setToken(tk);
      setPermissionsLoaded(false); // Reset permissions flag
      
      try {
        const data = await apiAuth.me();
        if (!data || !data.id) {
          throw new Error('Invalid user data from /auth/me');
        }
        setUser(data);
        
        // Load permissions once
        try {
          const userId = data?.id || data?.user?.id;
          if (userId) {
            console.log('[AuthContext] Loading permissions after login...');
            const pm = await apiUsers.permissions(userId);
            setPermissionsMap(normalizePerms(pm || {}));
            setPermissionsLoaded(true);
            console.log('[AuthContext] Permissions loaded after login');
          }
        } catch (permErr) {
          console.error('[AuthContext] Error loading permissions after login:', permErr);
          // Admin can still work without permissions
          if (String(data?.role || '').toLowerCase() === 'admin') {
            setPermissionsLoaded(true);
          }
        }
        return data;
      } catch (e) {
        console.error('[AuthContext] Error in login flow:', e);
        const fallbackUser = (r && (r.user || r)) || null
        if (fallbackUser && fallbackUser.id) {
          setUser(fallbackUser);
          // Try to load permissions for fallback user
          try {
            const userId = fallbackUser?.id || fallbackUser?.user?.id;
            if (userId) {
              const pm = await apiUsers.permissions(userId);
              setPermissionsMap(normalizePerms(pm || {}));
              setPermissionsLoaded(true);
            }
          } catch {}
          return fallbackUser;
        }
        throw e;
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
    setPermissionsMap({});
    setPermissionsLoaded(false);
    loadingUserRef.current = false;
    lastLoadedUserIdRef.current = null;
    window.location.href = '/login';
  };

  const can = (permission) => {
    if (!user) return false;
    if (user.isSuperAdmin === true) return true;
    if (user.isAdmin === true) return true;
    if (String(user.role).toLowerCase() === 'admin') return true;
    const raw = String(permission||'').toLowerCase();
    let screen = '';
    let action = '';
    if (raw.includes(':')) {
      const [s, a] = raw.split(':');
      screen = s || '';
      action = a || '';
    } else if (raw.includes('.')) {
      const [s, a] = raw.split('.');
      screen = s || '';
      action = a || '';
    } else {
      screen = raw;
      action = 'view';
    }
    const mapAction = (a) => {
      const x = String(a||'').toLowerCase();
      if (x === 'view') return 'view';
      if (x === 'create') return 'create';
      if (x === 'edit') return 'edit';
      if (x === 'delete') return 'delete';
      if (x === 'settings' || x === 'manage') return 'settings';
      if (x === 'write') return 'edit';
      if (x === 'print' || x === 'export') return 'view';
      if (x === 'post' || x === 'reverse' || x === 'credit_note' || x === 'return') return 'edit';
      return 'view';
    };
    const act = mapAction(action);
    return canScreen(screen, act);
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

  const isLoggedIn = !!user && !!token;

  async function impersonatePermissionsForUser(id){
    try {
      console.log('[AuthContext] Impersonating permissions for user:', id);
      const pm = await apiUsers.permissions(id);
      setPermissionsMap(normalizePerms(pm || {}));
      setPermissionsLoaded(true);
    } catch (e) {
      console.error('[AuthContext] Error impersonating permissions:', e);
    }
  }
  async function clearImpersonation(){
    try {
      await refreshPermissions();
    } catch (e) {
      console.error('[AuthContext] Error clearing impersonation:', e);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn, loading, permissionsLoaded, refresh, refreshPermissions, login, logout, can, canScreen, permissionsMap, impersonatePermissionsForUser, clearImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
