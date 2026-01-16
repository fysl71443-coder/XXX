-- ============================================
-- System Review SQL Queries
-- Run these queries directly in psql
-- ============================================

-- 1. قائمة جميع الجداول
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. عدد الصفوف في كل جدول
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY tablename;

-- 3. فحص جدول accounts
SELECT COUNT(*) as total_accounts FROM accounts;
SELECT account_number, name, type, parent_id 
FROM accounts 
WHERE parent_id IS NULL 
ORDER BY account_number;

-- 4. فحص الحسابات المطلوبة
SELECT account_number, name, type 
FROM accounts 
WHERE account_number IN ('1111', '1121', '1141', '2111', '4100', '5100', '5200')
ORDER BY account_number;

-- 5. فحص المنتجات
SELECT COUNT(*) as total_products FROM products;
SELECT category, COUNT(*) as count 
FROM products 
GROUP BY category 
ORDER BY category;

-- 6. فحص الموظفين
SELECT COUNT(*) as total_employees FROM employees;
SELECT status, COUNT(*) as count 
FROM employees 
GROUP BY status;

-- 7. فحص الموظفين مع جميع الحقول
SELECT 
  id,
  full_name,
  employee_number,
  basic_salary,
  housing_allowance,
  transport_allowance,
  gosi_enrolled,
  department
FROM employees 
ORDER BY id DESC 
LIMIT 10;

-- 8. فحص الطلبات (Orders)
SELECT 
  status,
  COUNT(*) as count
FROM orders 
GROUP BY status;

-- 9. فحص المسودات مع عدد الأصناف
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
      (SELECT COUNT(*)::text FROM jsonb_array_elements(lines) WHERE value->>'type' = 'item')
    ELSE '0'
  END as items_count
FROM orders 
WHERE status = 'DRAFT'
ORDER BY created_at DESC
LIMIT 10;

-- 10. فحص المسودات - تفاصيل lines
SELECT 
  id,
  branch,
  table_code,
  lines::text as lines_json
FROM orders 
WHERE status = 'DRAFT' 
AND branch = 'place_india'
ORDER BY created_at DESC
LIMIT 5;

-- 11. فحص المسودات - استخراج items
SELECT 
  id,
  branch,
  table_code,
  jsonb_array_length(lines) as total_lines,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(lines) 
    WHERE value->>'type' = 'item'
  ) as items_count,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(lines) 
    WHERE value->>'type' = 'meta'
  ) as meta_count
FROM orders 
WHERE status = 'DRAFT'
AND branch = 'place_india'
ORDER BY created_at DESC;

-- 12. فحص الشركاء (Partners)
SELECT 
  type,
  COUNT(*) as count
FROM partners 
GROUP BY type;

-- 13. فحص الشركاء مع account_id
SELECT 
  id,
  name,
  type,
  account_id,
  customer_type,
  discount_rate
FROM partners 
WHERE type IN ('customer', 'supplier')
ORDER BY id DESC
LIMIT 10;

-- 14. فحص Foreign Keys
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

-- 15. فحص الطلبات بدون branch
SELECT COUNT(*) as count
FROM orders
WHERE branch IS NULL OR branch = '';

-- 16. فحص الطلبات بدون lines
SELECT 
  id,
  branch,
  table_code,
  status
FROM orders
WHERE status = 'DRAFT'
AND (lines IS NULL OR jsonb_array_length(lines) = 0);

-- 17. فحص هيكل جدول orders
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'orders'
ORDER BY ordinal_position;

-- 18. فحص هيكل جدول employees
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees'
ORDER BY ordinal_position;

-- 19. آخر 5 مسودات محفوظة
SELECT 
  id,
  branch,
  table_code,
  status,
  created_at,
  updated_at,
  jsonb_array_length(lines) as lines_count
FROM orders
WHERE status = 'DRAFT'
ORDER BY created_at DESC
LIMIT 5;

-- 20. فحص بيانات مسودة محددة (استبدل ID)
-- SELECT 
--   id,
--   branch,
--   table_code,
--   lines
-- FROM orders
-- WHERE id = [ORDER_ID];
