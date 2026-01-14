# 🔐 Authentication & Authorization Audit Report

**Date:** 2024-01-XX  
**Project:** Accounting & POS System  
**Scope:** Full-stack authentication, authorization, and permissions system

---

## 📋 Executive Summary

This audit examines the complete authentication and authorization flow across frontend (React) and backend (Node.js/Express). The system uses JWT tokens stored in localStorage, with role-based access control (RBAC) and screen/action/branch permissions.

### Key Findings:
- ✅ **Strong Points:** Clear separation of auth/authorization, admin bypass implemented, static file protection
- ⚠️ **Issues Found:** Some redundant checks, inconsistent admin detection, potential race conditions
- 🔧 **Recommendations:** Simplify admin checks, remove duplicate validations, optimize permission loading

---

## 1️⃣ Login Flow Analysis

### 1.1 Backend Login (`backend/server.js:255-315`)

**Flow:**
1. User submits email/password → `/api/auth/login` or `/auth/login`
2. Backend queries user from DB
3. Validates password with bcrypt
4. Creates JWT token (expires in 12h)
5. Loads user permissions (optional, non-blocking)
6. Returns: `{ token, user, screens, branches }`

**Code:**
```javascript
// Line 281: Token creation
const token = jwt.sign({ id: user.id, email: user.email, role: user.role || "user" }, 
                       String(JWT_SECRET), { expiresIn: "12h" });

// Line 283-285: Permissions loading (optional)
let perms = {};
try { perms = await loadUserPermissionsMap(user.id) } catch (permErr) {
  console.error(`[LOGIN] ERROR loading permissions | userId=${user.id}`, permErr?.message)
}
```

**✅ Good:** Permissions loading is non-blocking - login succeeds even if permissions fail.

---

### 1.2 Frontend Login (`backend/frontend/src/context/AuthContext.js:177-242`)

**Flow:**
1. User calls `login(email, password)`
2. Calls `apiAuth.login()` → receives token
3. Stores token in `localStorage.setItem('token', tk)`
4. Calls `/auth/me` to verify token and get user data
5. If admin → skip permissions load
6. If non-admin → load permissions from `/api/users/:id/permissions`

**Code:**
```javascript
// Line 181: Token storage
localStorage.setItem('token', tk);

// Line 189: Verify token
const data = await apiAuth.me();

// Line 197-218: Admin bypass for permissions
const isAdmin = data?.isSuperAdmin === true || data?.isAdmin === true || role === 'admin';
if (isAdmin) {
  setPermissionsLoaded(true);
  setPermissionsMap({});
} else {
  // Load permissions for non-admin users
  const pm = await apiUsers.permissions(userId);
  setPermissionsMap(normalizePerms(pm || {}));
}
```

**✅ Good:** Admin users skip permission loading entirely.

**⚠️ Issue:** Multiple admin checks scattered across codebase (see section 3.1).

---

## 2️⃣ Token Storage & Propagation

### 2.1 Storage Location

**Frontend:**
- **Location:** `localStorage.getItem('token')`
- **Files:** 
  - `AuthContext.js:12` - Initial state
  - `AuthContext.js:181` - After login
  - `client.js:18` - Axios interceptor reads fresh token

**✅ Good:** Token is read fresh from localStorage on every request (not cached).

---

### 2.2 Token Injection (Axios Interceptor)

**File:** `backend/frontend/src/services/api/client.js:16-42`

**Code:**
```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Always read fresh
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**✅ Excellent:** Token is read at request time, ensuring it's always fresh.

**⚠️ Potential Issue:** If token is removed from localStorage between page load and API call, request will fail. This is expected behavior, but could be handled more gracefully.

---

### 2.3 Backend Token Verification

**File:** `backend/middleware/auth.js:4-138`

**Flow:**
1. Extract token from `Authorization: Bearer <token>` header
2. Verify JWT signature with `JWT_SECRET`
3. Query user from DB
4. Attach `req.user` with `isAdmin` flag
5. Optionally load permissions (non-blocking)

**Code:**
```javascript
// Line 52-54: Extract token
const authHeader = req.headers["authorization"] || "";
const parts = authHeader.split(" ");
const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;

// Line 61: Verify JWT
const payload = jwt.verify(token, String(process.env.JWT_SECRET));

