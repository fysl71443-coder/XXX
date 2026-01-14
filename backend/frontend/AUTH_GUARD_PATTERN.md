# Auth Guard Pattern - Standard Pattern for All Protected Pages

## 🎯 القاعدة الذهبية

**أي شاشة محمية تستخدم API يجب أن:**
1. تستورد `useAuth` من `AuthContext`
2. تحصل على `loading: authLoading` و `isLoggedIn`
3. تتحقق من `authLoading` و `isLoggedIn` قبل أي API call

## ✅ النمط الصحيح (Standard Pattern)

```javascript
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function MyPage() {
  // CRITICAL: Get auth state first
  const { loading: authLoading, isLoggedIn } = useAuth();
  
  const [data, setData] = useState([]);
  
  // CRITICAL: Wait for auth before API calls
  useEffect(() => {
    // Don't make API calls until auth is ready
    if (authLoading || !isLoggedIn) {
      console.log('[MyPage] Waiting for auth before loading data...');
      return;
    }
    
    // Safe to make API calls here
    async function load() {
      try {
        const result = await api.getData();
        setData(result);
      } catch (e) {
        console.error('[MyPage] Error loading data:', e);
      }
    }
    
    load();
  }, [authLoading, isLoggedIn]); // Include authLoading and isLoggedIn in dependencies
  
  // Show loading state while auth is loading
  if (authLoading) {
    return <div>Loading...</div>;
  }
  
  // Render page content
  return <div>{/* Page content */}</div>;
}
```

## ❌ الأخطاء الشائعة (تجنبها)

### خطأ 1: API call بدون auth check
```javascript
// ❌ خطأ
useEffect(() => {
  fetchData(); // Will run before auth is ready!
}, []);
```

### خطأ 2: استخدام localStorage مباشرة
```javascript
// ❌ خطأ
useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
    fetchData(); // Token might be stale or invalid
  }
}, []);
```

### خطأ 3: عدم إضافة authLoading في dependencies
```javascript
// ❌ خطأ
useEffect(() => {
  if (!authLoading) {
    fetchData();
  }
}, []); // Missing authLoading in dependencies!
```

## ✅ الحل الصحيح

```javascript
// ✅ صحيح
useEffect(() => {
  if (authLoading || !isLoggedIn) {
    return; // Don't proceed
  }
  fetchData();
}, [authLoading, isLoggedIn]); // Include both in dependencies
```

## 📋 Checklist لكل صفحة جديدة

- [ ] استورد `useAuth` من `AuthContext`
- [ ] احصل على `loading: authLoading` و `isLoggedIn`
- [ ] أضف check في كل `useEffect` الذي يستدعي API
- [ ] أضف `authLoading` و `isLoggedIn` في dependencies
- [ ] أضف loading state إذا `authLoading === true`
- [ ] اختبر أن الصفحة لا تطلق API calls قبل auth ready

## 🔍 كيفية التحقق

### في Browser Console:
```
[MyPage] Waiting for auth before loading data...
[AuthContext] User data received
[MyPage] Loading data... (after auth ready)
```

### في Network Tab:
- لا طلبات قبل `/auth/me` completes
- كل الطلبات تحتوي على `Authorization: Bearer ...`
- لا `userId=anon` في logs

## 🛠️ مثال كامل

```javascript
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { invoices as apiInvoices } from '../services/api';

export default function Invoices() {
  // Step 1: Get auth state
  const { loading: authLoading, isLoggedIn } = useAuth();
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Step 2: Wait for auth before API calls
  useEffect(() => {
    // Guard: Don't proceed if auth not ready
    if (authLoading || !isLoggedIn) {
      console.log('[Invoices] Waiting for auth...');
      return;
    }
    
    // Safe to make API call
    async function load() {
      setLoading(true);
      try {
        const data = await apiInvoices.list();
        setInvoices(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[Invoices] Error:', e);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }
    
    load();
  }, [authLoading, isLoggedIn]); // Step 3: Include in dependencies
  
  // Step 4: Show loading while auth is loading
  if (authLoading) {
    return <div>Loading...</div>;
  }
  
  // Step 5: Render content
  return (
    <div>
      {loading ? 'Loading invoices...' : `${invoices.length} invoices`}
    </div>
  );
}
```

## 🎓 لماذا هذا مهم؟

1. **يمنع Race Conditions**: لا API calls قبل token ready
2. **يمنع userId=anon**: كل الطلبات تحتوي على token
3. **يمنع 401 errors**: Token موجود قبل أي request
4. **يحسن UX**: Loading states واضحة
5. **يضمن الأمان**: لا محتوى محمي يظهر بدون auth

## 📝 ملاحظات

- `ProtectedRoute` يمنع render أثناء `loading=true`
- لكن بعض الصفحات قد تحتاج loading state إضافي
- دائماً تحقق من `authLoading` قبل API calls
- `isLoggedIn` يضمن أن user موجود و token موجود
