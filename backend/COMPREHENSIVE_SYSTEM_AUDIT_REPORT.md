# تقرير الفحص الشامل للنظام

**تاريخ الفحص:** 2026-01-19T15:18:30.365Z

## 📊 الملخص التنفيذي

- **إجمالي الشاشات المفحوصة:** 11
- **إجمالي المشاكل:** 39
  - 🔴 عالية الخطورة: 25
  - 🟡 متوسطة الخطورة: 14
  - ⚪ تحذيرات: 0
- **Backend Endpoints تحتاج مراجعة:** 36

## 📱 تفاصيل الشاشات

### accounting - المحاسبة - ميزان المراجعة، دفتر الأستاذ، كشف الحساب، إقرار ضريبة القيمة المضافة

**الملفات:** 5
**استدعاءات API:** 13
**استعلامات SQL:** 0
**المشاكل:** 2

#### المشاكل:

- **🔴 عالية:** استدعاء apiReports.trialBalance لا يحدد status='posted' صراحة
  - الملف: `components/TrialBalance.jsx`, السطر: 23
- **🔴 عالية:** استدعاء apiReports.trialBalance لا يحدد status='posted' صراحة
  - الملف: `components/TrialBalance.jsx`, السطر: 23

#### استدعاءات API:

- `apiJournal.list`
- `apiReports.trialBalance`
- `apiSettings.get`

### journal - القيود اليومية

**الملفات:** 1
**استدعاءات API:** 25
**استعلامات SQL:** 0
**المشاكل:** 4

#### المشاكل:

- **🔴 عالية:** استدعاء apiJournal.list لا يحدد status='posted' صراحة
  - الملف: `pages/Journal.jsx`, السطر: 335
- **🔴 عالية:** استدعاء apiJournal.list لا يحدد status='posted' صراحة
  - الملف: `pages/Journal.jsx`, السطر: 610
- **🔴 عالية:** استدعاء apiJournal.list لا يحدد status='posted' صراحة
  - الملف: `pages/Journal.jsx`, السطر: 335
- **🔴 عالية:** استدعاء apiJournal.list لا يحدد status='posted' صراحة
  - الملف: `pages/Journal.jsx`, السطر: 610

#### استدعاءات API:

- `apiJournal.list`
- `apiJournal.get`
- `apiInvoices.get`
- `apiOrders.get`
- `apiExpenses.get`
- `apiPeriods.get`
- `apiSettings.get`
- `apiJournal.update`
- `apiJournal.create`
- `apiJournal.remove`
- `supplierInvoices.get`

### clients - العملاء - القوائم، أعمار الديون، المستحقات، الفواتير، كشف الحساب

**الملفات:** 6
**استدعاءات API:** 22
**استعلامات SQL:** 0
**المشاكل:** 6

#### المشاكل:

- **🟡 متوسطة:** استدعاء apiPayments.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/ClientsInvoicesPaid.jsx`, السطر: 11
- **🟡 متوسطة:** استدعاء apiPayments.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/ClientsInvoicesPaid.jsx`, السطر: 11
- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `components/ClientStatement.jsx`, السطر: 39
- **🟡 متوسطة:** استدعاء apiPayments.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `components/ClientStatement.jsx`, السطر: 45
- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `components/ClientStatement.jsx`, السطر: 39
- **🟡 متوسطة:** استدعاء apiPayments.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `components/ClientStatement.jsx`, السطر: 45

#### استدعاءات API:

- `partners.list`
- `partners.create`
- `payments.list`
- `invoices.list`
- `partners.update`
- `partners.remove`
- `customers.aging`
- `apiPartners.list`
- `apiPayments.list`
- `apiInvoices.list`

### suppliers - الموردون - القوائم، فواتير الموردين

**الملفات:** 2
**استدعاءات API:** 26
**استعلامات SQL:** 0
**المشاكل:** 0

#### استدعاءات API:

- `apiSettings.get`
- `partners.list`
- `supplierInvoices.list`
- `payments.list`
- `supplierInvoices.get`
- `invoices.get`
- `products.list`
- `supplierInvoices.create`
- `accounts.create`

### employees - الموظفون - القوائم، سداد الرواتب، كشوف الرواتب

**الملفات:** 3
**استدعاءات API:** 34
**استعلامات SQL:** 0
**المشاكل:** 11

#### المشاكل:

- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 46
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 464
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 465
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 480
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 491
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 46
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 464
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 465
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 480
- **🔴 عالية:** استدعاء apiEmployees.advanceBalance لا يحدد status='posted' صراحة
  - الملف: `pages/PayrollPayments.jsx`, السطر: 491
- **🔴 عالية:** استعلام SQL مباشر على جدول salary - يجب استخدام القيود المنشورة بدلاً من ذلك
  - الملف: `pages/PayrollPayments.jsx`, السطر: 464

#### استدعاءات API:

- `apiEmployees.list`
- `apiEmployees.advanceBalance`
- `apiSettings.get`

### expenses - المصروفات

**الملفات:** 1
**استدعاءات API:** 27
**استعلامات SQL:** 0
**المشاكل:** 4

#### المشاكل:

- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/Expenses.jsx`, السطر: 879
- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/Expenses.jsx`, السطر: 982
- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/Expenses.jsx`, السطر: 879
- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/Expenses.jsx`, السطر: 982

#### استدعاءات API:

