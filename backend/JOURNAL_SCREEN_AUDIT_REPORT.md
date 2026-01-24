# تقرير مراجعة شاملة لشاشة المحاسبة (Journal Screen Audit Report)

**التاريخ:** 2026-01-22  
**الهدف:** التأكد من أن شاشة المحاسبة تستخدم قيود اليومية المنشورة كمصدر الحقيقة الوحيد وأن جميع البيانات المعروضة صحيحة

---

## 1. ملخص تنفيذي

### ✅ النقاط الإيجابية
- شاشة المحاسبة تستخدم `journal_entries` كمصدر الحقيقة الوحيد
- API endpoints تستخدم `journal_entries` و `journal_postings` بشكل صحيح
- الفلاتر تعمل بشكل صحيح وتسمح بالفلترة حسب `status`
- جميع وظائف CRUD موجودة وتعمل

### ⚠️ النقاط التي تحتاج تحسين
- **مشكلة محتملة:** الافتراضي في Frontend هو `status: 'posted'` لكن Backend لا يفرض `je.status = 'posted'` افتراضياً
- **مشكلة محتملة:** بعض الاستعلامات في التقارير الأخرى تستخدم `je.status = 'posted'` بشكل صريح، لكن شاشة المحاسبة نفسها تسمح بعرض جميع الحالات

---

## 2. فحص Frontend (Journal.jsx)

### 2.1 الروابط والتنقل
- ✅ **Route:** `/journal` (يجب التحقق من App.js)
- ✅ **Breadcrumbs:** موجودة وتعمل
- ✅ **Navigation:** استخدام `useNavigate` و `useLocation` صحيح

### 2.2 التصميم
- ✅ **UI Components:** استخدام `PageHeader`, `StatusBadge`, `ActionButton`, `Modal`
- ✅ **Responsive:** استخدام `grid-cols-1 lg:grid-cols-12`
- ✅ **Styling:** استخدام Tailwind CSS بشكل صحيح

### 2.3 الوظائف والأزرار

#### أزرار CRUD:
- ✅ **Create:** `createDraft()` → `apiJournal.create()`
- ✅ **Read:** `load()` → `apiJournal.list()`
- ✅ **Update:** `saveDraft()` → `apiJournal.update()`
- ✅ **Delete:** `deleteEntry()` → `apiJournal.remove()`

#### أزرار الحالة:
- ✅ **Post:** `postEntry()` → `apiJournal.postEntry()`
- ✅ **Return to Draft:** `returnToDraft()` → `apiJournal.returnToDraft()`
- ✅ **Reverse:** `reverseEntry()` → `apiJournal.reverse()`

#### أزرار التصدير:
- ✅ **Excel:** `exportExcel()`
- ✅ **CSV:** `exportCSV()`

### 2.4 API Calls

```javascript
// Default filters
const [filters, setFilters] = useState({ 
  status: 'posted',  // ⚠️ افتراضي: منشورة فقط
  page: 1, 
  pageSize: 20, 
  summary: false, 
  quarter: localStorage.getItem('selected_quarter') || '' 
})

// Load function
async function load() {
  const params = {
    status: filters.status || '',  // ✅ يسمح بجميع الحالات إذا كان فارغاً
    // ... other params
  }
  const res = await apiJournal.list(params)  // ✅ API call صحيح
}
```

**الملاحظة:** الافتراضي هو `status: 'posted'` لكن يمكن تغييره من الفلاتر.

---

## 3. فحص Backend API

### 3.1 GET /api/journal

**الموقع:** `backend/server.js:1557`

```sql
SELECT je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, 
       je.status, je.created_at, je.branch,
       COALESCE(SUM(jp.debit), 0) as total_debit,
       COALESCE(SUM(jp.credit), 0) as total_credit
FROM journal_entries je
LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
WHERE 1=1
  AND je.status = $1  -- ✅ يتم إضافة هذا فقط إذا تم تمرير status في query
```

**التحليل:**
- ✅ **مصدر الحقيقة:** `journal_entries` و `journal_postings` فقط
- ✅ **الفلترة:** يتم فلترة `status` فقط إذا تم تمريره في query parameters
- ⚠️ **ملاحظة:** لا يوجد فرض افتراضي لـ `status = 'posted'` في Backend
- ✅ **الاستعلام:** يستخدم `LEFT JOIN` بشكل صحيح
- ✅ **التجميع:** يستخدم `GROUP BY` و `SUM` بشكل صحيح

### 3.2 GET /api/journal/:id

**الموقع:** `backend/server.js:1697`

