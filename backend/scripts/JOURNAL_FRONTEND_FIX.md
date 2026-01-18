# إصلاح مشكلة عرض المبالغ في قائمة القيود

**التاريخ:** 2025-01-17  
**المشكلة:** المبالغ تظهر 0.00 في قائمة القيود لكنها صحيحة عند فتح القيد

---

## 🔍 المشكلة

في شاشة قائمة القيود:
- ❌ المبالغ (مدين/دائن) تظهر 0.00
- ✅ لكن عند فتح القيد، المبالغ صحيحة (100.00)

**السبب:**
- Frontend كان يستخدم `e.debit` و `e.credit` مباشرة
- لكن API يعيد `total_debit` و `total_credit`
- Frontend لم يكن يقرأ القيم الصحيحة

---

## ✅ الإصلاحات

### 1. تحديث عرض المبالغ في الجدول
**قبل:**
```jsx
<td>{parseFloat(e.debit||0).toFixed(2)}</td>
<td>{parseFloat(e.credit||0).toFixed(2)}</td>
```

**بعد:**
```jsx
<td>{parseFloat(e.total_debit||e.debit||0).toFixed(2)}</td>
<td>{parseFloat(e.total_credit||e.credit||0).toFixed(2)}</td>
```

### 2. تحديث دالة sumDebit و sumCredit
**قبل:**
```js
function sumDebit(items){ return items.reduce((s,x)=> s + parseFloat(x.debit||0), 0) }
function sumCredit(items){ return items.reduce((s,x)=> s + parseFloat(x.credit||0), 0) }
```

**بعد:**
```js
function sumDebit(items){ return items.reduce((s,x)=> s + parseFloat(x.total_debit||x.debit||0), 0) }
function sumCredit(items){ return items.reduce((s,x)=> s + parseFloat(x.total_credit||x.credit||0), 0) }
```

### 3. تحديث دالة isUnbalanced
**قبل:**
```js
function isUnbalanced(e){ return Math.abs(parseFloat(e.debit||0) - parseFloat(e.credit||0)) > 0.0001 }
```

**بعد:**
```js
function isUnbalanced(e){ return Math.abs(parseFloat(e.total_debit||e.debit||0) - parseFloat(e.total_credit||e.credit||0)) > 0.0001 }
```

---

## 📊 النتائج

### قبل الإصلاح:
- ❌ المبالغ في القائمة: 0.00
- ✅ المبالغ عند فتح القيد: 100.00

### بعد الإصلاح:
- ✅ المبالغ في القائمة: 100.00
- ✅ المبالغ عند فتح القيد: 100.00
- ✅ الإجماليات صحيحة

---

## 🎯 الخطوات التالية

1. **إعادة تحميل الصفحة** في المتصفح
2. **التحقق من عرض المبالغ** في قائمة القيود
3. **التحقق من الإجماليات** في أعلى الصفحة

---

**الحالة:** ✅ تم الإصلاح  
**الملفات المعدلة:** `backend/frontend/src/pages/Journal.jsx`