- `apiExpenses.list`
- `apiPeriods.get`
- `apiPartners.list`
- `apiSupplierInvoices.list`
- `apiExpenses.get`
- `apiExpenses.update`
- `apiExpenses.create`
- `apiEmployees.list`
- `apiInvoices.list`
- `apiPayments.create`
- `apiJournal.create`

### products - المنتجات

**الملفات:** 1
**استدعاءات API:** 7
**استعلامات SQL:** 0
**المشاكل:** 0

#### استدعاءات API:

- `apiSettings.get`
- `products.list`
- `products.update`
- `products.create`
- `products.remove`

### pos - نقطة البيع - الفواتير، الجداول، الإدارة

**الملفات:** 3
**استدعاءات API:** 69
**استعلامات SQL:** 0
**المشاكل:** 0

#### استدعاءات API:

- `apiProducts.list`
- `apiBranches.list`
- `apiPartners.list`
- `apiSettings.get`
- `apiOrders.list`
- `apiOrders.get`
- `apiOrders.remove`
- `apiOrders.update`
- `apiPartners.create`
- `apiInvoices.get`
- `apiInvoices.create`
- `apiInvoices.remove`
- `apiInvoices.update`

### purchases - المشتريات - طلبات الشراء

**الملفات:** 2
**استدعاءات API:** 25
**استعلامات SQL:** 0
**المشاكل:** 4

#### المشاكل:

- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/PurchaseOrderDetail.jsx`, السطر: 150
- **🟡 متوسطة:** استدعاء apiPayments.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/PurchaseOrderDetail.jsx`, السطر: 151
- **🟡 متوسطة:** استدعاء apiInvoices.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/PurchaseOrderDetail.jsx`, السطر: 150
- **🟡 متوسطة:** استدعاء apiPayments.list قد يعتمد على جداول مباشرة بدلاً من القيود المنشورة
  - الملف: `pages/PurchaseOrderDetail.jsx`, السطر: 151

#### استدعاءات API:

- `apiSettings.get`
- `apiPO.get`
- `apiPO.remove`
- `apiProducts.list`
- `apiPartners.list`
- `apiPO.update`
- `apiSupInv.create`
- `apiInvoices.list`
- `apiPayments.list`

### reports - التقارير - جميع التقارير المالية والتشغيلية

**الملفات:** 1
**استدعاءات API:** 12
**استعلامات SQL:** 0
**المشاكل:** 8

#### المشاكل:

- **🔴 عالية:** استدعاء apiReports.salesVsExpenses لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 158
- **🔴 عالية:** استدعاء apiReports.salesByBranch لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 186
- **🔴 عالية:** استدعاء apiReports.expensesByBranch لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 214
- **🔴 عالية:** استدعاء apiReports.trialBalance لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 359
- **🔴 عالية:** استدعاء apiReports.salesVsExpenses لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 158
- **🔴 عالية:** استدعاء apiReports.salesByBranch لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 186
- **🔴 عالية:** استدعاء apiReports.expensesByBranch لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 214
- **🔴 عالية:** استدعاء apiReports.trialBalance لا يحدد status='posted' صراحة
  - الملف: `pages/Reports.jsx`, السطر: 359

#### استدعاءات API:

- `apiSettings.get`
- `apiReports.salesVsExpenses`
- `apiReports.salesByBranch`
- `apiReports.expensesByBranch`
- `apiReports.trialBalance`

### settings - الإعدادات

**الملفات:** 1
**استدعاءات API:** 14
**استعلامات SQL:** 0
**المشاكل:** 0

#### استدعاءات API:

- `apiUsers.list`
- `apiActions.list`
- `apiScreens.list`
- `apiBranches.list`
- `apiSettings.get`

## 🔧 Backend Endpoints تحتاج مراجعة

### GET /expenses

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/expenses

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/expenses/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### POST /expenses/:id/post

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### POST /api/expenses/:id/post

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /supplier-invoices

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/supplier-invoices

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /supplier-invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /api/supplier-invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### POST /supplier-invoices/:id/post

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### POST /api/supplier-invoices/:id/post

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### DELETE /supplier-invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### DELETE /api/supplier-invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /invoices

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/invoices

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /invoices/next-number

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### POST /invoices

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /api/invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### DELETE /invoices/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /invoice_items/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/invoice_items/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /orders

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/orders

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /orders/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /api/orders/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### DELETE /orders/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### DELETE /api/orders/:id

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /payments

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### POST /payments

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /ar/summary

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /pos/tables-layout

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /api/pos/tables-layout

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /pos/tables-layout

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### PUT /api/pos/tables-layout

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

### GET /pos/table-state

- يستخدم جداول مباشرة: ✅
- يستخدم journal_entries: ❌
- يستخدم status='posted': ❌

## ✅ التوصيات

1. **تأكد من أن جميع استدعاءات API تمرر `status='posted'` صراحة**
2. **استبدال جميع الاستعلامات المباشرة على جداول invoices/payments/orders باستعلامات على journal_entries**
3. **تحديث جميع الشاشات التي تستخدم `apiInvoices.list` أو `apiPayments.list` لاستخدام `apiPartners.statement` أو `apiJournal.list` بدلاً من ذلك**
4. **إضافة فلترة `status='posted'` بشكل افتراضي في جميع endpoints**
