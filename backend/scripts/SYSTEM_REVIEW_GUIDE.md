# دليل المراجعة الشاملة للنظام
## System Comprehensive Review Guide

### 📋 الفهرس
1. [التحضير](#1-التحضير)
2. [مراجعة قاعدة البيانات](#2-مراجعة-قاعدة-البيانات)
3. [مراجعة Backend APIs](#3-مراجعة-backend-apis)
4. [مراجعة Frontend](#4-مراجعة-frontend)
5. [مراجعة الوظائف](#5-مراجعة-الوظائف)
6. [التوثيق](#6-التوثيق)

---

## 1. التحضير

### 1.1 إعداد البيئة
```bash
# نسخ قاعدة البيانات (اختياري)
pg_dump -h host -U user -d database > backup.sql

# التأكد من متغيرات البيئة
export DATABASE_URL="postgresql://..."
export NODE_ENV=production
```

### 1.2 الأدوات المطلوبة
- ✅ `psql` - للوصول إلى PostgreSQL
- ✅ Postman أو Insomnia - لاختبار APIs
- ✅ Browser DevTools - لفحص Frontend
- ✅ Terminal - لتشغيل السكريبتات

### 1.3 تشغيل سكريبتات المراجعة
```bash
# مراجعة قاعدة البيانات
node backend/scripts/review_system.js

# مراجعة API endpoints (يتطلب token)
export API_TOKEN="your_jwt_token"
node backend/scripts/review_api_endpoints.js http://localhost:5000
```

---

## 2. مراجعة قاعدة البيانات

### 2.1 فحص الجداول الأساسية
```sql
-- قائمة جميع الجداول
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- فحص جدول محدد
\d accounts
\d employees
\d orders
\d products
\d partners
```

### 2.2 فحص البيانات الأساسية
```sql
-- شجرة الحسابات
SELECT COUNT(*) FROM accounts;
SELECT account_number, name, type FROM accounts WHERE parent_id IS NULL;

-- المنتجات
SELECT COUNT(*) FROM products;
SELECT category, COUNT(*) FROM products GROUP BY category;

-- الموظفين
SELECT COUNT(*) FROM employees;
SELECT status, COUNT(*) FROM employees GROUP BY status;

-- المسودات
SELECT branch, status, COUNT(*) FROM orders GROUP BY branch, status;
SELECT id, branch, table_code, 
       CASE 
         WHEN lines IS NULL THEN 0
         WHEN jsonb_typeof(lines) = 'array' THEN jsonb_array_length(lines)
         ELSE 1
       END as lines_count
FROM orders 
WHERE status = 'DRAFT'
ORDER BY created_at DESC
LIMIT 10;
```

### 2.3 فحص العلاقات
```sql
-- Foreign Keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

---

## 3. مراجعة Backend APIs

### 3.1 قائمة Endpoints المهمة

#### المحاسبة
- `GET /api/accounts` - قائمة الحسابات
- `GET /api/accounts/tree` - شجرة الحسابات
- `GET /api/journal` - القيود اليومية
- `POST /api/journal` - إنشاء قيد

#### الموظفين
- `GET /api/employees` - قائمة الموظفين
- `POST /api/employees` - إضافة موظف
- `PUT /api/employees/:id` - تحديث موظف
- `GET /api/employees/:id` - تفاصيل موظف

#### POS
- `GET /api/orders` - قائمة الطلبات
- `GET /api/orders?branch=place_india&status=DRAFT` - المسودات
- `POST /api/pos/saveDraft` - حفظ مسودة
- `GET /api/orders/:id` - تفاصيل طلب

#### العملاء والموردين
- `GET /api/partners?type=customer` - العملاء
- `GET /api/partners?type=supplier` - الموردين
- `POST /api/partners` - إضافة شريك

### 3.2 اختبار Endpoint
```bash
# مثال: جلب المسودات
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/orders?branch=place_india&status=DRAFT"

# مثال: حفظ مسودة
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch":"place_india","table":"3","items":[...]}' \
  "http://localhost:5000/api/pos/saveDraft"
```

### 3.3 فحص Logs
```bash
# Backend logs
tail -f backend/logs/server.log

# البحث عن أخطاء
grep -i "error\|exception\|failed" backend/logs/server.log
```

---

## 4. مراجعة Frontend

### 4.1 الشاشات الرئيسية

#### المحاسبة (`/accounting`)
- [ ] عرض شجرة الحسابات
- [ ] عرض الأرصدة
- [ ] إنشاء قيد يومي
- [ ] طباعة التقارير

#### الموظفين (`/employees`)
- [ ] عرض قائمة الموظفين
- [ ] إضافة موظف جديد
- [ ] تعديل موظف
- [ ] عرض بطاقات الموظفين

#### POS (`/pos/:branch/tables/:table`)
- [ ] فتح طاولة
- [ ] إضافة أصناف
- [ ] حفظ مسودة
- [ ] فتح مسودة محفوظة
- [ ] إصدار فاتورة

#### العملاء (`/clients`)
- [ ] عرض قائمة العملاء
- [ ] إضافة عميل
- [ ] ربط عميل بفاتورة

### 4.2 فحص Console
```javascript
// في Browser DevTools
// فحص Network requests
// فحص Console errors
// فحص React DevTools state
```

---

## 5. مراجعة الوظائف

### 5.1 المحاسبة
- [ ] إنشاء قيد يومي
- [ ] ربط القيد بشجرة الحسابات
- [ ] طباعة ميزان المراجعة
- [ ] طباعة قائمة الدخل

### 5.2 الموظفين
- [ ] إضافة موظف جديد (التحقق من ظهور جميع الحقول)
- [ ] ربط موظف بقسم
- [ ] تحديث راتب موظف
- [ ] عرض بطاقة موظف

### 5.3 POS
- [ ] حفظ مسودة (التحقق من الحفظ في قاعدة البيانات)
- [ ] فتح مسودة (التحقق من جلب الأصناف)
- [ ] إصدار فاتورة
- [ ] طباعة إيصال

### 5.4 العملاء
- [ ] إضافة عميل من شاشة POS
- [ ] تطبيق خصم تلقائي
- [ ] ربط عميل بفاتورة

---

## 6. التوثيق

### 6.1 قالب توثيق المشكلة
```markdown
## المشكلة #X

**الشاشة:** /pos/place_india/tables/3
**الوصف:** فشل تحميل المسودة
**الخطوات:**
1. فتح طاولة 3
2. إضافة أصناف
3. حفظ مسودة
4. إغلاق الشاشة
5. فتح الطاولة مرة أخرى

**النتيجة المتوقعة:** تظهر الأصناف المحفوظة
**النتيجة الفعلية:** "فشل تحميل المسودة"

**Logs:**
- Backend: [paste logs]
- Frontend: [paste console errors]

**الحل:**
[وصف الحل المطبق]
```

### 6.2 قائمة التحقق النهائية
- [ ] جميع الجداول موجودة
- [ ] جميع البيانات الأساسية موجودة
- [ ] جميع APIs تعمل
- [ ] جميع الشاشات تعرض البيانات
- [ ] جميع الوظائف تعمل
- [ ] لا توجد أخطاء في Console
- [ ] لا توجد أخطاء في Backend logs

---

## 7. سكريبتات مساعدة

### 7.1 فحص المسودات
```sql
-- فحص المسودات مع عدد الأصناف
SELECT 
  id,
  branch,
  table_code,
  status,
  created_at,
  CASE 
    WHEN lines IS NULL THEN 0
    WHEN jsonb_typeof(lines) = 'array' THEN jsonb_array_length(lines)
    ELSE 1
  END as lines_count,
  CASE 
    WHEN lines IS NULL THEN '[]'
    WHEN jsonb_typeof(lines) = 'array' THEN 
      (SELECT COUNT(*) FROM jsonb_array_elements(lines) WHERE value->>'type' = 'item')
    ELSE '0'
  END as items_count
FROM orders 
WHERE status = 'DRAFT'
ORDER BY created_at DESC;
```

### 7.2 فحص البيانات المفقودة
```sql
-- موظفين بدون قسم
SELECT id, full_name, department FROM employees WHERE department IS NULL OR department = '';

-- حسابات بدون parent
SELECT account_number, name FROM accounts WHERE parent_id IS NULL AND account_number NOT LIKE '000%';

-- مسودات بدون أصناف
SELECT id, branch, table_code FROM orders 
WHERE status = 'DRAFT' 
AND (lines IS NULL OR jsonb_array_length(lines) = 0);
```

---

## 8. النتائج المتوقعة

بعد المراجعة الشاملة، يجب أن:
1. ✅ جميع الجداول موجودة ومكتملة
2. ✅ جميع البيانات الأساسية موجودة
3. ✅ جميع APIs تعمل وتعيد البيانات الصحيحة
4. ✅ جميع الشاشات تعرض البيانات بشكل صحيح
5. ✅ جميع الوظائف تعمل بدون أخطاء
6. ✅ المسودات تُحفظ وتُجلب بشكل صحيح
7. ✅ الموظفون يُضافون وتظهر جميع بياناتهم
8. ✅ العملاء يُضافون ويُطبق الخصم تلقائياً

---

**تاريخ المراجعة:** [Date]
**المراجع:** [Name]
**الإصدار:** 1.0