// Line 87: Admin check
const isAdmin = role === 'admin';
req.user = { ...user, isAdmin };
```

**✅ Good:** Static files are skipped (lines 13-50).

**✅ Good:** Permission loading is optional (lines 105-129).

---

## 3️⃣ Authorization & Permissions

### 3.1 Admin Bypass Logic

**Problem:** Admin detection is inconsistent across codebase.

**Locations:**
1. **Backend `auth.js:87`:** `const isAdmin = role === 'admin';`
2. **Backend `authorize.js:92`:** `req.user?.isAdmin === true || normalize(req.user?.role) === 'admin'`
3. **Backend `server.js:433`:** `req.user?.isAdmin === true || String(req.user?.role || '').toLowerCase() === 'admin'`
4. **Frontend `AuthContext.js:197`:** `data?.isSuperAdmin === true || data?.isAdmin === true || role === 'admin'`
5. **Frontend `AuthContext.js:262`:** `user.isSuperAdmin === true || user.isAdmin === true || role === 'admin'`
6. **Frontend `ProtectedRoute.jsx:60`:** `user?.isSuperAdmin === true || user?.isAdmin === true || role === 'admin'`

**🔴 Issue:** Multiple variations of admin check:
- Some check `isSuperAdmin`
- Some check `isAdmin` flag
- Some only check `role === 'admin'`
- Some normalize role, some don't

**✅ Recommendation:** Standardize admin check to single function:
```javascript
// Backend: middleware/auth.js
function isAdminUser(user) {
  if (!user) return false;
  return user.isAdmin === true || String(user.role || '').toLowerCase() === 'admin';
}

// Frontend: context/AuthContext.js
const isAdmin = useMemo(() => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  return user.isSuperAdmin === true || user.isAdmin === true || role === 'admin';
}, [user]);
```

**Note:** Frontend checks `isSuperAdmin` but backend doesn't set it. This is inconsistent but harmless (frontend check is more permissive).

---

### 3.2 Permission Checks

#### Backend Authorization (`backend/middleware/authorize.js`)

**Flow:**
1. Skip static files and non-API endpoints
2. Check if user is authenticated (`req.user`)
3. **Admin bypass:** If admin, allow immediately
4. Load permissions map (cached in `req.user.permissionsMap`)
5. Check global permission first
6. If branch required, check branch-specific permission

**Code:**
```javascript
// Line 92-100: Admin bypass
const isAdmin = req.user?.isAdmin === true || normalize(req.user?.role) === 'admin';
if (isAdmin) {
  return next(); // Skip all permission checks
}

// Line 109-120: Permission checks
const perms = await ensurePermissionsMap(req);
const p = perms[sc] || null;
if ((p._global || {})[ac] === true) {
  return next(); // Global permission granted
}
```

**✅ Good:** Admin bypass is at the top, before any permission checks.

**✅ Good:** Permissions are cached in `req.user.permissionsMap` to avoid repeated DB queries.

---

#### Frontend Permission Checks (`backend/frontend/src/context/AuthContext.js`)

**Functions:**
1. **`can(permission)`** - Legacy format support (e.g., `'journal:post'`, `'clients:write'`)
2. **`canScreen(screenCode, actionCode, branch)`** - Direct screen/action check

**Code:**
```javascript
// Line 257-296: can() function
const can = (permission) => {
  if (!user) return false;
  
  // Admin bypass
  if (user.isSuperAdmin === true || user.isAdmin === true || role === 'admin') {
    return true;
  }
  
  // Parse permission and map to screen/action
  // Then call canScreen()
};

// Line 298-321: canScreen() function
const canScreen = (screenCode, actionCode, branch = null) => {
  if (!user) return false;
  
  // Admin bypass
  if (user.isSuperAdmin === true || user.isAdmin === true || role === 'admin') {
    return true;
  }
  
  // Check permissionsMap
  const perms = permissionsMap[sc] || null;
  if (branch === null) {
    return perms._global[ac] === true;
  } else {
    return perms[branch][ac] === true;
  }
};
```

**✅ Good:** Both functions have admin bypass at the top.

**⚠️ Issue:** `can()` function has complex permission parsing logic that may not match backend expectations. For example:
- `'journal:post'` → maps to `'edit'` action
- `'clients:write'` → maps to `'edit'` action
- `'reports:print'` → maps to `'view'` action

This mapping may not align with backend `authorize()` middleware expectations.

---

### 3.3 Route Protection

#### Frontend (`backend/frontend/src/routes/ProtectedRoute.jsx`)

**Flow:**
1. Wait for `loading === false` (auth check complete)
2. Check if `user && token` exist
3. If admin → render immediately (skip permissions wait)
4. If non-admin → wait for `permissionsLoaded === true`
5. Render `<Outlet />` (protected routes)

**Code:**
```javascript
// Line 25-38: Wait for auth check
if (loading) {
  return <LoadingScreen />;
}

