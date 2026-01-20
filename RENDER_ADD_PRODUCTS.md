# إضافة المنتجات على Render

## الطريقة 1: استخدام Render Shell (موصى به)

1. اذهب إلى Render Dashboard > Service > Shell
2. شغّل الأمر التالي:

```bash
cd backend/scripts
node add_menu_products.js
```

السكريبت سيستخدم `DATABASE_URL` من Environment Variables تلقائياً.

## الطريقة 2: استخدام Render Shell مع تحديد DATABASE_URL

إذا لم يعمل الطريقة الأولى:

```bash
cd backend/scripts
DATABASE_URL="$DATABASE_URL" DB_SSL="true" node add_menu_products.js
```

## الطريقة 3: استخدام SQL مباشرة

إذا لم تعمل السكريبتات، يمكنك استخدام SQL مباشرة:

1. اذهب إلى Render Dashboard > Database > Connect
2. افتح PostgreSQL Shell
3. شغّل الـ SQL التالي (يجب تعديله ليتناسب مع المنتجات):

```sql
-- مثال لإضافة منتج واحد
INSERT INTO products (name, name_en, category, price, cost, tax_rate, stock_quantity, min_stock, is_active, created_at, updated_at)
VALUES ('Butterfly prawn', 'Butterfly prawn', 'Appetizers - المقبلات', 41.74, 29.22, 15, 0, 0, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
```

## ملاحظات

- السكريبت يتخطى المنتجات الموجودة بالفعل
- يمكنك تشغيله عدة مرات بأمان
- تأكد من أن `DATABASE_URL` موجود في Environment Variables على Render