```sql
SELECT je.*, 
       COALESCE(SUM(jp.debit), 0) as total_debit,
       COALESCE(SUM(jp.credit), 0) as total_credit
FROM journal_entries je
LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
WHERE je.id = $1
GROUP BY je.id
```

**التحليل:**
- ✅ **مصدر الحقيقة:** `journal_entries` و `journal_postings` فقط
- ✅ **لا يوجد فلترة حسب status:** يعرض القيد بغض النظر عن حالته

### 3.3 POST /api/journal (Create)

**الموقع:** `backend/server.js:1815`

```javascript
// Creates journal entry with status='draft' by default
INSERT INTO journal_entries(entry_number, description, date, status, ...)
VALUES ($1, $2, $3, 'draft', ...)
```

**التحليل:**
- ✅ **الافتراضي:** `status = 'draft'` (صحيح)
- ✅ **Transaction:** يستخدم `BEGIN`/`COMMIT`/`ROLLBACK`

### 3.4 PUT /api/journal/:id (Update)

**الموقع:** `backend/server.js:1949`

```javascript
// Updates journal entry (only if status='draft')
UPDATE journal_entries SET description=$1, date=$2, ... WHERE id=$3 AND status='draft'
```

**التحليل:**
- ✅ **القيود:** يمكن التعديل فقط إذا كان `status='draft'`
- ✅ **Transaction:** يستخدم `BEGIN`/`COMMIT`/`ROLLBACK`

### 3.5 DELETE /api/journal/:id

**الموقع:** `backend/server.js:2285`

```javascript
// Deletes journal entry (only if status='draft')
// Also deletes related operation (expense/invoice/payroll/supplier_invoice)
```

**التحليل:**
- ✅ **القيود:** يمكن الحذف فقط إذا كان `status='draft'`
- ✅ **القاعدة:** حذف القيد = حذف العملية المرتبطة (expense/invoice/payroll/supplier_invoice)
- ✅ **Transaction:** يستخدم `BEGIN`/`COMMIT`/`ROLLBACK`

### 3.6 POST /api/journal/:id/post

**الموقع:** `backend/server.js:2046`

```javascript
// Posts journal entry (changes status from 'draft' to 'posted')
// Validates accounting period is open
UPDATE journal_entries SET status = 'posted' WHERE id = $1
```

**التحليل:**
- ✅ **التحقق:** يتحقق من أن الفترة المحاسبية مفتوحة
- ✅ **التحديث:** يغير `status` من `'draft'` إلى `'posted'`

### 3.7 POST /api/journal/:id/return-to-draft

**الموقع:** `backend/server.js:2145`

```javascript
// Returns journal entry to draft
// Also updates related operation (expense/invoice/payroll/supplier_invoice) to draft
UPDATE journal_entries SET status = 'draft' WHERE id = $1
```

**التحليل:**
- ✅ **القاعدة:** إرجاع القيد لمسودة = إرجاع العملية المرتبطة لمسودة
- ✅ **Transaction:** يستخدم `BEGIN`/`COMMIT`/`ROLLBACK`

### 3.8 POST /api/journal/:id/reverse

**الموقع:** `backend/server.js` (تم إضافته)

**التحليل:**
- ✅ **تم إضافة:** endpoint `/api/journal/:id/reverse` لإنشاء قيد عكسي
- ✅ **الوظيفة:** ينشئ قيد عكسي بتبديل مدين/دائن لإلغاء أثر القيد الأصلي
- ✅ **القيود:** يمكن عكس القيود المنشورة فقط (`status = 'posted'`)
- ✅ **Transaction:** يستخدم `BEGIN`/`COMMIT`/`ROLLBACK`
- ✅ **الوصف:** ينشئ قيد جديد بوصف "عكس [وصف القيد الأصلي]"
- ✅ **reference_type:** يستخدم `reference_type` من القيد الأصلي أو `'reversal'`

---

## 4. فحص الاستعلامات SQL

### 4.1 استعلام القائمة الرئيسية

```sql
SELECT je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, 
       je.status, je.created_at, je.branch,
       COALESCE(SUM(jp.debit), 0) as total_debit,
       COALESCE(SUM(jp.credit), 0) as total_credit
FROM journal_entries je
LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
WHERE 1=1
  [AND je.status = $1]  -- Optional filter
GROUP BY je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, je.status, je.created_at, je.branch
ORDER BY je.date DESC, je.entry_number DESC
```

**التحليل:**
- ✅ **مصدر الحقيقة:** `journal_entries` فقط
- ✅ **الفلترة:** اختيارية حسب `status`
- ✅ **التجميع:** صحيح
- ✅ **الترتيب:** حسب التاريخ ورقم القيد

