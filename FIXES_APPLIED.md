# 🔧 الإصلاحات المُطبقة

## ✅ المشكلة 1: خطأ 404 في تحميل الصور (logo192.png)

### المشكلة:
- المتصفح يحاول تحميل `/expenses/logo192.png` بدلاً من `/logo192.png`
- السبب: مسار نسبي في `manifest.json` يتغير حسب صفحة التنقل

### الحل:
تم تغيير المسارات في `backend/frontend/public/manifest.json` من مسارات نسبية إلى مطلقة:

```json
{
  "src": "/logo192.png",  // كان: "logo192.png"
  "src": "/logo512.png",  // كان: "logo512.png"
  "src": "/favicon.ico"   // كان: "favicon.ico"
}
```

**النتيجة:** ✅ الآن الصور تُحمّل من المسار الجذر `/` بغض النظر عن صفحة التنقل

---

## ✅ المشكلة 2: خطأ saveDraft - Invariant violated: saveDraft returned no order_id

### المشكلة:
- عند حفظ مسودة بدون تغييرات، `lockedSaveDraft` كانت ترجع `undefined`
- هذا يسبب خطأ "Invariant violated: saveDraft returned no order_id"
- الكود في السطر 700 يتحقق من `if (cleanedItems.length>0 && !id)` ويرمي خطأ إذا لم يكن هناك `id`

### الحل:
تم تعديل `backend/frontend/src/pages/POSInvoice.jsx` لإرجاع `order_id` الحالي حتى عند عدم وجود تغييرات:

```javascript
if (lastSavedHashRef.current === hash) { 
  try { console.log('[Draft] Skipped (no changes)') } catch {}
  // Return existing order_id even if no changes to prevent invariant violation
  const normB = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase()
  const k1 = `pos_order_${branch}_${table}`
  const k2 = `pos_order_${normB(branch)}_${table}`
  const existingOrderId = orderId || localStorage.getItem(k1) || localStorage.getItem(k2) || null
  if (existingOrderId) {
    return { order_id: existingOrderId, id: existingOrderId }
  }
  return // Only return undefined if no order exists yet
}
```

**النتيجة:** ✅ الآن عند عدم وجود تغييرات، تُرجع الدالة `order_id` الحالي بدلاً من `undefined`

---

## 📋 الملفات المُعدلة

1. `backend/frontend/public/manifest.json` - مسارات الصور مطلقة
2. `backend/frontend/src/pages/POSInvoice.jsx` - إرجاع `order_id` عند عدم وجود تغييرات

---

## 🧪 الاختبار

### اختبار المشكلة 1:
1. افتح أي صفحة مثل `/expenses`
2. تحقق من Console - يجب ألا يظهر خطأ 404 لـ `logo192.png`
3. المسار يجب أن يكون `/logo192.png` وليس `/expenses/logo192.png`

### اختبار المشكلة 2:
1. افتح POS
2. أضف عناصر واتركها كما هي (بدون تغيير)
3. انتظر حفظ المسودة
4. تحقق من Console - يجب ألا يظهر "Invariant violated: saveDraft returned no order_id"

---

## ⚡ ملاحظات

- **manifest.json**: بعد التغيير، قد تحتاج إلى rebuild frontend أو مسح cache المتصفح
- **saveDraft**: الإصلاح يعمل مع المسودات الموجودة مسبقاً والجديدة

---

**الحالة:** ✅ تم إصلاح المشكلتين
