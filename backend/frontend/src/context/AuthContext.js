
import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { auth as apiAuth, users as apiUsers } from '../services/api';
import { isAdmin as isAdminUser } from '../utils/auth.js';
import { parsePermission } from '../utils/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // CRITICAL: Start with loading=true to prevent any content from rendering
  // until we verify the user's session
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Must start as true
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [permissionsMap, setPermissionsMap] = useState({})
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const loadingUserRef = useRef(false) // Use ref to prevent concurrent loads without causing re-renders
  const lastLoadedUserIdRef = useRef(null) // Track last loaded user ID
  
  console.log('[AuthContext] Provider initialized', { 
    initialLoading: true, 
    hasToken: !!token,
    timestamp: new Date().toISOString()
  });

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
    // Prevent concurrent loads using ref
    if (loadingUserRef.current) {
      console.log('[AuthContext] loadUser already in progress, skipping...');
      return;
    }
    
    // CRITICAL: Set loading=true at the start to ensure ProtectedRoute waits
    // This prevents any content from rendering before auth verification completes
    setLoading(true);
    loadingUserRef.current = true;
    
    const tk = localStorage.getItem('token');
    console.log('[AuthContext] loadUser called', { hasToken: !!tk, tokenLength: tk?.length || 0 });
    
    if (!tk) {
      console.log('[AuthContext] No token found - clearing auth state');
      setUser(null);
      setToken(null);
      setPermissionsMap({});
      setPermissionsLoaded(false);
      setLoading(false); // Set to false only after clearing state
      loadingUserRef.current = false;
      lastLoadedUserIdRef.current = null;
      return;
    }
    
    // CRITICAL: Always set loading to true at the start of loadUser
    // This ensures ProtectedRoute waits for auth check to complete
    setLoading(true);
    loadingUserRef.current = true;
    
    // Check if already loaded for this user (only skip if we have valid user data)
    // But still need to verify token is valid by calling /auth/me
    // This prevents showing content before verifying session
    try {
      console.log('[AuthContext] Loading user from /auth/me...', { tokenPresent: !!tk });
      const data = await apiAuth.me();
      console.log('[AuthContext] User data received', { 
        hasData: !!data, 
        userId: data?.id, 
        userEmail: data?.email,
        userRole: data?.role,
        isAdmin: data?.isAdmin
      });
      
      if (!data || !data.id) {
        console.error('[AuthContext] Invalid user data received - token may be invalid', data);
        // If /auth/me fails, token is likely invalid - clear auth state
        throw new Error('Invalid user data - token may be expired or invalid');
      }
      
      // CRITICAL: Set user immediately - authentication is successful
      // Permissions loading is separate and should not block authentication
      setUser(data);
      setToken(tk);
      lastLoadedUserIdRef.current = data.id;
      
      // User is already set above - authentication successful
      // Now handle permissions (authorization) - this is OPTIONAL and should not fail auth
      const userId = data.id;
      const isAdmin = isAdminUser(data);
      
      // Admin bypass: Skip loading permissions entirely - admin has all permissions
      if (isAdmin) {
        console.log('[AuthContext] Admin user detected - skipping permissions load (admin has all permissions)');
        setPermissionsLoaded(true); // Mark as loaded so ProtectedRoute doesn't wait
        setPermissionsMap({}); // Empty map is fine for admin - bypass works
      } else {
        // For non-admin users, try to load permissions (but don't fail auth if it fails)
        const needsPermissionsReload = !permissionsLoaded || (lastLoadedUserIdRef.current !== userId);
        if (needsPermissionsReload && userId) {
          console.log('[AuthContext] Loading permissions for non-admin user (optional)...');
          try {
            const pm = await apiUsers.permissions(userId);
            setPermissionsMap(normalizePerms(pm || {}));
            setPermissionsLoaded(true);
            console.log('[AuthContext] Permissions loaded successfully');
          } catch (permErr) {
            // Permission loading failure does NOT fail authentication
            // User is still logged in, just won't see protected content until permissions load
            console.warn('[AuthContext] Permission loading failed (non-critical) - user still authenticated:', permErr?.message);
            setPermissionsMap({}); // Empty map - will retry later if needed
            setPermissionsLoaded(false); // Mark as not loaded - will retry
            // Don't throw - authentication succeeded, permissions are separate
          }
        } else {
          // Permissions already loaded or not needed
          setPermissionsLoaded(true);
        }
      }
    } catch (e) {
      console.error('[AuthContext] Error loading user:', e);
      try { localStorage.removeItem('token'); localStorage.removeItem('auth_user') } catch {}
      setUser(null);
      setToken(null);
      setPermissionsMap({});
      setPermissionsLoaded(false);
      lastLoadedUserIdRef.current = null;
    } finally {
      setLoading(false);
      loadingUserRef.current = false;
    }
  }, []); // Empty deps - function is stable, uses refs for state tracking

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
        
        // Check if admin - skip permissions load
        const isAdmin = isAdminUser(data);
        
        if (isAdmin) {
          console.log('[AuthContext] Admin user logged in - skipping permissions load');
          setPermissionsLoaded(true);
          setPermissionsMap({});
        } else {
          // Load permissions for non-admin users
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
            setPermissionsLoaded(false);
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

  /**
   * CRITICAL: can() - Check if user has permission
   * 
   * Rules:
   * 1. Admin = ALWAYS true (no exceptions, no checks)
   * 2. No user = false
   * 3. Non-admin = check permissionsMap
   */
  const can = useCallback((permission) => {
    // No user = no permission
    if (!user) return false;
    
    // ADMIN BYPASS: Admin has ALL permissions - no questions asked
    // This is the ONLY check needed for admin
    if (user.isAdmin === true || user.role === 'admin' || isAdminUser(user)) {
      return true;
    }
    
    // For non-admin users, parse permission and check via canScreen
    const { screen, action } = parsePermission(permission);
    return canScreenInternal(screen, action, null);
  }, [user, permissionsMap]);

  /**
   * Internal canScreen - used by can() and canScreen()
   * Separated to avoid circular dependency
   */
  const canScreenInternal = useCallback((screenCode, actionCode, branch = null) => {
    // For non-admin users, check permissionsMap
    const sc = String(screenCode || '').toLowerCase();
    const ac = String(actionCode || '').toLowerCase();
    const perms = permissionsMap[sc] || null;
    if (!perms) return false;
    
    if (branch === null || typeof branch === 'undefined') {
      const g = perms._global || {};
      return g[ac] === true;
    } else {
      const bkey = typeof branch === 'string' ? branch : String(branch || '');
      const bp = perms[bkey] || {};
      return bp[ac] === true;
    }
  }, [permissionsMap]);

  /**
   * CRITICAL: canScreen() - Check if user has screen/action permission
   * 
   * Rules:
   * 1. Admin = ALWAYS true (no exceptions, no checks)
   * 2. No user = false
   * 3. Non-admin = check permissionsMap
   */
  const canScreen = useCallback((screenCode, actionCode, branch = null) => {
    // No user = no permission
    if (!user) return false;
    
    // ADMIN BYPASS: Admin has ALL permissions - no questions asked
    if (user.isAdmin === true || user.role === 'admin' || isAdminUser(user)) {
      return true;
    }
    
    return canScreenInternal(screenCode, actionCode, branch);
  }, [user, canScreenInternal]);

  // CRITICAL: isLoggedIn should ONLY depend on authentication (token + user)
  // NOT on permissions - that's authorization, separate concern
  // Even if permissions fail to load, user is still logged in
  const isLoggedIn = !!user && !!token;

  // Helper function to check if user is admin
  // CRITICAL: Admin has unrestricted access - no permission checks needed
  const isAdmin = useMemo(() => {
    return isAdminUser(user);
  }, [user]);

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
    <AuthContext.Provider value={{ user, token, isLoggedIn, loading, permissionsLoaded, refresh, refreshPermissions, login, logout, can, canScreen, permissionsMap, impersonatePermissionsForUser, clearImpersonation, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
