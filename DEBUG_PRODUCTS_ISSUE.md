# تشخيص مشكلة عدم ظهور المنتجات

## الخطوات للتحقق

### 1. التحقق من قاعدة البيانات

شغّل هذا SQL على Render:

```sql
-- عرض جميع المنتجات
SELECT id, name, name_en, category, price, is_active, created_at 
FROM products 
ORDER BY id DESC;

-- التحقق من is_active
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_true,
  COUNT(CASE WHEN is_active = false THEN 1 END) as active_false,
  COUNT(CASE WHEN is_active IS NULL THEN 1 END) as active_null
FROM products;
```

### 2. التحقق من الصلاحيات

تأكد من أن المستخدم لديه صلاحية "products:view":

```sql
-- عرض المستخدمين وصلاحياتهم
SELECT u.id, u.email, u.role, 
       COUNT(up.id) as permission_count
FROM users u
LEFT JOIN user_permissions up ON up.user_id = u.id
GROUP BY u.id, u.email, u.role;

-- إذا كان المستخدم admin، يجب أن يعمل كل شيء
SELECT id, email, role FROM users WHERE role = 'admin';
```

### 3. التحقق من Logs السيرفر

على Render:
1. اذهب إلى Service > Logs
2. ابحث عن رسائل مثل:
   - `[AUTHORIZE] REJECTED: No permissions for screen`
   - `[PRODUCTS] Error listing products`
   - `[AUTHORIZE] ALLOWED: Admin bypass`

### 4. التحقق من Console المتصفح

1. افتح Developer Tools (F12)
2. اذهب إلى Console
3. ابحث عن أخطاء مثل:
   - `403 Forbidden`
   - `Error loading products`
   - `[Products] Error loading products`

### 5. اختبار API مباشرة

افتح Network tab في Developer Tools وتحقق من:
- Request URL: يجب أن يكون `/api/products` أو `/products`
- Response Status: يجب أن يكون `200 OK`
- Response Body: يجب أن يحتوي على `items` array

## الحلول المحتملة

### الحل 1: إصلاح الصلاحيات

إذا كان المستخدم ليس admin:

```sql
-- جعل المستخدم admin
UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
```

### الحل 2: إضافة صلاحيات للمستخدم

استخدم صفحة إدارة المستخدمين في البرنامج لإضافة صلاحيات "products:view"

### الحل 3: التحقق من is_active

```sql
-- إصلاح is_active
UPDATE products SET is_active = true WHERE is_active IS NULL OR is_active = false;
```

### الحل 4: إعادة تشغيل السيرفر

بعد أي تغييرات، أعد تشغيل السيرفر على Render.
