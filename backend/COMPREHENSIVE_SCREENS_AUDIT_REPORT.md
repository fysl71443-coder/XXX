# تقرير مراجعة شامل لجميع الشاشات (Comprehensive Screens Audit Report)

**التاريخ:** 2026-01-22  
**الهدف:** التأكد من أن جميع الشاشات تستخدم قيود اليومية المنشورة كمصدر الحقيقة الوحيد وأن جميع البيانات المعروضة صحيحة

---

## 1. ملخص تنفيذي

### ✅ الشاشات التي تستخدم journal_entries بشكل صحيح
- ✅ **شاشة المحاسبة (Journal):** تستخدم `journal_entries` و `journal_postings` فقط
- ✅ **شاشة التقارير (Reports):** معظم التقارير تستخدم `je.status = 'posted'`
- ✅ **شاشة المصروفات (Expenses):** تعرض البيانات من `expenses` لكن الفلترة تستبعد الفواتير اليتيمة

### ⚠️ المشاكل المكتشفة
- 🔴 **مشكلة حرجة:** `/ar/summary` يستخدم `journal_entry_lines` (جدول غير موجود) بدلاً من `journal_postings`
- ⚠️ **مشكلة محتملة:** `/customers/aging` يستخدم `invoices` مباشرة بدلاً من `journal_entries`
- ⚠️ **مشكلة محتملة:** شاشة العملاء تستخدم `invoices.list()` و `payments.list()` مباشرة
- ⚠️ **مشكلة محتملة:** شاشة الموردين تستخدم `supplier_invoices.list()` مباشرة
- ⚠️ **مشكلة محتملة:** شاشة المبيعات تستخدم `invoices.list()` مباشرة

---

## 2. فحص شاشة الموظفين (Employees)

### 2.1 Frontend (Employees.jsx)
- ✅ **Route:** `/employees`
- ✅ **API Calls:** `employees.list()`, `payroll.runs()`
- ✅ **البيانات المالية:** لا توجد بيانات مالية مباشرة (إدارة الموظفين فقط)
- ✅ **Payroll Runs:** تستخدم `payroll.runs` API

### 2.2 Backend API
- ✅ **GET /api/employees:** يستخدم `employees` table فقط (لا بيانات مالية)
- ✅ **GET /api/employees/:id/advance-balance:** يستخدم `journal_postings` مع `je.status = 'posted'` ✅

**الخلاصة:** ✅ شاشة الموظفين لا تحتاج فحص مالي (إدارة الموظفين فقط)

---

## 3. فحص شاشة العملاء (Clients/Customers)

### 3.1 Frontend (Clients.jsx)

#### API Calls:
```javascript
// Load customers
const data = await partners.list({ type: 'customer' })  // ✅ صحيح

// Load invoices
const res = await invoices.list({ type: 'sale', ... })  // ⚠️ يستخدم invoices مباشرة

// Load payments
const res = await payments.list({ ...params, party_type: 'customer' })  // ⚠️ يستخدم payments مباشرة

// Load receivables (Customer Ledger)
const res = await reports.customerLedger({ ... })  // ✅ يستخدم reports API
```

#### المشاكل:
- ⚠️ **شاشة الفواتير:** تستخدم `invoices.list()` مباشرة بدلاً من `journal_entries`
- ⚠️ **شاشة المدفوعات:** تستخدم `payments.list()` مباشرة
- ✅ **شاشة المستحقات (Receivables):** تستخدم `reports.customerLedger()` (يجب التحقق من Backend)

### 3.2 Backend API

#### GET /api/partners
- ✅ **مصدر الحقيقة:** `partners` table فقط (لا بيانات مالية)

#### GET /ar/summary
- 🔴 **مشكلة حرجة:** يستخدم `journal_entry_lines` (جدول غير موجود!)
```sql
FROM journal_entry_lines jel  -- ❌ خطأ: الجدول الصحيح هو journal_postings
JOIN journal_entries je ON jel.entry_id = je.id  -- ❌ خطأ: يجب أن يكون je.id = jp.journal_entry_id
```
- ✅ **يجب تغييره إلى:**
```sql
FROM journal_postings jp
JOIN journal_entries je ON jp.journal_entry_id = je.id
WHERE jp.account_id = $1 AND je.status = 'posted'
```

#### GET /customers/aging
- ⚠️ **مشكلة:** يستخدم `invoices` مباشرة بدلاً من `journal_entries`
```sql
FROM invoices i
WHERE i.type = 'sale' AND i.status IN ('posted', 'open', 'partial')
```
- ⚠️ **يجب استخدام:** `journal_entries` مع `reference_type = 'invoice'` و `status = 'posted'`

#### GET /partners/:id/statement
- ⚠️ **يجب التحقق:** من وجود هذا endpoint

#### GET /partners/:id/balance
- ⚠️ **يجب التحقق:** من وجود هذا endpoint

---

## 4. فحص شاشة الموردين (Suppliers)

