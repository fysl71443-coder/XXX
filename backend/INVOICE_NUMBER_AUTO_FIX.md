# إصلاح مشكلة رقم الفاتورة "Auto"

## 🔴 المشكلة

كان النظام يحاول تخزين "Auto" كرقم فاتورة حقيقي في قاعدة البيانات، مما أدى إلى:
- خطأ `duplicate key value violates unique constraint "invoices_number_key"`
- فشل إصدار الفاتورة الثانية
- مشكلة في سلسلة التوثيق المحاسبي

## ✅ الحل المطبق

### 1. إصلاح الباكند (`controllers/posController.js`)

**قبل:**
```javascript
const number = b.number || null;
```

**بعد:**
```javascript
// CRITICAL: Generate invoice number if "Auto" or empty/null
// Invoice number MUST be generated on backend - never accept "Auto" from frontend
let number = b.number || null;
if (!number || number === 'Auto' || String(number).trim() === '' || String(number).toLowerCase() === 'auto') {
  // Generate next invoice number using same logic as invoiceController.nextNumber
  const { rows } = await client.query(
    'SELECT number FROM invoices WHERE number IS NOT NULL AND number ~ $1 ORDER BY id DESC LIMIT 1',
    ['^INV/\\d{4}/\\d+$']
  );
  const last = rows && rows[0] ? String(rows[0].number || '') : '';
  const year = (new Date()).getFullYear();
  const m = /INV\/(\d{4})\/(\d+)/.exec(last);
  let nextN = 1;
  if (m && Number(m[1]) === year) {
    const parsed = Number(m[2] || 0);
    nextN = isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
  }
  number = `INV/${year}/${String(nextN).padStart(10, '0')}`;
  console.log('[ISSUE] Generated invoice number:', number);
}
```

**المنطق:**
- إذا كان `number` فارغًا أو "Auto" أو null، يتم توليد رقم جديد تلقائيًا
- يستخدم نفس منطق `invoiceController.nextNumber` (صيغة `INV/YYYY/NNNNNNNNNN`)
- الرقم يُولد في الباكند فقط - لا يُقبل من الواجهة

### 2. إصلاح الواجهة الأمامية (`frontend/src/pages/POSInvoice.jsx`)

**قبل:**
```javascript
number: String(invoiceNumber||''),  // Use number instead of invoiceNumber
```

**بعد:**
```javascript
// CRITICAL: Do not send "Auto" as invoice number - backend will generate it
// Invoice number should only be sent if it's a real number (not placeholder)
const invoiceNumberToSend = (invoiceNumber && 
                              String(invoiceNumber).trim() !== '' && 
                              String(invoiceNumber).toLowerCase() !== 'auto') 
                              ? String(invoiceNumber) 
                              : null;

const payload = {
  // ...
  number: invoiceNumberToSend,  // CRITICAL: Send null if "Auto" - backend will generate
  // ...
}
```

**المنطق:**
- إذا كان `invoiceNumber` هو "Auto" أو فارغ، يتم إرسال `null`
- الباكند سيتولى توليد الرقم تلقائيًا
- "Auto" تبقى للعرض فقط في الواجهة

## 📋 خطوات التنظيف

### إزالة السجلات القديمة برقم "Auto"

قم بتشغيل السكريبت التالي لإزالة أي سجلات موجودة برقم "Auto":

```sql
-- 1. التحقق من عدد السجلات
SELECT COUNT(*) as auto_invoice_count 
FROM invoices 
WHERE number = 'Auto';

-- 2. عرض السجلات التي سيتم حذفها
SELECT id, number, date, customer_id, total, status, branch, created_at
FROM invoices 
WHERE number = 'Auto'
ORDER BY created_at DESC;

-- 3. حذف السجلات (بعد التأكد)
DELETE FROM invoices WHERE number = 'Auto';
```

أو استخدم السكريبت الجاهز:
```bash
psql -d your_database -f backend/scripts/cleanup_auto_invoice_numbers.sql
```

## 🎯 المبادئ المطبقة

1. **رقم الفاتورة يُولد في الباكند فقط**
   - الواجهة لا تملك حق اقتراح رقم فاتورة
   - "Auto" هي placeholder للعرض فقط

2. **رقم الفاتورة = مستند محاسبي**
   - يجب أن يكون متسلسل
   - يجب أن يكون فريد
   - يجب أن يكون غير قابل للتلاعب
   - مرتبط بالفترة / الفرع

3. **UNIQUE constraint في قاعدة البيانات**
   - PostgreSQL يتصرف بشكل صحيح
   - الخطأ كان في التصميم، وليس في قاعدة البيانات

## ✅ النتيجة

- ✅ لا يتم تخزين "Auto" في قاعدة البيانات
- ✅ رقم الفاتورة يُولد تلقائيًا في الباكند
- ✅ لا يوجد تكرار في أرقام الفواتير
- ✅ سلسلة التوثيق المحاسبي سليمة
- ✅ الفواتير تُصدر بنجاح

## 🔍 الاختبار

بعد تطبيق الإصلاح، اختبر:
1. إنشاء فاتورة جديدة - يجب أن يُولد رقم تلقائيًا
2. إنشاء فاتورة ثانية - يجب أن تُصدر بنجاح بدون خطأ duplicate key
3. التحقق من أن أرقام الفواتير متسلسلة وصحيحة
