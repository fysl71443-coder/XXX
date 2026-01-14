# 🔧 Proposed Fixes for Authentication & Authorization

This document contains specific code fixes for issues identified in the audit report.

---

## 1️⃣ Standardize Admin Check

### Backend: Create Utility Function

**File:** `backend/utils/auth.js` (NEW)

```javascript
/**
 * Check if user is an admin
 * Centralized admin check for consistency across backend
 */
export function isAdminUser(user) {
  if (!user) return false;
  
  // Check isAdmin flag first (set by authenticateToken middleware)
  if (user.isAdmin === true) return true;
  
  // Fallback to role check
  const role = String(user.role || '').toLowerCase();
  return role === 'admin';
}
```

**Update:** `backend/middleware/auth.js`

```javascript
import { isAdminUser } from '../utils/auth.js';

// Line 85-99: Replace admin check
const isAdmin = isAdminUser(user);
req.user = {
  id: user.id,
  email: user.email,
  role: user.role,
  default_branch: user.default_branch,
  created_at: user.created_at,
  isAdmin: isAdmin
};
```

**Update:** `backend/middleware/authorize.js`

```javascript
import { isAdminUser } from '../utils/auth.js';

// Line 92: Replace admin check
const isAdmin = isAdminUser(req.user);
if (isAdmin) {
  // ... existing code
}
```

**Update:** `backend/server.js`

```javascript
import { isAdminUser } from './utils/auth.js';

// Line 433: Replace requireAdmin function
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: "forbidden", required: "admin" });
  }
  
  next();
}
```

---

### Frontend: Create Utility Function

**File:** `backend/frontend/src/utils/auth.js` (NEW)

```javascript
/**
 * Check if user is an admin
 * Centralized admin check for consistency across frontend
 */
export function isAdmin(user) {
  if (!user) return false;
  
  // Check all possible admin flags
  if (user.isSuperAdmin === true) return true;
  if (user.isAdmin === true) return true;
  
  // Fallback to role check
  const role = String(user.role || '').toLowerCase();
  return role === 'admin';
}
```

**Update:** `backend/frontend/src/context/AuthContext.js`

```javascript
import { isAdmin as isAdminUser } from '../utils/auth.js';

// Line 109: Replace admin check in loadUser
const isAdmin = isAdminUser(data);

// Line 197: Replace admin check in login
const isAdmin = isAdminUser(data);

// Line 262: Replace admin check in can()
if (isAdminUser(user)) {
  return true;
}

// Line 303: Replace admin check in canScreen()
if (isAdminUser(user)) {
  return true;
}

// Line 330-334: Replace isAdmin useMemo
const isAdmin = useMemo(() => {
  return isAdminUser(user);
}, [user]);
```

**Update:** `backend/frontend/src/routes/ProtectedRoute.jsx`

```javascript
import { isAdmin } from '../utils/auth.js';

// Line 60: Replace admin check
if (isAdmin(user)) {
  return <Outlet />;
}
```

---

## 2️⃣ Simplify Permission Parsing

**File:** `backend/frontend/src/context/AuthContext.js`

**Current Issue:** Complex permission parsing in `can()` function may not match backend expectations.

**Proposed Fix:** Document and standardize permission formats.

**Create:** `backend/frontend/src/utils/permissions.js` (NEW)

```javascript
/**
 * Permission format documentation:
 * 
 * Legacy formats (supported by can()):
 * - "screen:action" (e.g., "journal:post", "clients:write")
 * - "screen.action" (e.g., "journal.post", "clients.write")
 * - "screen" (defaults to "view" action)
 * 
 * Standard format (used by canScreen()):
 * - screenCode: string (e.g., "journal", "clients")
 * - actionCode: string (e.g., "view", "create", "edit", "delete")
 * - branch: string | null (null for global, branch code for branch-specific)
 */

/**
 * Map legacy action names to standard action codes
 */
export function mapActionToStandard(action) {
  const x = String(action || '').toLowerCase();
  
  // Standard actions
  if (x === 'view') return 'view';
  if (x === 'create') return 'create';
  if (x === 'edit') return 'edit';
  if (x === 'delete') return 'delete';
  
  // Legacy mappings
  if (x === 'write') return 'edit';
  if (x === 'post' || x === 'reverse' || x === 'credit_note' || x === 'return') return 'edit';
  if (x === 'print' || x === 'export') return 'view';
  if (x === 'settings' || x === 'manage') return 'settings';
  
  // Default
  return 'view';
}

/**
 * Parse legacy permission format to screen/action
 */
export function parsePermission(permission) {
  const raw = String(permission || '').toLowerCase();
  
  if (raw.includes(':')) {
    const [screen, action] = raw.split(':');
    return { screen: screen || '', action: mapActionToStandard(action || '') };
  }
  
  if (raw.includes('.')) {
    const [screen, action] = raw.split('.');
    return { screen: screen || '', action: mapActionToStandard(action || '') };
  }
  
  // Default to view action
  return { screen: raw, action: 'view' };
}
```

**Update:** `backend/frontend/src/context/AuthContext.js`

```javascript
import { parsePermission } from '../utils/permissions.js';
import { isAdmin as isAdminUser } from '../utils/auth.js';

// Line 257-296: Simplify can() function
const can = (permission) => {
  if (!user) return false;
  
  // Admin bypass
  if (isAdminUser(user)) {
    return true;
  }
  
  // Parse permission
  const { screen, action } = parsePermission(permission);
  
  // Use canScreen for actual check
  return canScreen(screen, action);
};
```

---

## 3️⃣ Optimize Permission Loading

**File:** `backend/frontend/src/context/AuthContext.js`

