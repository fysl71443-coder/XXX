# خطة التنفيذ الواقعية - إصلاح البنية
## نظام إدارة المطاعم والمحاسبة

**تاريخ البدء:** 2026-01-20  
**المدة الإجمالية:** 17-24 يوم عمل  
**النهج:** Incremental Refactoring (بدون كسر الوظائف الحالية)

---

## 📋 جدول المحتويات

1. [المرحلة 1 - إنقاذ الاستقرار](#المرحلة-1)
2. [المرحلة 2 - تنظيم الحالة](#المرحلة-2)
3. [المرحلة 3 - تحسينات لاحقة](#المرحلة-3)
4. [دليل التنفيذ التفصيلي](#دليل-التنفيذ)

---

## 🟢 المرحلة 1 – إنقاذ الاستقرار
**المدة:** 10-14 يوم عمل  
**الهدف:** إيقاف النزيف - تقليل الأخطاء المستقبلية 40-50%

### ✅ المعايير الناجحة
- [ ] server.js مقسم إلى modules منفصلة
- [ ] POSInvoice.jsx مقسم إلى components + hooks
- [ ] جميع الاختبارات الحالية تعمل
- [ ] لا توجد regressions في الوظائف

---

### 1️⃣ تفكيك server.js (5-7 أيام)

#### اليوم 1-2: إنشاء البنية الأساسية

```bash
backend/
├── routes/
│   ├── index.js          # Route aggregator
│   ├── auth.js           # /api/auth/*
│   ├── orders.js         # /api/orders/*
│   ├── invoices.js       # /api/invoices/*
│   ├── expenses.js       # /api/expenses/*
│   ├── journal.js        # /api/journal/*
│   ├── pos.js            # /api/pos/*
│   ├── partners.js       # /api/partners/*
│   ├── products.js       # /api/products/*
│   ├── accounts.js       # /api/accounts/*
│   ├── users.js          # /api/users/*
│   ├── settings.js       # /api/settings/*
│   └── reports.js        # /api/reports/*
├── controllers/
│   ├── orderController.js
│   ├── invoiceController.js
│   ├── expenseController.js
│   ├── journalController.js
│   ├── posController.js
│   └── authController.js
├── services/
│   ├── orderService.js
│   ├── invoiceService.js
│   ├── accountingService.js
│   └── posService.js
└── server.js            # فقط setup + route mounting
```

**الخطوات:**

1. **إنشاء المجلدات:**
```bash
mkdir -p backend/routes backend/controllers backend/services
```

2. **استخراج Routes من server.js:**
   - نسخ route handlers كما هي (بدون تغيير)
   - نقل كل route إلى ملف منفصل
   - استخدام `express.Router()`

**مثال: `routes/orders.js`**
```javascript
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as orderController from '../controllers/orderController.js';

const router = express.Router();

// GET /api/orders
router.get('/', 
  authenticateToken,
  authorize('sales', 'view', { branchFrom: req => req.query.branch }),
  orderController.list
);

// GET /api/orders/:id
router.get('/:id',
  authenticateToken,
  authorize('sales', 'view'),
  orderController.get
);

// POST /api/orders
router.post('/',
  authenticateToken,
  authorize('sales', 'create', { branchFrom: req => req.body.branch }),
  orderController.create
);

export default router;
```

3. **استخراج Controllers:**
   - نقل handler functions إلى controllers
   - الحفاظ على نفس المنطق تماماً
   - فقط تغيير الاسم (handleX → X)

**مثال: `controllers/orderController.js`**
```javascript
import { pool } from '../db.js';

export async function list(req, res) {
  // نسخ الكود من server.js كما هو
  // بدون أي تغيير في المنطق
}

export async function get(req, res) {
  // نسخ الكود من server.js كما هو
}

export async function create(req, res) {
  // نسخ الكود من server.js كما هو
}
```

4. **استخراج Services (اختياري في هذه المرحلة):**
   - فقط الدوال التي تستخدم في أماكن متعددة
   - مثل: `createInvoiceJournalEntry`, `getAccountIdByNumber`

**مثال: `services/accountingService.js`**
```javascript
import { pool } from '../db.js';

export async function createInvoiceJournalEntry(invoiceId, customerId, subtotal, discount, tax, total, paymentMethod, branch) {
  // نسخ الكود من server.js كما هو
}

export async function getAccountIdByNumber(accountNumber) {
  // نسخ الكود من server.js كما هو
}
```

5. **تحديث server.js:**
```javascript
import express from 'express';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import invoiceRoutes from './routes/invoices.js';
// ... باقي routes

const app = express();

// ... middleware setup

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
// ... باقي routes

// ... باقي الكود (static files, etc.)
```

**التحقق:**
- [ ] جميع routes تعمل
- [ ] لا توجد أخطاء في console
- [ ] جميع الاختبارات تمر

---

#### اليوم 3-4: استخراج Controllers الكبيرة

**الأولوية:**
1. `handleIssueInvoice` → `controllers/posController.js`
2. `handleSaveDraft` → `controllers/posController.js`
3. `handleCreateInvoice` → `controllers/invoiceController.js`
4. `handleCreateExpense` → `controllers/expenseController.js`

**النهج:**
- نسخ الكود كما هو
- فقط تغيير الاسم
- لا refactor الآن

---

#### اليوم 5-7: استخراج Services المشتركة

**الدوال المستخدمة في أماكن متعددة:**
- `createInvoiceJournalEntry`
- `createExpenseJournalEntry`
- `getAccountIdByNumber`
- `getOrCreatePartnerAccount`
- `getNextEntryNumber`

**النهج:**
- نقل إلى `services/accountingService.js`
- استبدال الاستدعاءات في controllers

---

### 2️⃣ تفكيك POSInvoice.jsx (5-7 أيام)

#### اليوم 1-2: إنشاء Custom Hooks

**الهدف:** استخراج المنطق من المكون

```javascript
// hooks/useOrder.js
export function useOrder(orderId, branch, table) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const orderRef = useRef(null);
  
  // نقل منطق hydrateOrder هنا
  const hydrateOrder = useCallback(async (id) => {
    // نسخ الكود من POSInvoice.jsx
  }, [branch, table]);
  
  useEffect(() => {
    if (orderId) hydrateOrder(orderId);
  }, [orderId, hydrateOrder]);
  
  return { order, loading, hydrateOrder };
}

// hooks/useInvoice.js
export function useInvoice() {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  
  // نقل منطق issueInvoice هنا
  const issueInvoice = useCallback(async (paymentType, orderId) => {
    // نسخ الكود من POSInvoice.jsx
  }, [items, /* dependencies */]);
  
  return { items, setItems, itemsRef, issueInvoice };
}

// hooks/usePayments.js
export function usePayments() {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [payLines, setPayLines] = useState([]);
  
  // نقل منطق الدفع هنا
  return { paymentMethod, setPaymentMethod, payLines, setPayLines };
}
```

**الخطوات:**

1. **إنشاء مجلد hooks:**
```bash
mkdir -p backend/frontend/src/hooks/pos
```

2. **استخراج useOrder:**
   - نقل `hydrateOrder` function
   - نقل `useEffect` المتعلقة بـ order loading
   - نقل refs المتعلقة (orderLoadInProgressRef, etc.)

3. **استخراج useInvoice:**
   - نقل `issueInvoice` function
   - نقل `saveDraft` function
   - نقل state المتعلق (items, totals)

4. **استخراج usePayments:**
   - نقل منطق الدفع
   - نقل state المتعلق (paymentMethod, payLines)

5. **استخراج useProducts:**
   - نقل منطق تحميل المنتجات
   - نقل caching logic

---

#### اليوم 3-4: إنشاء Components

**الهدف:** تقسيم UI إلى مكونات أصغر

```javascript
// components/POS/ProductList.jsx
export function ProductList({ products, onAddItem, selectedCategory }) {
  // نقل JSX من POSInvoice.jsx
}

// components/POS/OrderItems.jsx
export function OrderItems({ items, onUpdateItem, onRemoveItem }) {
  // نقل JSX من POSInvoice.jsx
}

// components/POS/CustomerSection.jsx
export function CustomerSection({ customerName, customerPhone, onUpdate }) {
  // نقل JSX من POSInvoice.jsx
}

// components/POS/PaymentSection.jsx
export function PaymentSection({ paymentMethod, payLines, onUpdate }) {
  // نقل JSX من POSInvoice.jsx
}

// components/POS/TotalsSection.jsx
export function TotalsSection({ totals, discountPct, taxPct }) {
  // نقل JSX من POSInvoice.jsx
}
```

**الخطوات:**

1. **إنشاء مجلد components:**
```bash
mkdir -p backend/frontend/src/components/POS
```

2. **استخراج ProductList:**
   - نقل JSX الخاص بقائمة المنتجات
   - نقل منطق الفلترة حسب الفئة
   - نقل `addItem` handler

3. **استخراج OrderItems:**
   - نقل JSX الخاص بعرض الأصناف
   - نقل `updateItem`, `removeItem` handlers

4. **استخراج CustomerSection:**
   - نقل JSX الخاص ببيانات العميل
   - نقل `resolvePartner` logic

5. **استخراج PaymentSection:**
   - نقل JSX الخاص بطريقة الدفع
   - نقل منطق الدفع المتعدد

6. **استخراج TotalsSection:**
   - نقل JSX الخاص بالمجموع
   - نقل `totals` calculation

---

#### اليوم 5-7: تحديث POSInvoice.jsx

**الهدف:** تحويل POSInvoice إلى Container فقط

```javascript
// POSInvoice.jsx (Container)
import { useOrder } from '../hooks/pos/useOrder';
import { useInvoice } from '../hooks/pos/useInvoice';
import { usePayments } from '../hooks/pos/usePayments';
import { ProductList } from '../components/POS/ProductList';
import { OrderItems } from '../components/POS/OrderItems';
import { CustomerSection } from '../components/POS/CustomerSection';
import { PaymentSection } from '../components/POS/PaymentSection';
import { TotalsSection } from '../components/POS/TotalsSection';

export default function POSInvoice() {
  const { order, loading: orderLoading, hydrateOrder } = useOrder(orderId, branch, table);
  const { items, setItems, issueInvoice, saveDraft } = useInvoice();
  const { paymentMethod, setPaymentMethod, payLines, setPayLines } = usePayments();
  
  // فقط state management و orchestration
  // لا منطق معقد هنا
  
  return (
    <div>
      <ProductList products={products} onAddItem={addItem} />
      <OrderItems items={items} onUpdate={updateItem} onRemove={removeItem} />
      <CustomerSection customerName={customerName} customerPhone={customerPhone} />
      <PaymentSection paymentMethod={paymentMethod} payLines={payLines} />
      <TotalsSection totals={totals} />
    </div>
  );
}
```

**النتيجة المتوقعة:**
- تقليل حجم POSInvoice.jsx من 2578 سطر إلى ~300-400 سطر
- تقليل state variables من 30+ إلى ~10
- تقليل refs من 20+ إلى ~5
- تقليل useEffect من 15+ إلى ~5

---

## 🟡 المرحلة 2 – تنظيم الحالة
**المدة:** 7-10 أيام عمل  
**الهدف:** مصدر واحد للحقيقة - تقليل اعتماد localStorage بنسبة 70%

### ✅ المعايير الناجحة
- [ ] Zustand stores تعمل
- [ ] تقليل استخدام localStorage بنسبة 70%
- [ ] جميع الوظائف تعمل كما قبل
- [ ] لا توجد regressions

---

### 3️⃣ إدخال Zustand (4-5 أيام)

#### اليوم 1: تثبيت وإعداد Zustand

```bash
cd backend/frontend
npm install zustand
```

**إنشاء Store الأساسي:**

```javascript
// stores/orderStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOrderStore = create(
  persist(
    (set, get) => ({
      // State
      currentOrder: null,
      orderId: null,
      items: [],
      loading: false,
      
      // Actions
      setOrder: (order) => set({ currentOrder: order, orderId: order?.id }),
      setItems: (items) => set({ items }),
      addItem: (item) => set((state) => ({ 
        items: [...state.items, item] 
      })),
      updateItem: (index, updates) => set((state) => ({
        items: state.items.map((it, i) => 
          i === index ? { ...it, ...updates } : it
        )
      })),
      removeItem: (index) => set((state) => ({
        items: state.items.filter((_, i) => i !== index)
      })),
      clearOrder: () => set({ 
        currentOrder: null, 
        orderId: null, 
        items: [] 
      }),
    }),
    {
      name: 'pos-order-storage',
      // فقط orderId و items - ليس كل شيء
      partialize: (state) => ({ 
        orderId: state.orderId,
        items: state.items 
      }),
    }
  )
);
```

**إنشاء Stores أخرى:**

```javascript
// stores/invoiceStore.js
export const useInvoiceStore = create((set) => ({
  invoice: null,
  setInvoice: (invoice) => set({ invoice }),
  clearInvoice: () => set({ invoice: null }),
}));

// stores/productsStore.js
export const useProductsStore = create((set) => ({
  products: [],
  categories: [],
  loading: false,
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ loading }),
}));

// stores/customerStore.js
export const useCustomerStore = create((set) => ({
  customer: null,
  customerName: '',
  customerPhone: '',
  setCustomer: (customer) => set({ customer }),
  setCustomerName: (name) => set({ customerName: name }),
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
}));
```

---

#### اليوم 2-3: استبدال localStorage في POSInvoice

**قبل:**
```javascript
// استخدام localStorage مباشرة
const storedOrderId = localStorage.getItem(`pos_order_${branch}_${table}`);
localStorage.setItem(`pos_order_${branch}_${table}`, orderId);
```

**بعد:**
```javascript
// استخدام Zustand store
const { orderId, setOrder } = useOrderStore();
setOrder(order);
```

**الخطوات:**

1. **استبدال order state:**
   - استبدال `orderId` state بـ `useOrderStore`
   - استبدال `items` state بـ `useOrderStore`

2. **استبدال products state:**
   - استبدال `products` state بـ `useProductsStore`
   - نقل caching logic إلى store

3. **استبدال customer state:**
   - استبدال `customerName`, `customerPhone` بـ `useCustomerStore`

4. **حذف localStorage calls:**
   - البحث عن جميع `localStorage.getItem/setItem`
   - استبدالها بـ store actions

---

#### اليوم 4-5: تحديث Hooks لاستخدام Stores

**قبل:**
```javascript
// useOrder.js
export function useOrder(orderId, branch, table) {
  const [order, setOrder] = useState(null);
  // ...
}
```

**بعد:**
```javascript
// useOrder.js
import { useOrderStore } from '../../stores/orderStore';

export function useOrder(orderId, branch, table) {
  const { currentOrder, setOrder, items, setItems } = useOrderStore();
  // استخدام store بدلاً من local state
}
```

---

### 4️⃣ توحيد Helpers (3-5 أيام)

#### اليوم 1-2: إنشاء Helpers Module

```javascript
// utils/orderHelpers.js

/**
 * استخراج order_id من مصادر متعددة
 */
export function extractOrderId(orderIdFromURL, branch, table) {
  // منطق موحد لاستخراج order_id
  const normB = (v) => String(v || '').toLowerCase() === 'palace_india' 
    ? 'place_india' 
    : String(v || '').toLowerCase();
  
  if (orderIdFromURL && Number(orderIdFromURL) > 0) {
    return Number(orderIdFromURL);
  }
  
  try {
    const k1 = `pos_order_${branch}_${table}`;
    const k2 = `pos_order_${normB(branch)}_${table}`;
    const stored = localStorage.getItem(k1) || localStorage.getItem(k2);
    if (stored && Number(stored) > 0) {
      return Number(stored);
    }
  } catch {}
  
  return null;
}

/**
 * Parse JSONB lines (array أو string)
 */
export function parseOrderLines(lines) {
  if (Array.isArray(lines)) return lines;
  if (typeof lines === 'string') {
    try {
      return JSON.parse(lines || '[]');
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * حساب المبالغ (subtotal, discount, tax, total)
 */
export function calculateTotals(items, discountPct = 0, taxPct = 15) {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 
    0
  );
  const discBase = subtotal * (Number(discountPct || 0) / 100);
  const rowDisc = safeItems.reduce(
    (s, it) => s + (Number(it.discount || 0) / 100) * (Number(it.qty || 0) * Number(it.price || 0)), 
    0
  );
  const taxable = Math.max(0, subtotal - discBase - rowDisc);
  const tax = taxable * (Number(taxPct || 0) / 100);
  const total = taxable + tax;
  
  return { subtotal, discount: discBase + rowDisc, tax, total };
}

/**
 * Normalize branch name
 */
export function normalizeBranchName(branch) {
  const s = String(branch || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'palace_india' || s === 'palce_india') return 'place_india';
  return s;
}
```

---

#### اليوم 3-5: استبدال الكود المكرر

**البحث عن:**
- جميع أماكن حساب المبالغ
- جميع أماكن parsing JSONB
- جميع أماكن استخراج order_id
- جميع أماكن normalize branch name

**الاستبدال:**
- استبدال الكود المكرر بـ helper functions

---

## 🔵 المرحلة 3 – تحسينات لاحقة
**المدة:** حسب الحاجة  
**الأولوية:** منخفضة (بعد استقرار المرحلتين السابقتين)

### 5️⃣ Caching & Performance
- Redis للـ caching
- React Query للـ data fetching
- Memoization للـ components

### 6️⃣ Security Improvements
- httpOnly cookies
- CSRF protection
- Input validation

### 7️⃣ Testing
- Unit tests للـ services
- Integration tests للـ API
- E2E tests

### 8️⃣ TypeScript Migration
- تدريجي
- بدء بالـ services
- ثم الـ components

---

## 📝 دليل التنفيذ التفصيلي

### Checklist للمرحلة 1

#### تفكيك server.js
- [ ] إنشاء مجلدات routes, controllers, services
- [ ] استخراج auth routes
- [ ] استخراج orders routes
- [ ] استخراج invoices routes
- [ ] استخراج expenses routes
- [ ] استخراج journal routes
- [ ] استخراج pos routes
- [ ] استخراج partners routes
- [ ] استخراج products routes
- [ ] استخراج accounts routes
- [ ] استخراج users routes
- [ ] استخراج settings routes
- [ ] استخراج reports routes
- [ ] تحديث server.js لاستخدام routes
- [ ] اختبار جميع endpoints

#### تفكيك POSInvoice.jsx
- [ ] إنشاء useOrder hook
- [ ] إنشاء useInvoice hook
- [ ] إنشاء usePayments hook
- [ ] إنشاء useProducts hook
- [ ] إنشاء ProductList component
- [ ] إنشاء OrderItems component
- [ ] إنشاء CustomerSection component
- [ ] إنشاء PaymentSection component
- [ ] إنشاء TotalsSection component
- [ ] تحديث POSInvoice.jsx لاستخدام hooks و components
- [ ] اختبار جميع الوظائف

### Checklist للمرحلة 2

#### إدخال Zustand
- [ ] تثبيت zustand
- [ ] إنشاء orderStore
- [ ] إنشاء invoiceStore
- [ ] إنشاء productsStore
- [ ] إنشاء customerStore
- [ ] استبدال localStorage في POSInvoice
- [ ] تحديث hooks لاستخدام stores
- [ ] اختبار جميع الوظائف

#### توحيد Helpers
- [ ] إنشاء orderHelpers.js
- [ ] إنشاء accountingHelpers.js
- [ ] إنشاء branchHelpers.js
- [ ] استبدال الكود المكرر
- [ ] اختبار جميع الوظائف

---

## 🎯 النتائج المتوقعة

### بعد المرحلة 1:
- ✅ server.js: من 7800 سطر → ~200 سطر (setup فقط)
- ✅ POSInvoice.jsx: من 2578 سطر → ~300-400 سطر
- ✅ تقليل الأخطاء المستقبلية: 40-50%
- ✅ سهولة الصيانة: +60%

### بعد المرحلة 2:
- ✅ تقليل استخدام localStorage: 70%
- ✅ مصدر واحد للحقيقة (Stores)
- ✅ تقليل الكود المكرر: 50%
- ✅ سهولة الاختبار: +80%

---

## ⚠️ تحذيرات مهمة

1. **لا تغيير المنطق في المرحلة 1:**
   - فقط نقل الكود
   - لا refactor
   - لا تحسينات

2. **اختبار بعد كل خطوة:**
   - لا تنتظر حتى النهاية
   - اختبر بعد كل ملف
   - تأكد من عدم كسر شيء

3. **استخدم Git branches:**
   - branch منفصل لكل مرحلة
   - commits صغيرة ومتكررة
   - easy rollback

4. **وثق التغييرات:**
   - اكتب ملاحظات في commits
   - وثق أي assumptions
   - وثق أي workarounds

---

## 📚 موارد مفيدة

- [Express Router Documentation](https://expressjs.com/en/guide/routing.html)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React Hooks Best Practices](https://react.dev/reference/react)

---

**تم إعداد الخطة بواسطة:** AI Code Reviewer  
**التاريخ:** 2026-01-20  
**الحالة:** جاهز للتنفيذ ✅
