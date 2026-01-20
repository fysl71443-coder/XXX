# إصلاح مشكلة عدم ظهور المنتجات

## المشكلة
المنتجات لا تظهر في شاشة المنتجات رغم وجودها في قاعدة البيانات.

## السبب
المنتج المضاف يدوياً قد يكون لديه `is_active = false` أو `is_active = NULL`، والاستعلام يفلتر المنتجات حسب `is_active`.

## الحل

### الحل 1: تحديث المنتج مباشرة في قاعدة البيانات (موصى به)

1. اذهب إلى Render Dashboard > Database > Connect
2. افتح PostgreSQL Shell
3. شغّل هذا SQL:

```sql
-- عرض المنتجات الحالية
SELECT id, name, name_en, category, price, is_active 
FROM products 
ORDER BY id DESC;

-- إصلاح جميع المنتجات (جعلها نشطة)
UPDATE products 
SET is_active = true 
WHERE is_active IS NULL OR is_active = false;

-- التحقق من النتيجة
SELECT id, name, name_en, category, price, is_active 
FROM products 
ORDER BY id DESC;
```

### الحل 2: استخدام السكريبت

استخدم السكريبت الموجود في `backend/scripts/fix_products_is_active.sql`

### الحل 3: إعادة تشغيل السيرفر

بعد تحديث الكود في `server.js`، يجب إعادة تشغيل السيرفر على Render:

1. اذهب إلى Render Dashboard > Service
2. اضغط على "Manual Deploy" > "Deploy latest commit"

## ملاحظات

- الكود تم تحديثه ليعرض المنتجات التي لديها `is_active = true` أو `is_active = NULL`
- المنتجات التي لديها `is_active = false` لن تظهر إلا عند تفعيل "Show Disabled"
- بعد إصلاح `is_active` في قاعدة البيانات، يجب أن تظهر المنتجات فوراً