// Line 44-56: Check authentication
if (!user || !token) {
  return <Navigate to="/login" replace />;
}

// Line 60-69: Admin bypass
if (isAdmin) {
  return <Outlet />; // Skip permissions wait
}

// Line 72-82: Wait for permissions (non-admin only)
if (!permissionsLoaded) {
  return <LoadingScreen />;
}
```

**✅ Excellent:** Admin users don't wait for permissions to load.

**✅ Good:** Non-admin users wait for permissions before rendering.

---

#### Backend Route Protection

**Files:** `backend/server.js` (various routes)

**Pattern:**
```javascript
app.get("/api/clients", authenticateToken, authorize("clients", "view", { 
  branchFrom: req => req.query.branch || req.query.branch_code 
}), async (req, res) => {
  // Route handler
});
```

**✅ Good:** Routes use `authenticateToken` first, then `authorize()`.

**⚠️ Issue:** Some routes use `requireAdmin` instead of `authorize()`. This is correct for admin-only endpoints (e.g., `/api/users`, `/api/settings`), but ensure consistency.

---

## 4️⃣ Redundant Checks & Issues

### 4.1 Duplicate Admin Checks

**Problem:** Admin check is performed multiple times in the same flow:

1. **Backend `auth.js`:** Sets `req.user.isAdmin` flag
2. **Backend `authorize.js`:** Checks `req.user.isAdmin` again
3. **Frontend `AuthContext`:** Checks admin in `can()` and `canScreen()`
4. **Frontend `ProtectedRoute`:** Checks admin again

**Impact:** Minimal performance impact, but code duplication.

**✅ Recommendation:** Keep as-is. Each check serves a different purpose:
- Backend `auth.js`: Sets flag for downstream middleware
- Backend `authorize.js`: Bypasses permission checks
- Frontend `can()`/`canScreen()`: UI gating
- Frontend `ProtectedRoute`: Route-level protection

**Note:** These checks are necessary and not truly redundant.

---

### 4.2 Permission Loading Redundancy

**Problem:** Permissions are loaded in multiple places:

1. **Backend `auth.js:105-129`:** Loads permissions (optional, cached in `req.user.permissionsMap`)
2. **Backend `authorize.js:5-25`:** `ensurePermissionsMap()` loads if not cached
3. **Frontend `AuthContext.js:122`:** Loads permissions after login
4. **Frontend `AuthContext.js:168`:** `refreshPermissions()` reloads permissions

**✅ Good:** Backend uses caching (`req.user.permissionsMap`), so no duplicate DB queries.

**⚠️ Issue:** Frontend loads permissions after login, but backend also loads them. This is intentional (frontend needs permissions for UI gating), but could be optimized.

**✅ Recommendation:** Keep as-is. Frontend needs permissions for UI, backend needs them for API authorization. Both are necessary.

---

### 4.3 Static File Protection

**Problem:** Static files are checked in multiple places:

1. **Backend `server.js`:** `express.static()` serves files first
2. **Backend `server.js`:** `staticFileGuard` middleware
3. **Backend `auth.js:13-50`:** Static file detection
4. **Backend `authorize.js:36-68`:** Static file detection

**✅ Good:** Static files are properly skipped at multiple layers (defense in depth).

**✅ Recommendation:** Keep as-is. Multiple checks ensure static files are never blocked.

---

### 4.4 Race Conditions

**Potential Issue:** Frontend may make API calls before auth is ready.

**Current Protection:**
1. **`AuthContext.js:11`:** `loading` starts as `true`
2. **`ProtectedRoute.jsx:25`:** Blocks render until `loading === false`
3. **Pages (e.g., `Journal.jsx`):** Check `authLoading` and `isLoggedIn` before API calls

**Code Example (`Journal.jsx`):**
```javascript
useEffect(() => { 
  if (authLoading || !isLoggedIn) {
    return; // Don't make API calls until auth is ready
  }
  load(); 
}, [filters, authLoading, isLoggedIn]);
```

**✅ Good:** Race conditions are prevented by `ProtectedRoute` blocking render and pages checking `authLoading`.

---

## 5️⃣ Security Analysis

### 5.1 Token Security

**✅ Good:**
- JWT tokens are signed with secret
- Tokens expire after 12 hours
- Tokens are stored in localStorage (not cookies, but acceptable for SPA)

**⚠️ Consider:**
- localStorage is vulnerable to XSS attacks. Consider httpOnly cookies for production.
- Token expiration is 12h - consider shorter expiration with refresh tokens.

---

### 5.2 Permission Security

**✅ Good:**
- Backend is authoritative (frontend checks are UI-only)
- Admin bypass is explicit and consistent
- Permissions are checked at API level, not just frontend

**✅ Good:**
- Static files are properly excluded from auth checks
- Public endpoints (`/auth/login`, `/auth/register`) are excluded

---

### 5.3 Admin Access

**✅ Good:**
- Admin users have unrestricted access (bypass all permission checks)
- Admin check is performed early in middleware chain
- Frontend and backend both respect admin bypass

**⚠️ Issue:** Admin detection is inconsistent (see section 3.1), but all variations are permissive (won't block admin users).

---

## 6️⃣ Recommendations

### 6.1 High Priority

#### 1. Standardize Admin Check
**File:** Create utility functions
- `backend/utils/auth.js`: `isAdminUser(user)`
- `frontend/utils/auth.js`: `isAdmin(user)`

**Impact:** Reduces code duplication, ensures consistency.

---

#### 2. Simplify Permission Parsing
**File:** `backend/frontend/src/context/AuthContext.js:257-296`

**Issue:** `can()` function has complex permission parsing that may not match backend.

**Recommendation:** Document expected permission formats and ensure frontend/backend alignment.

---

### 6.2 Medium Priority

#### 3. Optimize Permission Loading
**Current:** Permissions loaded after login, then again on refresh.

**Recommendation:** Consider caching permissions in localStorage (with invalidation on logout).

---

#### 4. Add Token Refresh Mechanism
**Current:** Tokens expire after 12h, user must re-login.

**Recommendation:** Implement refresh tokens for seamless re-authentication.

---

### 6.3 Low Priority

#### 5. Reduce Logging in Production
**Current:** Extensive `console.log` statements throughout.

**Recommendation:** Use logging library (e.g., `winston`) with environment-based levels.

---

#### 6. Document Permission Format
**Current:** Permission formats are implicit in code.

**Recommendation:** Create documentation for:
- Screen codes (e.g., `'clients'`, `'journal'`)
- Action codes (e.g., `'view'`, `'create'`, `'edit'`, `'delete'`)
- Branch codes (empty string for global, branch code for branch-specific)

---

## 7️⃣ File-by-File Summary

### Backend Files

| File | Purpose | Key Functions | Issues |
|------|---------|---------------|--------|
| `server.js` | Main server, routes, login | `handleLogin()`, `requireAdmin()` | Admin check inconsistency |
| `middleware/auth.js` | JWT verification | `authenticateToken()` | ✅ Good |
| `middleware/authorize.js` | Permission checks | `authorize()`, `ensurePermissionsMap()` | ✅ Good |

### Frontend Files

| File | Purpose | Key Functions | Issues |
|------|---------|---------------|--------|
| `context/AuthContext.js` | Auth state management | `login()`, `can()`, `canScreen()` | Admin check inconsistency |
| `routes/ProtectedRoute.jsx` | Route protection | Route guard component | ✅ Good |
| `services/api/client.js` | Axios config, token injection | Request/response interceptors | ✅ Good |

---

## 8️⃣ Conclusion

### Overall Assessment: ✅ **GOOD**

The authentication and authorization system is well-designed with:
- Clear separation of concerns (auth vs. authorization)
- Proper admin bypass
- Static file protection
- Race condition prevention

### Main Issues:
1. **Admin check inconsistency** (cosmetic, doesn't affect functionality)
2. **Permission parsing complexity** (may cause mismatches)
3. **No token refresh** (user experience)

### Security: ✅ **SECURE**

- Backend is authoritative
- Tokens are properly signed
- Permissions are enforced at API level
- Admin access is explicit and controlled

---

**End of Report**