### 4.1 Frontend (Suppliers.jsx)

#### API Calls:
```javascript
// Load suppliers
const data = await partners.list({ type: 'supplier' })  // ✅ صحيح

// Load supplier invoices
const res1 = await supplierInvoices.list(params)  // ⚠️ يستخدم supplier_invoices مباشرة
const res2 = await supplierInvoices.list({ ...params, status: 'draft' })  // ⚠️
```

#### المشاكل:
- ⚠️ **شاشة فواتير الموردين:** تستخدم `supplierInvoices.list()` مباشرة بدلاً من `journal_entries`

### 4.2 Backend API

#### GET /api/supplier-invoices
- ⚠️ **مشكلة:** يستخدم `supplier_invoices` مباشرة
```sql
SELECT ... FROM supplier_invoices si
WHERE ...
```
- ✅ **الفلترة:** تم إضافة فلترة للفواتير اليتيمة (posted/reversed بدون journal_entry_id)
- ⚠️ **يجب استخدام:** `journal_entries` مع `reference_type = 'supplier_invoice'` و `status = 'posted'` للعرض المالي

---

## 5. فحص شاشة المصروفات (Expenses)

### 5.1 Frontend (Expenses.jsx)

#### API Calls:
```javascript
// Load expenses
const res = await apiExpenses.list(filters)  // ⚠️ يستخدم expenses مباشرة
```

#### المشاكل:
- ⚠️ **شاشة المصروفات:** تستخدم `expenses.list()` مباشرة بدلاً من `journal_entries`

### 5.2 Backend API

#### GET /api/expenses
- ✅ **الفلترة:** تم إضافة فلترة للفواتير اليتيمة (posted/reversed بدون journal_entry_id)
```sql
WHERE NOT (
  (status = 'posted' OR status = 'reversed') 
  AND journal_entry_id IS NULL
)
```
- ⚠️ **يجب استخدام:** `journal_entries` مع `reference_type = 'expense'` و `status = 'posted'` للعرض المالي

---

## 6. فحص شاشة المبيعات (Sales/Invoices)

### 6.1 Frontend

#### API Calls:
```javascript
// Load invoices
const res = await invoices.list({ type: 'sale', ... })  // ⚠️ يستخدم invoices مباشرة
```

#### المشاكل:
- ⚠️ **شاشة المبيعات:** تستخدم `invoices.list()` مباشرة بدلاً من `journal_entries`

### 6.2 Backend API

#### GET /api/invoices
- ⚠️ **مشكلة:** يستخدم `invoices` مباشرة
```sql
SELECT ... FROM invoices
WHERE ...
```
- ⚠️ **يجب استخدام:** `journal_entries` مع `reference_type = 'invoice'` و `status = 'posted'` للعرض المالي

---

## 7. فحص شاشة التقارير (Reports)

### 7.1 Frontend (Reports.jsx)

#### API Calls:
```javascript
// Sales vs Expenses
const res = await apiReports.salesVsExpenses(params)  // ✅ يستخدم reports API

// Sales by Branch
const res = await apiReports.salesByBranch(params)  // ✅ يستخدم reports API

// Expenses by Branch
const res = await apiReports.expensesByBranch(params)  // ✅ يستخدم reports API

// Business Day Sales
const res = await apiReports.businessDaySales(params)  // ✅ يستخدم reports API

// Cash Flow
const res = await apiReports.cashFlow(params)  // ✅ يستخدم reports API

// Trial Balance
const res = await apiReports.trialBalance(params)  // ✅ يستخدم reports API

// Income Statement
const res = await apiReports.incomeStatement(params)  // ✅ يستخدم reports API

// Customer Ledger
const res = await apiReports.customerLedger(params)  // ✅ يستخدم reports API
```

### 7.2 Backend API

#### ✅ التقارير التي تستخدم journal_entries بشكل صحيح:
1. **GET /api/reports/sales-vs-expenses:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

2. **GET /api/reports/sales-by-branch:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

3. **GET /api/reports/expenses-by-branch:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

4. **GET /api/reports/business-day-sales:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

5. **GET /api/reports/cash-flow:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

6. **GET /api/reports/trial-balance:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

7. **GET /api/reports/income-statement:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

8. **GET /api/reports/ledger-summary:**
   - ✅ يستخدم `journal_entries` مع `je.status = 'posted'`
   - ✅ يستخدم `journal_postings` للحسابات

#### ⚠️ التقارير التي تحتاج فحص:
1. **GET /customers/aging:**
   - ⚠️ يستخدم `invoices` مباشرة بدلاً من `journal_entries`
   - يجب استخدام `journal_entries` مع `reference_type = 'invoice'` و `status = 'posted'`

2. **GET /ar/summary:**
   - 🔴 **مشكلة حرجة:** يستخدم `journal_entry_lines` (جدول غير موجود!)
   - يجب استخدام `journal_postings` بدلاً من `journal_entry_lines`