**Current:** Permissions are loaded after login, but not cached in localStorage.

**Proposed Fix:** Cache permissions in localStorage with invalidation.

```javascript
// Add to AuthContext.js

// Load permissions from cache on mount
useEffect(() => {
  const cached = localStorage.getItem('permissions');
  if (cached && user) {
    try {
      const parsed = JSON.parse(cached);
      const cachedUserId = parsed.userId;
      if (cachedUserId === user.id) {
        setPermissionsMap(normalizePerms(parsed.permissions || {}));
        setPermissionsLoaded(true);
        console.log('[AuthContext] Loaded permissions from cache');
        return; // Skip API call if cache is valid
      }
    } catch (e) {
      console.warn('[AuthContext] Failed to parse cached permissions', e);
    }
  }
}, [user]);

// Save permissions to cache after loading
const savePermissionsToCache = useCallback((userId, permissions) => {
  try {
    localStorage.setItem('permissions', JSON.stringify({
      userId,
      permissions,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('[AuthContext] Failed to cache permissions', e);
  }
}, []);

// Update loadUser to use cache
// ... (modify existing loadUser function to check cache first)

// Update logout to clear cache
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('permissions'); // Clear cache
  localStorage.removeItem('remember');
  // ... rest of logout
};
```

---

## 4️⃣ Add Token Refresh Mechanism

**File:** `backend/server.js`

**Add refresh token endpoint:**

```javascript
// Add refresh token route
app.post("/api/auth/refresh", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    
    // Create new token with same payload
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "user" },
      String(JWT_SECRET),
      { expiresIn: "12h" }
    );
    
    console.log(`[AUTH/REFRESH] Token refreshed | userId=${user.id}`);
    res.json({ token: newToken });
  } catch (e) {
    console.error(`[AUTH/REFRESH] ERROR: ${e?.message || 'unknown'}`, e);
    return res.status(401).json({ error: "unauthorized" });
  }
});
```

**File:** `backend/frontend/src/context/AuthContext.js`

**Add automatic token refresh:**

```javascript
// Add token refresh logic
const refreshToken = useCallback(async () => {
  try {
    const response = await apiAuth.refresh(); // Add this to api/auth
    const newToken = response.token;
    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
      console.log('[AuthContext] Token refreshed successfully');
      return true;
    }
  } catch (e) {
    console.error('[AuthContext] Token refresh failed', e);
    return false;
  }
}, []);

// Add token refresh on 401 (in api/client.js interceptor)
// Modify response interceptor to call refreshToken before logging out
```

---

## 5️⃣ Reduce Logging in Production

**File:** `backend/utils/logger.js` (NEW)

```javascript
const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args) => {
    console.warn(...args);
  },
  
  error: (...args) => {
    console.error(...args);
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};
```

**Update all files to use logger:**

```javascript
// Replace console.log with logger.log
// Replace console.warn with logger.warn
// Replace console.error with logger.error
```

---

## 6️⃣ Document Permission Format

**File:** `PERMISSIONS_DOCUMENTATION.md` (NEW)

```markdown
# Permissions Documentation

## Screen Codes

- `clients` - Clients management
- `suppliers` - Suppliers management
- `employees` - Employees management
- `products` - Products management
- `sales` - Sales/invoices
- `purchases` - Purchase orders
- `expenses` - Expenses
- `accounting` - Accounting/accounts
- `journal` - Journal entries
- `reports` - Reports
- `settings` - Settings (admin only)

## Action Codes

- `view` - View/list records
- `create` - Create new records
- `edit` - Edit existing records
- `delete` - Delete records

## Branch Codes

- Empty string (`''`) or `null` - Global permission (all branches)
- Branch code (e.g., `'china_town'`, `'place_india'`) - Branch-specific permission

## Examples

### Global Permission
```javascript
// User can view clients in all branches
{
  screen_code: 'clients',
  action_code: 'view',
  branch_code: '' // or null
}
```

### Branch-Specific Permission
```javascript
// User can edit clients only in china_town branch
{
  screen_code: 'clients',
  action_code: 'edit',
  branch_code: 'china_town'
}
```

## Frontend Usage

### Using can()
```javascript
const { can } = useAuth();

// Legacy formats (automatically parsed)
can('clients:view')      // ✅
can('clients:write')    // ✅ (maps to 'edit')
can('journal:post')     // ✅ (maps to 'edit')
can('reports:print')    // ✅ (maps to 'view')
```

### Using canScreen()
```javascript
const { canScreen } = useAuth();

// Standard format
canScreen('clients', 'view')              // Global permission
canScreen('clients', 'edit', 'china_town') // Branch-specific
```

## Backend Usage

```javascript
// In route handler
app.get("/api/clients", 
  authenticateToken, 
  authorize("clients", "view", {
    branchFrom: req => req.query.branch || req.query.branch_code
  }),
  async (req, res) => {
    // Handler
  }
);
```
```

---

## Implementation Priority

1. **High Priority:**
   - ✅ Standardize admin check (prevents future bugs)
   - ✅ Document permission format (improves maintainability)

2. **Medium Priority:**
   - Optimize permission loading (improves UX)
   - Add token refresh (improves UX)

3. **Low Priority:**
   - Reduce logging in production (cleaner logs)

---

## Testing Checklist

After implementing fixes:

- [ ] Admin users can access all routes
- [ ] Non-admin users are blocked from admin routes
- [ ] Permissions are checked correctly at API level
- [ ] Frontend UI reflects permissions correctly
- [ ] Token refresh works (if implemented)
- [ ] Permission cache works (if implemented)
- [ ] Logging is reduced in production (if implemented)

---

**End of Proposed Fixes**
