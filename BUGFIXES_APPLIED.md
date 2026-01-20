# 🔧 الإصلاحات المُطبقة - مشكلات المسودة وإصدار الفاتورة

## ✅ المشكلة 1: فشل تحميل بيانات المسودة عند العودة لها

### المشكلة:
- عند إنشاء مسودة والرجوع للطاولات والعودة للمسودة مرة أخرى، يفشل النظام في جلب بياناتها
- ملخص الإيصال يظهر فارغاً

### السبب:
- `hasLoadedOrderRef.current` يتم تعيينه إلى `true` عند التحميل الأول
- هذا يمنع إعادة التحميل عند العودة للمسودة مرة أخرى
- لم يكن هناك تحقق من تغيير `orderId` لإعادة تعيين الـ ref

### الحل:
تم تعديل `useEffect` في `POSInvoice.jsx` لإعادة تعيين `hasLoadedOrderRef` عندما يتغير `orderId`:

```javascript
// Reset hasLoadedOrderRef if orderId changed to allow reloading when returning to the order
if (hasLoadedOrderRef.current && hydratedOrderIdRef.current !== String(effectiveId)) {
  hasLoadedOrderRef.current = false
}
```

**النتيجة:** ✅ الآن عند العودة للمسودة، سيتم إعادة تحميل بياناتها بشكل صحيح

---

## ✅ المشكلة 2: فشل إصدار الفاتورة مباشرة بعد إضافة أصناف

### المشكلة:
- عند إضافة أصناف والنقر مباشرة على إصدار الفاتورة، يفشل إصدار الفاتورة
- رسالة خطأ: `errors.issue_failed` / `errors.issue_failed_note`

### السبب:
1. **تنسيق الـ payload غير صحيح**: `issueInvoice` كان يرسل `items` بدلاً من `lines`
2. **أسماء الحقول غير متطابقة**: 
   - Frontend: `customerId`, `paymentType`, `invoiceNumber`, `discountPct`, `taxPct`
   - Backend: `customer_id`, `payment_method`, `number`, `discount_pct`, `tax_pct`
3. **عدم حساب المبالغ**: لم يتم إرسال `subtotal`, `discount_amount`, `tax_amount`, `total`
4. **التحقق من الرد غير صحيح**: الكود يتحقق من `res.success` لكن Backend يرجع `invoice` مباشرة

### الحل:

#### 1. تغيير `items` إلى `lines`:
```javascript
const lines = safeItems.map(it => ({
  type: 'item',
  product_id: it.product_id || it.id,
  name: it.name || '',
  qty: Number(it.qty||it.quantity||0),
  price: Number(it.price||0),
  discount: Number(it.discount||0)
}))
```

#### 2. تصحيح أسماء الحقول:
```javascript
const payload = {
  lines: lines,  // Instead of items
  customer_id: partnerId||null,  // Instead of customerId
  payment_method: pmSend,  // Instead of paymentType
  number: String(invoiceNumber||''),  // Instead of invoiceNumber
  discount_pct: Number(discountPct||0),  // Instead of discountPct
  tax_pct: taxPctVal,  // Instead of taxPct
  subtotal: subtotalVal,
  discount_amount: discountVal,
  tax_amount: taxVal,
  total: totalVal,
  status: 'posted'
}
```

#### 3. حساب المبالغ قبل الإرسال:
```javascript
const subtotalVal = calculateSubtotal(safeItems)
const discountVal = calculateDiscount(safeItems)
const taxVal = ((subtotalVal - discountVal) * taxPctVal) / 100
const totalVal = subtotalVal - discountVal + taxVal
```

#### 4. تصحيح التحقق من الرد:
```javascript
// Backend returns invoice object directly, not { success: true, invoice }
if (!res || !res.id) { showAlert(...); return }
const inv = res || { id: null, number: null }  // Instead of res.invoice
```

#### 5. تصحيح اسم الحقل `invoice_number` → `number`:
```javascript
invoiceNo: String(inv.number||inv.invoice_number||'')  // Backend returns 'number', not 'invoice_number'
```

**النتيجة:** ✅ الآن إصدار الفاتورة يعمل بشكل صحيح حتى مباشرة بعد إضافة أصناف

---

## 📋 الملفات المُعدلة:

1. ✅ `backend/frontend/src/pages/POSInvoice.jsx`:
   - إصلاح `hasLoadedOrderRef` للسماح بإعادة التحميل
   - تصحيح تنسيق `issueInvoice` payload
   - حساب المبالغ قبل الإرسال
   - تصحيح التحقق من الرد

---

## 🧪 الاختبار:

### اختبار المشكلة 1:
1. أنشئ مسودة مع أصناف
2. ارجع للطاولات
3. افتح المسودة مرة أخرى
4. ✅ يجب أن تظهر بيانات المسودة بشكل صحيح في ملخص الإيصال

### اختبار المشكلة 2:
1. أضف أصناف للطاولة
2. اضغط مباشرة على "إصدار الفاتورة"
3. ✅ يجب أن يعمل إصدار الفاتورة بدون أخطاء

---

## ⚡ ملاحظات:

- **Backend**: يتوقع `lines` (بشكل array مع `type: 'item'`) وليس `items`
- **Backend**: يرجع `invoice` object مباشرة، ليس `{ success: true, invoice }`
- **Backend**: يرجع `number` للحقل، ليس `invoice_number`

---

**الحالة:** ✅ تم إصلاح المشكلتين
