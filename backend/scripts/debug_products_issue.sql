-- سكريبت للتحقق من مشكلة المنتجات
-- شغّل هذا في PostgreSQL على Render

-- 1. عرض جميع المنتجات مع جميع التفاصيل
SELECT id, name, name_en, category, price, cost, tax_rate, 
       stock_quantity, min_stock, is_active, is_service, 
       can_be_sold, can_be_purchased, can_be_expensed,
       created_at, updated_at
FROM products 
ORDER BY id DESC;

-- 2. التحقق من عدد المنتجات
SELECT COUNT(*) as total_products,
       COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
       COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_products,
       COUNT(CASE WHEN is_active IS NULL THEN 1 END) as null_active_products
FROM products;

-- 3. عرض المنتجات التي يجب أن تظهر (is_active = true OR NULL)
SELECT id, name, name_en, category, price, is_active
FROM products 
WHERE (is_active = true OR is_active IS NULL)
ORDER BY id DESC;