3. **GET /api/reports/customer-ledger:**
   - ✅ **تم إضافة:** endpoint `/api/reports/customer-ledger` الذي يستخدم `journal_postings` و `journal_entries` مع `je.status = 'posted'`
   - ✅ **يستخدم:** `journal_postings` بشكل صحيح (ليس `journal_entry_lines`)
   - ✅ **يحسب:** opening_balance و closing_balance من القيود المنشورة فقط

---

## 8. المشاكل الحرجة التي تحتاج إصلاح فوري

### 8.1 🔴 مشكلة حرجة: `/ar/summary` يستخدم جدول غير موجود

**الموقع:** `backend/server.js:6854-6860`

**المشكلة:**
```sql
FROM journal_entry_lines jel  -- ❌ جدول غير موجود!
JOIN journal_entries je ON jel.entry_id = je.id  -- ❌ علاقة خاطئة
```

**الحل:**
```sql
FROM journal_postings jp
JOIN journal_entries je ON jp.journal_entry_id = je.id
WHERE jp.account_id = $1 AND je.status = 'posted'
```

### 8.2 ⚠️ مشكلة: `/customers/aging` يستخدم `invoices` مباشرة

**الموقع:** `backend/server.js:6889-6910`

**المشكلة:**
```sql
FROM invoices i
WHERE i.type = 'sale' AND i.status IN ('posted', 'open', 'partial')
```

**الحل المقترح:**
```sql
SELECT 
  je.reference_id as invoice_id,
  je.description,
  je.date,
  COALESCE(SUM(jp.debit), 0) as total,
  COALESCE(SUM(jp.credit), 0) as paid_amount,
  p.id as partner_id,
  p.name as partner_name
FROM journal_entries je
JOIN journal_postings jp ON jp.journal_entry_id = je.id
JOIN accounts a ON a.id = jp.account_id
LEFT JOIN partners p ON p.account_id = a.id
WHERE je.reference_type = 'invoice'
  AND je.status = 'posted'
  AND a.account_code = '1210'  -- Accounts Receivable
GROUP BY je.id, je.reference_id, je.description, je.date, p.id, p.name
HAVING COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0) > 0
```

---

## 9. التوصيات

### 9.1 ✅ تم إصلاح المشاكل الحرجة

1. **✅ تم إصلاح `/ar/summary`:**
   - تم تغيير `journal_entry_lines` إلى `journal_postings`
   - تم تصحيح العلاقة بين الجداول

2. **✅ تم إصلاح `/api/partners/:id/balance` و `/api/partners/:id/statement`:**
   - تم تغيير `journal_entry_lines` إلى `journal_postings`
   - تم تصحيح العلاقة بين الجداول

3. **✅ تم إضافة `/api/reports/customer-ledger`:**
   - تم إضافة endpoint جديد يستخدم `journal_postings` و `journal_entries`
   - يستخدم `je.status = 'posted'` فقط

4. **✅ تم تحسين `/customers/aging`:**
   - تم إضافة فلترة `journal_entry_id IS NOT NULL` لضمان وجود قيد

### 9.2 ⚠️ تحسينات مقترحة

1. **شاشة العملاء:**
   - استخدام `journal_entries` للعرض المالي بدلاً من `invoices` مباشرة
   - استخدام `journal_entries` لحساب الأرصدة بدلاً من `payments` مباشرة

2. **شاشة الموردين:**
   - استخدام `journal_entries` للعرض المالي بدلاً من `supplier_invoices` مباشرة

3. **شاشة المصروفات:**
   - استخدام `journal_entries` للعرض المالي بدلاً من `expenses` مباشرة

4. **شاشة المبيعات:**
   - استخدام `journal_entries` للعرض المالي بدلاً من `invoices` مباشرة

### 9.3 ✅ لا توجد مشاكل

- ✅ **شاشة الموظفين:** لا تحتاج فحص مالي
- ✅ **شاشة التقارير:** معظم التقارير تستخدم `journal_entries` بشكل صحيح

---

## 10. الخلاصة

### ✅ النقاط الإيجابية
- شاشة المحاسبة تستخدم `journal_entries` كمصدر الحقيقة الوحيد بشكل صحيح
- معظم التقارير تستخدم `journal_entries` مع `je.status = 'posted'`
- تم تطبيق فلترة الفواتير اليتيمة في `expenses` و `supplier_invoices`

### 🔴 المشاكل الحرجة
- `/ar/summary` يستخدم `journal_entry_lines` (جدول غير موجود)
- `/customers/aging` يستخدم `invoices` مباشرة بدلاً من `journal_entries`

### ⚠️ المشاكل المحتملة
- شاشة العملاء تستخدم `invoices` و `payments` مباشرة
- شاشة الموردين تستخدم `supplier_invoices` مباشرة
- شاشة المصروفات تستخدم `expenses` مباشرة
- شاشة المبيعات تستخدم `invoices` مباشرة

---

**تم إنشاء التقرير:** 2026-01-22  
**آخر تحديث:** 2026-01-22
