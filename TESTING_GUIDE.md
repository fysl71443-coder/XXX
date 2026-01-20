# دليل الاختبار الشامل للنظام

## المتطلبات

1. التأكد من أن قاعدة البيانات متصلة ومُعدة
2. التأكد من أن جميع الأعمدة موجودة في جدول `orders`:
   - `subtotal`
   - `discount_amount`
   - `tax_amount`
   - `total_amount`
   - `customer_name`
   - `customer_phone`
   - `customerid`

## خطوات الاختبار

### 1. تشغيل الخادم

```bash
cd backend
npm start
```

الخادم يجب أن يبدأ على المنفذ `10000` (أو المنفذ المحدد في `process.env.PORT`).

### 2. التحقق من قاعدة البيانات

قم بتشغيل الاستعلام التالي للتحقق من أن الأعمدة موجودة:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'customer_name', 'customer_phone', 'customerid');
```

إذا لم تكن موجودة، قم بتشغيل:

```sql
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS customer_phone text DEFAULT '',
ADD COLUMN IF NOT EXISTS customerid integer;
```

### 3. تشغيل الاختبارات الآلية

```bash
node test_draft_calculations.js
```

الاختبار سيقوم بـ:
- ✅ اختبار تسجيل الدخول
- ✅ اختبار إنشاء مسودة جديدة مع حساب القيم
- ✅ اختبار حفظ مسودة من POS
- ✅ اختبار تحديث مسودة
- ✅ اختبار إنشاء مسودة جديدة من POS
- ✅ التحقق من أن جميع الحسابات صحيحة في قاعدة البيانات

### 4. الاختبارات اليدوية

#### اختبار 1: إنشاء مسودة جديدة عبر API

```bash
# تسجيل الدخول
curl -X POST http://localhost:10000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'

# استخدم الـ token في الطلبات التالية
TOKEN="<your-token>"

# إنشاء مسودة جديدة
curl -X POST http://localhost:10000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "branch": "china_town",
    "table_code": "1",
    "status": "DRAFT",
    "lines": [
      {
        "type": "meta",
        "branch": "china_town",
        "table": "1",
        "taxPct": 15
      },
      {
        "type": "item",
        "product_id": 1,
        "name": "Product 1",
        "quantity": 2,
        "price": 100,
        "discount": 10
      },
      {
        "type": "item",
        "product_id": 2,
        "name": "Product 2",
        "quantity": 3,
        "price": 50,
        "discount": 0
      }
    ]
  }'
```

**النتائج المتوقعة:**
- `subtotal`: 350 (2×100 + 3×50)
- `discount_amount`: 10
- `tax_amount`: 51 ((350-10)×15/100)
- `total_amount`: 391 (350-10+51)

#### اختبار 2: حفظ مسودة من POS

```bash
curl -X POST http://localhost:10000/api/pos/saveDraft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "branch": "china_town",
    "table": "2",
    "items": [
      {"id": 1, "quantity": 1, "price": 200, "discount": 20},
      {"id": 2, "quantity": 2, "price": 75, "discount": 0}
    ],
    "taxPct": 15
  }'
```

**النتائج المتوقعة:**
- `subtotal`: 350 (1×200 + 2×75)
- `discount_amount`: 20
- `tax_amount`: 49.5 ((350-20)×15/100)
- `total_amount`: 379.5 (350-20+49.5)

#### اختبار 3: تحديث مسودة

```bash
# استخدم order_id من الاختبار السابق
ORDER_ID=<order-id-from-previous-test>

curl -X PUT http://localhost:10000/api/orders/$ORDER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "lines": [
      {
        "type": "meta",
        "branch": "china_town",
        "table": "1",
        "discountPct": 10,
        "taxPct": 15
      },
      {
        "type": "item",
        "product_id": 1,
        "name": "Product 1",
        "quantity": 5,
        "price": 100,
        "discount": 0
      }
    ]
  }'
```

**النتائج المتوقعة:**
- `subtotal`: 500 (5×100)
- `discount_amount`: 50 (500×10/100 - خصم إجمالي)
- `tax_amount`: 67.5 ((500-50)×15/100)
- `total_amount`: 517.5 (500-50+67.5)

#### اختبار 4: التحقق من قاعدة البيانات

```bash
# استرجاع المسودة من قاعدة البيانات
curl http://localhost:10000/api/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
```

التحقق من أن:
- القيم (`subtotal`, `discount_amount`, `tax_amount`, `total_amount`) موجودة ومُحدثة
- القيم مطابقة للحسابات المتوقعة
- `customer_name`, `customer_phone`, `customerid` محدثة إن كان هناك عميل

### 5. اختبار من واجهة المستخدم (POS)

1. افتح واجهة POS في المتصفح
2. اختر فرعًا وطاولة
3. أضف منتجات إلى الطلب
4. احفظ المسودة
5. تحقق من أن القيم (`subtotal`, `tax_amount`, `total_amount`) تظهر بشكل صحيح
6. افتح المسودة مرة أخرى وتحقق من أن القيم محفوظة بشكل صحيح

## قواعد الحساب

### subtotal
```
subtotal = Σ(quantity × price) لكل العناصر من نوع 'item'
```

### discount_amount
```
discount_amount = Σ(discount) لكل العناصر + (subtotal × discountPct / 100) إذا كان هناك خصم إجمالي
```

### tax_amount
```
tax_amount = ((subtotal - discount_amount) × taxPct) / 100
```

### total_amount
```
total_amount = subtotal - discount_amount + tax_amount
```

## التحقق من الأخطاء المحتملة

1. **القيم غير موجودة في الاستجابة:**
   - تحقق من أن دالة `calculateOrderTotals` تعمل بشكل صحيح
   - تحقق من أن التحديث في قاعدة البيانات يحدث

2. **القيم غير صحيحة:**
   - تحقق من منطق الحساب في `calculateOrderTotals`
   - تحقق من أن `lines` تحتوي على `type: 'item'` و `type: 'meta'` بشكل صحيح

3. **القيم غير موجودة في قاعدة البيانات:**
   - تحقق من أن استعلامات UPDATE و INSERT تحتوي على جميع الأعمدة
   - تحقق من أن الأعمدة موجودة في الجدول

## ملاحظات

- جميع الحسابات يجب أن تكون تلقائية - لا حاجة لتحديث يدوي
- عند إنشاء أو تحديث مسودة، يجب تحديث الأعمدة في قاعدة البيانات مباشرة
- القيم في `lines[0].meta` وفي أعمدة قاعدة البيانات يجب أن تكون متطابقة
