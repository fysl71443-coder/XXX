# إصلاحات المشاكل المحاسبية - Accounting Fixes

## ✅ المشاكل التي تم إصلاحها

### 1️⃣ إصلاح API Contract Validator
**المشكلة**: API Contract لا يتعامل مع query parameters بشكل صحيح
**الحل**: 
- تحسين normalize path ليتعامل مع query parameters بشكل صحيح
- إصلاح ترتيب replace operations (account/:id أولاً ثم IDs الأخرى)

**الموقع**: `backend/server.js` السطر 54-74

```javascript
// قبل الإصلاح
const normalizedPath = cleanPath.replace(/\/\d+/g, '/:id').replace(/\/account\/\d+/, '/account/:id');

// بعد الإصلاح
const normalizedPath = cleanPath
  .replace(/\/account\/\d+/g, '/account/:id') // Replace /account/123 with /account/:id FIRST
  .replace(/\/\d+/g, '/:id'); // Then replace other IDs
```

### 2️⃣ إضافة Unique Constraints لمنع تكرار الحسابات
**المشكلة**: تكرار الحسابات بنفس `account_code` يؤدي إلى:
- التقارير ترجع صفر
- الميزان لا يتوازن
- Trial Balance مضروب

**الحل**:
- إضافة UNIQUE constraint على `account_code` (WHERE account_code IS NOT NULL)
- إضافة UNIQUE constraint على `account_number` (WHERE account_number IS NOT NULL)

**الموقع**: `backend/server.js` السطر 537-575

```sql
CREATE UNIQUE INDEX accounts_account_code_unique 
ON accounts(account_code) 
WHERE account_code IS NOT NULL;

CREATE UNIQUE INDEX accounts_account_number_unique 
ON accounts(account_number) 
WHERE account_number IS NOT NULL;
```

### 3️⃣ تحسين createInvoiceJournalEntry
**المشكلة**: التأكد من أن القيود تُنشأ بشكل صحيح مع `status='posted'` و `reference_type='invoice'`

**الحل**:
- إضافة logging محسّن للتأكد من أن القيود تُنشأ بشكل صحيح
- التأكد من أن `status='posted'` و `reference_type='invoice'` موجودان دائماً

**الموقع**: `backend/server.js` السطر 6006-6042

### 4️⃣ التحقق من أن التقرير يعتمد على journal_entries بشكل صحيح
**الحالة الحالية**: 
- التقرير يعتمد على `journal_entries` مع `status='posted'` و `reference_type='invoice'`
- التقرير يستخدم `account_code` للبحث عن الحسابات
- `createInvoiceJournalEntry` تُنشئ القيود مع `status='posted'` و `reference_type='invoice'`

**التحقق**:
- ✅ التقرير يستخدم `account_code` بشكل صحيح
- ✅ `createInvoiceJournalEntry` تُنشئ القيود مع `status='posted'`
- ✅ `createInvoiceJournalEntry` تُنشئ القيود مع `reference_type='invoice'`

## 🔍 المشاكل المحتملة المتبقية

### 1. تكرار الحسابات الموجودة
**الحل المطلوب**: 
- مراجعة يدوية للحسابات المكررة
- دمج أو حذف الحسابات المكررة
- التأكد من أن `account_code` متطابق مع `account_number` للحسابات الأساسية

```sql
-- للتحقق من الحسابات المكررة
SELECT account_code, COUNT(*) as count
FROM accounts
WHERE account_code IS NOT NULL
GROUP BY account_code
HAVING COUNT(*) > 1;

-- للتحقق من الحسابات بدون account_code
SELECT id, account_number, account_code, name
FROM accounts
WHERE account_code IS NULL AND account_number IS NOT NULL;
```

### 2. القيود المحاسبية القديمة
**الحل المطلوب**:
- التحقق من أن الفواتير القديمة لها قيود محاسبية
- إنشاء قيود محاسبية للفواتير القديمة إذا لم تكن موجودة

```sql
-- للتحقق من الفواتير بدون قيود محاسبية
SELECT i.id, i.number, i.date, i.total, i.status
FROM invoices i
LEFT JOIN journal_entries je ON je.reference_type = 'invoice' AND je.reference_id = i.id
WHERE je.id IS NULL AND i.status = 'posted';
```

## 📋 الخطوات التالية

1. ✅ إصلاح API Contract Validator
2. ✅ إضافة Unique Constraints
3. ✅ تحسين createInvoiceJournalEntry
4. ⏳ مراجعة الحسابات المكررة يدوياً
5. ⏳ التحقق من القيود المحاسبية للفواتير القديمة
6. ⏳ اختبار التقرير بعد الإصلاحات

## 🎯 النتيجة المتوقعة

بعد تطبيق هذه الإصلاحات:
- ✅ API Contract سيتعرف على جميع الـ endpoints بشكل صحيح
- ✅ لن يكون هناك تكرار في الحسابات
- ✅ التقارير ستعمل بشكل صحيح (إذا كانت القيود المحاسبية موجودة)
- ✅ الميزان سيتوازن بشكل صحيح

## ⚠️ ملاحظات مهمة

1. **Unique Constraints**: قد تحتاج إلى حذف الحسابات المكررة يدوياً قبل تطبيق الـ constraints
2. **القيود المحاسبية**: الفواتير القديمة قد تحتاج إلى قيود محاسبية يدوياً
3. **التقارير**: التقارير تعتمد على `journal_entries` مع `status='posted'` - إذا لم تكن موجودة، التقرير سيرجع صفر (وهذا صحيح محاسبياً)
