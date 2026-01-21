# دليل البدء السريع - تنفيذ خطة الإصلاح

## 🚀 البدء السريع

### الخطوة 1: إنشاء البنية الأساسية

```bash
# من مجلد backend
mkdir -p routes controllers services
mkdir -p frontend/src/hooks/pos
mkdir -p frontend/src/components/POS
mkdir -p frontend/src/stores
```

### الخطوة 2: إنشاء ملفات Routes الأساسية

**ملف: `routes/index.js`**
```javascript
import express from 'express';
import authRoutes from './auth.js';
import orderRoutes from './orders.js';
// ... باقي routes

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
// ... باقي routes

export default router;
```

**ملف: `routes/orders.js` (مثال)**
```javascript
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as orderController from '../controllers/orderController.js';

const router = express.Router();

router.get('/', 
  authenticateToken,
  authorize('sales', 'view', { branchFrom: req => req.query.branch }),
  orderController.list
);

router.get('/:id',
  authenticateToken,
  authorize('sales', 'view'),
  orderController.get
);

export default router;
```

### الخطوة 3: استخراج Controller الأول

**ملف: `controllers/orderController.js`**
```javascript
import { pool } from '../db.js';

export async function list(req, res) {
  try {
    // نسخ الكود من server.js - handleListOrders
    const { branch, table, status } = req.query;
    // ... باقي الكود كما هو
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function get(req, res) {
  try {
    // نسخ الكود من server.js - handleGetOrder
    const id = Number(req.params.id);
    // ... باقي الكود كما هو
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
```

### الخطوة 4: تحديث server.js

**في بداية server.js:**
```javascript
import routes from './routes/index.js';

// بعد middleware setup
app.use('/api', routes);
```

**حذف:**
- جميع route handlers من server.js
- نقلها إلى routes/controllers

---

## 📋 Template Files

### Template: Route File
```javascript
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as controller from '../controllers/[name]Controller.js';

const router = express.Router();

// GET /api/[resource]
router.get('/', 
  authenticateToken,
  authorize('[screen]', '[action]', { branchFrom: req => req.query.branch }),
  controller.list
);

// GET /api/[resource]/:id
router.get('/:id',
  authenticateToken,
  authorize('[screen]', '[action]'),
  controller.get
);

// POST /api/[resource]
router.post('/',
  authenticateToken,
  authorize('[screen]', 'create', { branchFrom: req => req.body.branch }),
  controller.create
);

export default router;
```

### Template: Controller File
```javascript
import { pool } from '../db.js';

export async function list(req, res) {
  // نسخ الكود من server.js
}

export async function get(req, res) {
  // نسخ الكود من server.js
}

export async function create(req, res) {
  // نسخ الكود من server.js
}
```

### Template: Custom Hook
```javascript
import { useState, useEffect, useCallback, useRef } from 'react';

export function use[Name](dependencies) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  
  const action = useCallback(async (params) => {
    // نقل المنطق من POSInvoice.jsx
  }, [dependencies]);
  
  useEffect(() => {
    // logic
  }, [dependencies]);
  
  return { state, loading, action };
}
```

### Template: Zustand Store
```javascript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const use[Name]Store = create(
  persist(
    (set, get) => ({
      // State
      data: null,
      loading: false,
      
      // Actions
      setData: (data) => set({ data }),
      setLoading: (loading) => set({ loading }),
      reset: () => set({ data: null, loading: false }),
    }),
    {
      name: '[name]-storage',
      partialize: (state) => ({ 
        // فقط البيانات المهمة
      }),
    }
  )
);
```

---

## 🔍 كيفية العثور على الكود في server.js

### البحث عن Route Handlers:

```bash
# البحث عن جميع app.get/post/put/delete
grep -n "app\.\(get\|post\|put\|delete\)" server.js

# مثال النتائج:
# 1200: app.get('/api/orders', authenticateToken, async (req, res) => {
# 1300: app.post('/api/orders', authenticateToken, async (req, res) => {
```

### استخراج Handler Function:

1. ابحث عن `app.get('/api/orders'`
2. ابحث عن الـ closing brace `}` المقابل
3. انسخ الكود بينهما
4. انقله إلى `controllers/orderController.js`

### مثال:

**في server.js:**
```javascript
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { branch, table } = req.query;
    // ... 50 سطر من الكود
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

**في controllers/orderController.js:**
```javascript
export async function list(req, res) {
  try {
    const { branch, table } = req.query;
    // ... نفس الـ 50 سطر من الكود
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
```

**في routes/orders.js:**
```javascript
router.get('/', authenticateToken, orderController.list);
```

---

## ✅ Checklist للتحقق

### بعد استخراج Route:
- [ ] Route يعمل في Postman/curl
- [ ] لا توجد أخطاء في console
- [ ] Response نفسها كما قبل

### بعد استخراج Controller:
- [ ] جميع functions موجودة
- [ ] لا توجد imports مفقودة
- [ ] الكود يعمل كما قبل

### بعد استخراج Hook:
- [ ] Hook يعمل في component
- [ ] لا توجد regressions
- [ ] State management صحيح

### بعد استخراج Component:
- [ ] Component يعرض بشكل صحيح
- [ ] Props تعمل
- [ ] Events تعمل

---

## 🐛 حل المشاكل الشائعة

### مشكلة: Route لا يعمل
**الحل:**
- تأكد من mount route في server.js
- تأكد من path صحيح
- تأكد من middleware order

### مشكلة: Import errors
**الحل:**
- تأكد من paths صحيحة
- تأكد من exports صحيحة
- استخدم absolute imports إذا لزم

### مشكلة: State لا يتحدث
**الحل:**
- تأكد من dependencies في useEffect
- تأكد من setState calls
- استخدم React DevTools

---

## 📞 الدعم

إذا واجهت مشاكل:
1. راجع الكود الأصلي في server.js
2. تأكد من نسخ الكود بشكل صحيح
3. اختبر في isolation
4. استخدم Git للرجوع إذا لزم

---

**تم إعداد الدليل بواسطة:** AI Code Reviewer  
**التاريخ:** 2026-01-20
