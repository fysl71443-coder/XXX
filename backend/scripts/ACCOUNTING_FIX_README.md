# دليل إصلاح الربط المحاسبي

## 📋 نظرة عامة

هذا الدليل يشرح كيفية تنفيذ جميع المراحل المطلوبة لإصلاح الربط المحاسبي بين:
- `expenses` و `journal_entries`
- `invoices` و `journal_entries`

## 🔍 المشاكل الحالية

1. ❌ لا يوجد `journal_entry_id` في `expenses` و `invoices`
2. ❌ لا يوجد ترقيم تلقائي للقيود (`entry_number`)
3. ❌ لا يوجد ترقيم تلقائي للفواتير
4. ❌ الكود لا يربط `journal_entry_id` بعد إنشاء القيد
5. ❌ وجود نظامين محاسبيين متضاربين (CamelCase و snake_case)

---

## 📝 المراحل المطلوبة

### المرحلة 2️⃣ — تثبيت الربط المحاسبي

#### 1️⃣ إضافة مفاتيح الربط

**الملف:** `backend/scripts/fix_accounting_links.sql`

**التنفيذ:**
```bash
psql $DATABASE_URL -f backend/scripts/fix_accounting_links.sql
```

**ما يتم تنفيذه:**
- إضافة `journal_entry_id` إلى `expenses`
- إضافة `journal_entry_id` إلى `invoices`
- إضافة Foreign Keys مع `ON DELETE SET NULL`
- إنشاء SEQUENCE للترقيم التلقائي للقيود
- إنشاء SEQUENCE للترقيم التلقائي للفواتير

#### 2️⃣ التحقق من النتائج

```sql
-- التحقق من الأعمدة المضافة
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('expenses', 'invoices', 'journal_entries')
  AND column_name IN ('journal_entry_id', 'entry_number', 'number')
ORDER BY table_name, column_name;

-- التحقق من Constraints
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name
FROM pg_constraint
WHERE conname IN ('fk_expense_journal', 'fk_invoice_journal');
```

---

### المرحلة 3️⃣ — اختبار القيد المحاسبي يدوياً

**الملف:** `backend/scripts/test_manual_journal_entry.sql`

**التنفيذ:**
```bash
psql $DATABASE_URL -f backend/scripts/test_manual_journal_entry.sql
```

**ما يتم اختباره:**
1. إنشاء قيد يدوي
2. إضافة سطور القيد (مدين ودائن)
3. التحقق من التوازن (المدين = الدائن)

**النتيجة المتوقعة:**
- ✅ القيد يُنشأ بنجاح
- ✅ السطور تُضاف بنجاح
- ✅ التوازن صحيح (المدين = الدائن)

---

### المرحلة 4️⃣ — تحديث الكود

**الملف:** `backend/server.js`

**التغييرات المنفذة:**
1. ✅ استخدام SEQUENCE للترقيم التلقائي (بدلاً من حساب يدوي)
2. ✅ ربط `journal_entry_id` بعد إنشاء القيد في:
   - `POST /api/expenses/:id/post`
   - `POST /api/expenses` (عند status='posted')

**التحقق:**
```bash
# تشغيل الخادم
cd backend
npm start

# اختبار POST expense
curl -X POST http://localhost:10000/api/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "expense",
    "amount": 100,
    "account_code": "5210",
    "description": "Test Expense",
    "status": "posted"
  }'

# التحقق من journal_entry_id
psql $DATABASE_URL -c "SELECT id, journal_entry_id, status FROM expenses ORDER BY id DESC LIMIT 1;"
```

---

### المرحلة 5️⃣ — تعطيل الجداول القديمة

**⚠️ تحذير:** نفذ هذا فقط بعد التأكد أن Backend لا يستخدم CamelCase

**الملف:** `backend/scripts/disable_old_accounting_tables.sql`

**التنفيذ:**
```bash
psql $DATABASE_URL -f backend/scripts/disable_old_accounting_tables.sql
```

**ما يتم تنفيذه:**
- إعادة تسمية `JournalEntry` → `_OLD_JournalEntry`
- إعادة تسمية `JournalPosting` → `_OLD_JournalPosting`
- إعادة تسمية `Account` → `_OLD_Account`

**التحقق:**
```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE '_OLD_%';
```

---

## ✅ الوضع بعد التنفيذ

| العنصر | الحالة |
|--------|--------|
| الفواتير | ⚠️ قيد غير مفعل (سيتم إصلاحه لاحقاً) |
| المصروفات | ✅ قيد مفعل + ربط `journal_entry_id` |
| التقارير | ⚠️ قد تحتاج تحديث |
| النظام المحاسبي | ✅ موحد (snake_case فقط) |

---

## 🔧 استكشاف الأخطاء

### المشكلة: SEQUENCE غير موجود

**الحل:**
```sql
CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;
```

### المشكلة: entry_number لا يُملأ تلقائياً

**الحل:**
```sql
ALTER TABLE journal_entries
ALTER COLUMN entry_number 
SET DEFAULT nextval('journal_entry_number_seq');
```

### المشكلة: journal_entry_id لا يُربط

**التحقق:**
1. تأكد أن الكود يُحدث `journal_entry_id` بعد إنشاء القيد
2. تحقق من وجود Foreign Key constraint
3. تحقق من أن القيد يُنشأ بنجاح

---

## 📚 الملفات المطلوبة

1. ✅ `backend/scripts/fix_accounting_links.sql` - إصلاح الربط
2. ✅ `backend/scripts/test_manual_journal_entry.sql` - اختبار يدوي
3. ✅ `backend/scripts/disable_old_accounting_tables.sql` - تعطيل الجداول القديمة
4. ✅ `backend/server.js` - تحديث الكود

---

## 🎯 الخطوات التالية

1. ✅ تنفيذ `fix_accounting_links.sql`
2. ✅ اختبار القيد يدوياً
3. ✅ تحديث الكود (تم)
4. ⏳ اختبار النظام
5. ⏳ تعطيل الجداول القديمة (بعد التأكد)
6. ⏳ إصلاح ربط الفواتير (المرحلة القادمة)

---

**تاريخ الإنشاء:** 2025-01-XX  
**الحالة:** ✅ جاهز للتنفيذ
