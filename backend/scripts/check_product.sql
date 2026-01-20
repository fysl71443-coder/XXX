-- سكريبت للتحقق من المنتج في قاعدة البيانات
-- شغّل هذا في PostgreSQL على Render

-- عرض جميع المنتجات مع حالة is_active
SELECT id, name, name_en, category, price, is_active, created_at 
FROM products 
ORDER BY id DESC 
LIMIT 10;

-- التحقق من المنتج المحدد
SELECT id, name, name_en, category, price, is_active, 
       CASE 
         WHEN is_active = true THEN 'نشط ✅'
         WHEN is_active = false THEN 'غير نشط ❌'
         WHEN is_active IS NULL THEN 'NULL ⚠️'
         ELSE 'غير معروف'
       END as status
FROM products 
ORDER BY id DESC 
LIMIT 5;

-- إصلاح المنتج إذا كان is_active = false أو NULL
-- UPDATE products SET is_active = true WHERE is_active IS NULL OR is_active = false;