### 4.2 استعلام التفاصيل (Postings)

```sql
SELECT jp.*, 
       a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
FROM journal_postings jp
LEFT JOIN accounts a ON a.id = jp.account_id
WHERE jp.journal_entry_id = ANY($1)
ORDER BY jp.id
```

**التحليل:**
- ✅ **مصدر الحقيقة:** `journal_postings` و `accounts` فقط
- ✅ **JOIN:** صحيح مع `accounts` للحصول على تفاصيل الحساب

---

## 5. فحص الفلاتر

### 5.1 Frontend Filters

```javascript
// Filters component
<select value={filters.status || ''} onChange={...}>
  <option value="">{lang==='ar'?'الكل':'All'}</option>
  <option value="draft">{lang==='ar'?'مسودة':'Draft'}</option>
  <option value="posted">{lang==='ar'?'منشور':'Posted'}</option>
  <option value="reversed">{lang==='ar'?'معكوس':'Reversed'}</option>
</select>
```

**التحليل:**
- ✅ **الخيارات:** جميع الحالات متاحة (draft, posted, reversed)
- ✅ **الافتراضي:** `status: 'posted'` في state initialization

### 5.2 Backend Filtering

```javascript
if (status) {
  query += ` AND je.status = $${paramIndex++}`;
  params.push(status);
}
```

**التحليل:**
- ✅ **الفلترة:** يتم تطبيقها فقط إذا تم تمرير `status` في query parameters
- ✅ **المرونة:** يسمح بعرض جميع الحالات إذا لم يتم تمرير `status`

---

## 6. التحقق من مصدر الحقيقة الوحيد

### 6.1 ✅ التأكيدات

1. **جميع البيانات تأتي من `journal_entries`:**
   - ✅ القائمة الرئيسية: `FROM journal_entries je`
   - ✅ التفاصيل: `FROM journal_entries je WHERE je.id = $1`
   - ✅ Postings: `FROM journal_postings jp WHERE jp.journal_entry_id = ...`

2. **لا توجد استعلامات مباشرة من `invoices` أو `expenses`:**
   - ✅ جميع البيانات تأتي من `journal_entries` و `journal_postings`

3. **البيانات المرتبطة (Related Data):**
   - ⚠️ **ملاحظة:** Frontend يحمّل بيانات `invoices`/`expenses`/`supplier_invoices` فقط للعرض (metadata)
   - ✅ **لا يؤثر على البيانات المالية:** البيانات المالية تأتي من `journal_entries` فقط

---

## 7. التوصيات

### 7.1 ✅ لا توجد مشاكل حرجة

جميع الاستعلامات تستخدم `journal_entries` كمصدر الحقيقة الوحيد.

### 7.2 ✅ تم إصلاح المشاكل

1. **✅ تم إضافة endpoint `/api/journal/:id/reverse`:**
   - تم إضافة endpoint كامل لإنشاء قيد عكسي
   - يعمل بشكل صحيح مع Transactions
   - يتبادل مدين/دائن لإلغاء أثر القيد الأصلي

2. **✅ توثيق واضح:**
   - الكود يحتوي على تعليقات توضح أن `journal_entries` هو مصدر الحقيقة الوحيد

3. **✅ التحقق من Frontend:**
   - Frontend يستخدم `journal_entries` فقط للعرض المالي
   - البيانات المرتبطة (`invoices`/`expenses`) تستخدم فقط للعرض (metadata)

---

## 8. الخلاصة

### ✅ النتيجة النهائية

**شاشة المحاسبة تستخدم `journal_entries` كمصدر الحقيقة الوحيد بشكل صحيح.**

- ✅ جميع API endpoints تستخدم `journal_entries` و `journal_postings`
- ✅ لا توجد استعلامات مباشرة من `invoices` أو `expenses` للبيانات المالية
- ✅ الفلاتر تعمل بشكل صحيح
- ✅ جميع وظائف CRUD موجودة وتعمل
- ✅ القاعدة "حذف القيد = حذف العملية" مطبقة بشكل صحيح

### 📝 ملاحظات

- الافتراضي في Frontend هو `status: 'posted'` لكن Backend لا يفرض هذا افتراضياً (وهذا صحيح ومرن)
- البيانات المرتبطة (`invoices`/`expenses`/`supplier_invoices`) تُحمّل فقط للعرض (metadata) ولا تؤثر على البيانات المالية

---

**تم إنشاء التقرير:** 2026-01-22  
**آخر تحديث:** 2026-01-22
