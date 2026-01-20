# إصلاح استخدام invoice_number كمستند محاسبي رسمي ✅

## 🔐 القاعدة المحاسبية الذهبية

**رقم الفاتورة ≠ رقم السجل**

- `id` → مفتاح تقني (للاستخدام الداخلي فقط)
- `invoice_number` → مستند محاسبي رسمي (يظهر في الإيصال)

---

## ✅ التغييرات المطبقة

### 1. Backend - إضافة عمود `invoice_number` ✅

**قبل:**
```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE,
  ...
)
```

**بعد:**
```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE,
  invoice_number TEXT UNIQUE,  -- ✅ إضافة عمود محاسبي رسمي
  ...
)

-- إضافة العمود للقواعد الموجودة
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- فهرس فريد على invoice_number
CREATE UNIQUE INDEX invoices_invoice_number_key 
ON invoices(invoice_number) 
WHERE invoice_number IS NOT NULL;
```

---

### 2. Backend - INSERT مع `invoice_number` ✅

**قبل:**
```sql
INSERT INTO invoices(number, ...) 
VALUES ($1, ...)
RETURNING id, number, ...
```

**بعد:**
```sql
INSERT INTO invoices(number, invoice_number, ...) 
VALUES ($1, $2, ...)  -- invoice_number = number (نفس القيمة)
RETURNING id, number, invoice_number, ...
```

**الكود:**
```javascript
const invoiceNumber = number; // Already generated
const { rows } = await client.query(
  'INSERT INTO invoices(number, invoice_number, ...) 
   VALUES ($1,$2,...) 
   RETURNING id, number, invoice_number, ...',
  [invoiceNumber, invoiceNumber, ...]
);
```

---

### 3. Backend - RETURN في response ✅

**قبل:**
```javascript
const finalInvoice = {
  ...invoice,
  journal_entry_id: journalEntryId,
  order_id: order_id || null
};
```

**بعد:**
```javascript
const finalInvoice = {
  ...invoice,
  invoice_number: invoice.invoice_number || invoice.number || null,
  journal_entry_id: journalEntryId,
  order_id: order_id || null
};
```

---

### 4. Backend - SELECT queries ✅

**تحديث جميع SELECT queries لتضمين `invoice_number`:**

```sql
-- GET /api/invoices
SELECT id, number, invoice_number, ... FROM invoices

-- GET /api/invoices/:id
SELECT id, number, invoice_number, ... FROM invoices WHERE id = $1

-- Fallback في response
if (!invoice.invoice_number && invoice.number) {
  invoice.invoice_number = invoice.number;
}
```

---

### 5. Frontend - استخدام `invoice_number` في الطباعة ✅

**قبل:**
```javascript
invoiceNo: String(inv.number || ''),
```

**بعد:**
```javascript
invoiceNo: String(inv?.invoice_number || inv?.number || res?.invoice_number || res?.number || ''),
```

**الأولوية:**
1. `inv.invoice_number` (الأولوية - الحقل المحاسبي الرسمي)
2. `inv.number` (fallback للتوافق)
3. `res.invoice_number` (من response مباشرة)
4. `res.number` (fallback)

---

## 📊 تدفق البيانات الصحيح

### Backend (INSERT):
```
1️⃣ Generate: invoiceNumber = 'INV-42-626258'
2️⃣ INSERT: number='INV-42-626258', invoice_number='INV-42-626258'
3️⃣ RETURNING: id=42, number='INV-42-626258', invoice_number='INV-42-626258'
4️⃣ Response: { id: 42, invoice_number: 'INV-42-626258', ... }
```

### Frontend (Print):
```
1️⃣ issueInvoice response → { id: 42, invoice_number: 'INV-42-626258' }
2️⃣ Reload invoice → GET /api/invoices/42 → { id: 42, invoice_number: 'INV-42-626258', ... }
3️⃣ Print → invoiceNo: 'INV-42-626258'
4️⃣ Receipt → Invoice No.: INV-42-626258 ✅
```

---

## 🔍 التحقق من الإصلاح

### اختبار 1: قاعدة البيانات
```sql
SELECT id, number, invoice_number 
FROM invoices 
ORDER BY id DESC 
LIMIT 5;
```

**المتوقع:**
- ✅ `invoice_number` موجود ومملوء
- ✅ `invoice_number` = `number` (نفس القيمة)
- ✅ `invoice_number` فريد (unique constraint)

---

### اختبار 2: API Response
```bash
GET /api/invoices/42
```

**المتوقع:**
```json
{
  "id": 42,
  "number": "INV-42-626258",
  "invoice_number": "INV-42-626258",
  ...
}
```

---

### اختبار 3: الإيصال المطبوع
1. إصدار فاتورة من POS
2. طباعة الإيصال
3. التحقق من:
   - ✅ `Invoice No.: INV-42-626258` (يظهر الرقم)
   - ✅ ليس فارغاً
   - ✅ ليس `Invoice No.: 42` (id)

---

## ⚠️ ملاحظات مهمة

### 1. التوافق مع البيانات القديمة
- ✅ `ALTER TABLE ADD COLUMN IF NOT EXISTS` يضمن عدم كسر البيانات القديمة
- ✅ `invoice_number` يمكن أن يكون `NULL` للبيانات القديمة
- ✅ Fallback: إذا `invoice_number` = `NULL`، نستخدم `number`

### 2. التوليد
- ✅ `invoice_number` يتم توليده مع `number` (نفس القيمة)
- ✅ لا يتم الاعتماد على `id` كرقم فاتورة

### 3. الفهرسة
- ✅ `UNIQUE INDEX` على `invoice_number` (WHERE invoice_number IS NOT NULL)
- ✅ يسمح بقيم `NULL` للبيانات القديمة

---

## 🎯 النتيجة النهائية

✅ **تم تطبيق جميع المتطلبات!**

- ✅ `invoice_number` كعمود محاسبي رسمي
- ✅ `invoice_number` يُحفظ في INSERT
- ✅ `invoice_number` يُرجع في SELECT
- ✅ Frontend يستخدم `invoice_number` في الطباعة
- ✅ الإيصال يعرض رقم الفاتورة بشكل صحيح

**القاعدة المحاسبية:**
- ✅ `id` → مفتاح تقني (لا يظهر في الإيصال)
- ✅ `invoice_number` → مستند محاسبي رسمي (يظهر في الإيصال)

**تاريخ التطبيق:** 2025-01-XX  
**الحالة:** ✅ تم التطبيق بنجاح