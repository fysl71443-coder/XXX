-- سكريبت لإصلاح حالة is_active للمنتجات
-- شغّل هذا في PostgreSQL على Render

-- 1. عرض جميع المنتجات مع حالة is_active
SELECT id, name, name_en, category, price, is_active, 
       CASE 
         WHEN is_active = true THEN 'نشط ✅'
         WHEN is_active = false THEN 'غير نشط ❌'
         WHEN is_active IS NULL THEN 'NULL (سيتم إصلاحه) ⚠️'
         ELSE 'غير معروف'
       END as status
FROM products 
ORDER BY id DESC;

-- 2. إصلاح جميع المنتجات التي لديها is_active = NULL أو false
-- جعلها نشطة (true)
UPDATE products 
SET is_active = true 
WHERE is_active IS NULL OR is_active = false;

-- 3. التحقق من النتيجة
SELECT id, name, name_en, category, price, is_active, 
       CASE 
         WHEN is_active = true THEN 'نشط ✅'
         WHEN is_active = false THEN 'غير نشط ❌'
         WHEN is_active IS NULL THEN 'NULL ⚠️'
         ELSE 'غير معروف'
       END as status
FROM products 
ORDER BY id DESC;
