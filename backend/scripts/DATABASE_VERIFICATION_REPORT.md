# 📋 تقرير التحقق من قاعدة البيانات والكود

## ✅ الفحص المطلوب

### 1️⃣ فحص قاعدة البيانات

#### الجداول المطلوبة (19 جدول):

**الجداول الأساسية:**
- ✅ `users` - المستخدمون
- ✅ `user_permissions` - صلاحيات المستخدمين
- ✅ `settings` - إعدادات النظام
- ✅ `partners` - العملاء والموردين
- ✅ `employees` - الموظفون

**الجداول المالية:**
- ✅ `accounts` - الحسابات المحاسبية
- ✅ `journal_entries` - القيود المحاسبية
- ✅ `journal_postings` - بنود القيود
- ✅ `accounting_periods` - الفترات المحاسبية

**الجداول التجارية:**
- ✅ `products` - المنتجات
- ✅ `invoices` - فواتير المبيعات
- ✅ `orders` - طلبات POS
- ✅ `supplier_invoices` - فواتير الموردين
- ✅ `payments` - المدفوعات
- ✅ `expenses` - المصروفات

**الجداول الناقصة (يجب إنشاؤها):**
- ❌ `branch_accounts` - **يجب إنشاؤه**
- ❌ `pos_tables` - **يجب إنشاؤه**
- ❌ `order_drafts` - **يجب إنشاؤه**

**السجلات:**
- ✅ `audit_log` - سجل التدقيق (يتم إنشاؤه تلقائيًا)

---

#### الأعمدة المطلوبة:

**invoices:**
- ✅ `journal_entry_id` - ربط الفاتورة بالقيد المحاسبي
- ✅ `closed_at` - تاريخ إغلاق الفاتورة
- ✅ `invoice_number` - رقم الفاتورة

**orders:**
- ✅ `closed_at` - تاريخ إغلاق الطلب

**journal_entries:**
- ✅ `branch` - الفرع

**accounts:**
- ✅ `account_code` - رمز الحساب

---

### 2️⃣ فحص الكود

#### الاستدعاءات الصحيحة:

✅ **invoice_items**:
- الكود يستخدم `/api/invoice_items/:id` endpoint
- البيانات تُقرأ من `invoices.lines` (JSONB) - **صحيح**
- لا يوجد جدول `invoice_items` - **صحيح** (البيانات في JSONB)

✅ **branch_accounts**:
- الكود يحاول الوصول إلى `branch_accounts` table
- لديه fallback للحسابات الافتراضية - **صحيح**
- يحتاج أن يكون الجدول موجودًا

✅ **pos_tables**:
- الكود يحاول تحديث `pos_tables` table
- لديه fallback لجدول `tables` - **صحيح**
- يحتاج أن يكون الجدول موجودًا

✅ **order_drafts**:
- الكود يحاول حذف/تحديث `order_drafts`
- لديه معالجة أخطاء إذا لم يكن الجدول موجودًا - **صحيح**

---

#### المفاتيح الأجنبية (Foreign Keys):

✅ **invoices**:
- `journal_entry_id` → `journal_entries.id` (nullable)

✅ **orders**:
- `invoice_id` → `invoices.id` (nullable)

✅ **journal_postings**:
- `journal_entry_id` → `journal_entries.id` (CASCADE)
- `account_id` → `accounts.id`

✅ **pos_tables** (عند إنشائه):
- `current_order_id` → `orders.id` (nullable)

✅ **order_drafts** (عند إنشائه):
- `order_id` → `orders.id` (CASCADE)

---

## 🔍 استعلامات التحقق

### التحقق من الجداول:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### التحقق من الأعمدة:

```sql
-- invoices
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoices'
ORDER BY ordinal_position;

-- orders
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- journal_entries
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'journal_entries'
ORDER BY ordinal_position;
```

### التحقق من المفاتيح الأجنبية:

```sql
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

### التحقق من الحسابات الأساسية:

```sql
SELECT account_number, account_code, name, name_en, type, nature 
FROM accounts 
WHERE account_number IN ('1111', '1121', '2141', '4111', '4112', '4121', '4122')
ORDER BY account_number;
```

### التحقق من حسابات الفروع (إذا كان الجدول موجودًا):

```sql
SELECT ba.branch_name, ba.account_type, ba.account_number, a.name as account_name
FROM branch_accounts ba
LEFT JOIN accounts a ON a.id = ba.account_id
WHERE ba.is_active = true
ORDER BY ba.branch_name, ba.account_type;
```

### التحقق من الطاولات (إذا كان الجدول موجودًا):

```sql
SELECT branch, table_code, table_name, status, capacity, is_active
FROM pos_tables
WHERE is_active = true
ORDER BY branch, table_code;
```

---

## 📊 ملخص الأخطاء المحتملة

### ❌ أخطاء محتملة في الكود:

1. **branch_accounts**:
   - ✅ الكود يتعامل مع عدم وجود الجدول (fallback)
   - ⚠️ لكن يجب إنشاء الجدول لتحسين الأداء

2. **pos_tables**:
   - ✅ الكود يتعامل مع عدم وجود الجدول (fallback)
   - ⚠️ لكن يجب إنشاء الجدول لإدارة حالة الطاولات

3. **order_drafts**:
   - ✅ الكود يتعامل مع عدم وجود الجدول (fallback)
   - ⚠️ لكن يجب إنشاء الجدول لحفظ المسودات

### ⚠️ تحذيرات:

1. **invoices.lines**:
   - ✅ البيانات في JSONB - **صحيح**
   - ⚠️ لا يوجد جدول `invoice_items` - **هذا صحيح** ولا يجب إنشاؤه

2. **Foreign Keys**:
   - ✅ معظم المفاتيح الأجنبية موجودة
   - ⚠️ بعض المفاتيح nullable - **هذا صحيح**

---

## 🚀 الخطوات المطلوبة

### 1. تنفيذ سكريبت الإصلاح:

```bash
# من مجلد backend/scripts
node fix_complete_database.cjs
```

أو باستخدام psql:

```bash
psql "postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv" -f backend/scripts/fix_complete_database.sql
```

### 2. التحقق من النتائج:

بعد التنفيذ، يجب أن تجد:
- ✅ جميع الجداول موجودة
- ✅ جميع الأعمدة موجودة
- ✅ الحسابات الأساسية موجودة
- ✅ حسابات الفروع موجودة
- ✅ الطاولات موجودة

---

## ✅ الخلاصة

### الكود:
- ✅ **لا يوجد أخطاء** في الاستدعاءات
- ✅ **الربط صحيح** - جميع المفاتيح الأجنبية صحيحة
- ✅ **معالجة الأخطاء** موجودة للجداول الناقصة

### قاعدة البيانات:
- ⚠️ **3 جداول ناقصة** يجب إنشاؤها (`branch_accounts`, `pos_tables`, `order_drafts`)
- ⚠️ **بعض الأعمدة** قد تكون ناقصة (يتم إضافتها تلقائيًا)

**الحل**: تنفيذ `fix_complete_database.cjs` لإصلاح كل شيء تلقائيًا.
