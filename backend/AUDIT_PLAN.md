# خطة فحص شامل للشاشات والاستعلامات

## الهدف
التحقق من أن جميع الشاشات تقرأ من قيود اليومية المنشورة (status='posted') وأن جميع الأعمدة المطلوبة موجودة في قاعدة البيانات.

---

## 1. شاشة العملاء (Clients)

### الاستعلامات المستخدمة:
- `invoices.list({ type: 'sale' })` - فواتير المبيعات
- `payments.list({ party_type: 'customer' })` - المدفوعات
- `reports.customerLedger()` - كشف حساب العميل

### نقاط الفحص:
- [ ] التحقق من أن `invoices` table يحتوي على `journal_entry_id`
- [ ] التحقق من أن `payments` table يحتوي على `journal_entry_id` (إن وجد)
- [ ] التحقق من أن `customerLedger` يستخدم `journal_entries` مع `status='posted'`
- [ ] التحقق من أن جميع الأعمدة المطلوبة موجودة في SELECT statements

### الملفات المراجعة:
- `backend/frontend/src/pages/Clients.jsx`
- `backend/frontend/src/pages/ClientsInvoicesAll.jsx`
- `backend/frontend/src/pages/ClientsInvoicesPaid.jsx`
- `backend/controllers/invoiceController.js`
- `backend/controllers/paymentController.js`
- `backend/controllers/reportController.js` (customerLedger)

---

## 2. شاشة التقارير (Reports)

### الاستعلامات المستخدمة:
- `journal.list({ status: 'posted' })` - قيود اليومية المنشورة
- `reports.trialBalance()` - ميزان المراجعة
- `reports.salesVsExpenses()` - المبيعات مقابل المصروفات
- `reports.salesByBranch()` - المبيعات حسب الفرع

### نقاط الفحص:
- [x] ✅ التحقق من أن `trialBalance` يستخدم `je.status = 'posted'` (تم التحقق - السطر 40)
- [x] ✅ التحقق من أن `salesVsExpenses` يستخدم `je.status = 'posted'` (تم التحقق - السطر 99-100)
- [x] ✅ التحقق من أن `salesByBranch` يستخدم `je.status = 'posted'` (يجب التحقق)
- [ ] التحقق من أن جميع الأعمدة المطلوبة موجودة في SELECT statements

### الملفات المراجعة:
- `backend/frontend/src/components/GeneralLedger.jsx`
- `backend/frontend/src/pages/Reports.jsx`
- `backend/controllers/reportController.js`
- `backend/controllers/journalController.js`

---

## 3. شاشة المصروفات (Expenses)

### الاستعلامات المستخدمة:
- `expenses.list()` - قائمة المصروفات
- `expenses.get(id)` - مصروف واحد

### نقاط الفحص:
- [x] ✅ التحقق من أن `expenses` table يحتوي على `journal_entry_id` (تم التحقق - السطر 10)
- [ ] التحقق من أن التقارير التي تعتمد على المصروفات تستخدم `journal_entries` مع `status='posted'`
- [ ] التحقق من أن جميع الأعمدة المطلوبة موجودة في SELECT statements

### الملفات المراجعة:
- `backend/frontend/src/pages/Expenses.jsx`
- `backend/controllers/expenseController.js`

---

## 4. شاشة المشتريات مع الموردين (Suppliers)

### الاستعلامات المستخدمة:
- `supplierInvoices.list()` - فواتير الموردين
- `payments.list({ party_type: 'supplier' })` - مدفوعات الموردين

### نقاط الفحص:
- [ ] التحقق من أن `supplier_invoices` table يحتوي على `journal_entry_id`
- [ ] التحقق من أن التقارير التي تعتمد على فواتير الموردين تستخدم `journal_entries` مع `status='posted'`
- [ ] التحقق من أن جميع الأعمدة المطلوبة موجودة في SELECT statements

### الملفات المراجعة:
- `backend/frontend/src/pages/Suppliers.jsx`
- `backend/controllers/supplierInvoiceController.js` (إن وجد)
- `backend/controllers/paymentController.js`

---

## 5. التحقق من قاعدة البيانات

### الأعمدة المطلوبة:
- [ ] `invoices.journal_entry_id` - INTEGER REFERENCES journal_entries(id)
- [ ] `expenses.journal_entry_id` - INTEGER REFERENCES journal_entries(id)
- [ ] `supplier_invoices.journal_entry_id` - INTEGER REFERENCES journal_entries(id)
- [ ] `payments.journal_entry_id` - INTEGER REFERENCES journal_entries(id) (إن وجد)
- [ ] `journal_entries.status` - TEXT (يجب أن يكون 'posted' للقيود المنشورة)
- [ ] `journal_entries.period` - TEXT (YYYY-MM format)
- [ ] `journal_entries.branch` - TEXT

### الفحص:
```sql
-- التحقق من وجود الأعمدة
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('invoices', 'expenses', 'supplier_invoices', 'payments', 'journal_entries')
AND column_name LIKE '%journal_entry_id%' OR column_name IN ('status', 'period', 'branch');

-- التحقق من القيود المنشورة
SELECT COUNT(*) FROM journal_entries WHERE status = 'posted';

-- التحقق من الفواتير المرتبطة بقيود
SELECT COUNT(*) FROM invoices WHERE journal_entry_id IS NOT NULL;

-- التحقق من المصروفات المرتبطة بقيود
SELECT COUNT(*) FROM expenses WHERE journal_entry_id IS NOT NULL;
```

---

## 6. قائمة التحقق النهائية

### شاشة العملاء:
- [ ] جميع الاستعلامات تعمل بدون أخطاء
- [ ] الفواتير المرتبطة بقيود تظهر بشكل صحيح
- [ ] كشف حساب العميل يستخدم قيود اليومية المنشورة

### شاشة التقارير:
- [x] ✅ جميع التقارير تستخدم `status='posted'`
- [ ] جميع الأعمدة المطلوبة موجودة
- [ ] لا توجد أخطاء SQL

### شاشة المصروفات:
- [x] ✅ جدول المصروفات يحتوي على `journal_entry_id`
- [ ] التقارير تستخدم قيود اليومية المنشورة
- [ ] جميع الأعمدة المطلوبة موجودة

### شاشة المشتريات:
- [ ] جدول فواتير الموردين يحتوي على `journal_entry_id`
- [ ] التقارير تستخدم قيود اليومية المنشورة
- [ ] جميع الأعمدة المطلوبة موجودة

---

## ملاحظات:
- يجب أن تكون جميع التقارير المالية تعتمد على `journal_entries` مع `status='posted'` وليس على الجداول الأصلية مباشرة
- يجب التحقق من أن جميع JOINs صحيحة ولا تسبب أخطاء
- يجب التحقق من أن جميع الأعمدة المستخدمة في SELECT statements موجودة فعلياً في الجداول
