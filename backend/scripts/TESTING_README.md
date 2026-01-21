# دليل تشغيل الاختبارات محلياً

هذا الدليل يشرح كيفية تشغيل جميع الاختبارات محلياً على Node.js.

## المتطلبات

- Node.js >= 22.12.0
- قاعدة بيانات PostgreSQL متصلة (متغير البيئة `DATABASE_URL`)
- الخادم يعمل على `http://localhost:4000` (لاختبارات API)

## الاختبارات المتاحة

### 1. comprehensive_system_test.cjs
اختبار شامل للنظام يتحقق من:
- ✅ اتصال قاعدة البيانات
- ✅ بنية جداول الطلبات
- ✅ سلامة المسودات
- ✅ قيود قاعدة البيانات
- ✅ فترات المحاسبة
- ✅ مصادقة API
- ✅ endpoints API
- ⚠️ Journal Entries للمعاملات المنشورة

### 2. fix_old_expenses.js
إصلاح المصروفات القديمة التي لا تحتوي على journal entries:
- البحث عن مصروفات بدون `journal_entry_id`
- إنشاء journal entries تلقائياً
- إنشاء حسابات افتراضية إذا لم تكن موجودة

### 3. test-pos-flow.js
اختبار تدفق POS الكامل:
- حفظ مسودة طلب
- استرجاع الطلب والتحقق من الأصناف
- إصدار فاتورة مع خصم
- التحقق من قيود اليومية

## الاستخدام

### تشغيل جميع الاختبارات

```bash
# من مجلد backend
npm test

# أو مباشرة
node scripts/run-all-tests.js
```

### تشغيل اختبار واحد فقط

```bash
# اختبار شامل
npm run test:comprehensive

# اختبار POS
npm run test:pos

# إصلاح المصروفات
npm run test:fix-expenses
```

### تشغيل بدون اختبارات API

إذا كان الخادم غير متاح، يمكن تخطي اختبارات API:

```bash
npm run test:skip-api
```

### تشغيل اختبار محدد من السكريبت الموحد

```bash
node scripts/run-all-tests.js --only=comprehensive_system_test
node scripts/run-all-tests.js --only=test-pos-flow
node scripts/run-all-tests.js --only=fix_old_expenses
```

## متغيرات البيئة

يمكن تخصيص الإعدادات عبر متغيرات البيئة:

```bash
# عنوان API
export API_BASE_URL=http://localhost:4000

# قاعدة البيانات
export DATABASE_URL=postgresql://user:pass@host/db

# ثم تشغيل الاختبارات
npm test
```

## الإصلاحات المطبقة

### 1. test-pos-flow.js
- ✅ تم استبدال `fetch` بـ `axios` لدعم Node.js
- ✅ إضافة معالجة أخطاء محسّنة
- ✅ دعم متغيرات البيئة

### 2. fix_old_expenses.js
- ✅ إنشاء حسابات افتراضية تلقائياً إذا لم تكن موجودة
- ✅ دعم حسابات النقد (1111) والبنك (1121)
- ✅ دعم حسابات المصروفات (5210)

### 3. run-all-tests.js
- ✅ سكريبت موحد لتشغيل جميع الاختبارات
- ✅ التحقق من تشغيل الخادم قبل اختبارات API
- ✅ تقارير مفصلة مع ألوان
- ✅ إحصائيات شاملة

## النتائج المتوقعة

### comprehensive_system_test.cjs
```
✅ PASS: Database Connection
✅ PASS: Orders Table Schema
⚠️  WARN: Draft Orders Integrity - No DRAFT orders found
❌ FAIL: Journal Entries - Missing journal entries for 1 expenses
✅ PASS: Database Constraints
✅ PASS: Accounting Periods
✅ PASS: API Authentication
✅ PASS: API GET /api/orders
✅ PASS: API POST /api/pos/saveDraft
✅ PASS: API Endpoints

Pass Rate: 88.9%
```

### fix_old_expenses.js
```
🔍 البحث عن مصروفات بدون journal_entry_id...
📊 وجد 1 مصروف بدون journal entry
✅ Expense #1: تم إنشاء journal entry #123
📊 النتائج:
✅ تم إصلاح: 1
❌ فشل: 0
```

### test-pos-flow.js
```
[LOGIN] Success, token received
[STEP 1] Get next invoice number
[STEP 2] Save draft order
[STEP 3] Load order to verify items
[CHECK] Items match after reload: ✅ PASS
[STEP 4] List orders for table
[STEP 5] Issue invoice with discount
[STEP 6] Verify journal posting includes discount (4190)
✅ جميع الخطوات نجحت
```

## استكشاف الأخطاء

### خطأ: "fetch failed"
- تأكد من أن الخادم يعمل على `http://localhost:4000`
- تحقق من متغير البيئة `API_BASE_URL`

### خطأ: "Cannot find module 'axios'"
```bash
npm install
```

### خطأ: "Database connection failed"
- تحقق من `DATABASE_URL` في `.env`
- تأكد من أن قاعدة البيانات متاحة

### خطأ: "Account not found"
- السكريبت `fix_old_expenses.js` سينشئ الحسابات تلقائياً
- إذا استمرت المشكلة، تحقق من بنية جدول `accounts`

## ملاحظات

- جميع الاختبارات تعمل محلياً فقط (لا تحتاج اتصال بالإنترنت)
- الاختبارات لا تعدل البيانات إلا في `fix_old_expenses.js` (يمكن إعادة تشغيله بأمان)
- `test-pos-flow.js` ينشئ بيانات تجريبية (يمكن حذفها لاحقاً)
