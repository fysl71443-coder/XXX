# ✅ إصلاح مشكلة "customerId is not defined"

## 🔍 المشكلة

في `handleIssueInvoice` (backend/server.js:6055)، الكود كان يستخدم `customerId` بدلاً من `customer_id`:

```javascript
// ❌ قبل الإصلاح:
console.error('[POS] CRITICAL: Failed to create journal entry', {
  invoiceId: invoice.id,
  customerId,  // ❌ غير معرّف - يجب أن يكون customer_id
  ...
});
```

## ✅ الحل

تم تغيير `customerId` إلى `customer_id` في السطر 6055:

```javascript
// ✅ بعد الإصلاح:
console.error('[POS] CRITICAL: Failed to create journal entry', {
  invoiceId: invoice.id,
  customer_id: customer_id,  // ✅ صحيح
  ...
});
```

## 📋 التحقق من الكود

### 1. تعريف `customer_id` (السطر 5665):

```javascript
const customer_id = b.customer_id || null;  // ✅ صحيح
```

### 2. تمرير `customer_id` إلى `createInvoiceJournalEntry` (السطر 6040):

```javascript
journalEntryId = await createInvoiceJournalEntry(
  invoice.id,
  customer_id,  // ✅ صحيح - يُمرر بشكل صحيح
  subtotal,
  discount_amount,
  tax_amount,
  total,
  effectivePaymentMethod,
  branch,
  client,
  linesArray
);
```

### 3. استخدام `customerId` في `createInvoiceJournalEntry` (السطر 5329):

```javascript
async function createInvoiceJournalEntry(invoiceId, customerId, ...) {
  // ✅ صحيح - customerId هو parameter للدالة
  // الدالة تستقبل customerId وتستخدمه بشكل صحيح
}
```

## ✅ الخلاصة

**المشكلة كانت فقط في `console.error` - استخدام `customerId` بدلاً من `customer_id`**

**الحل**: تم تغيير `customerId` إلى `customer_id: customer_id` في السطر 6055

---

## 🧪 للاختبار

بعد الإصلاح، جرّب:

1. إنشاء فاتورة بدون عميل (`customer_id: null`)
2. إنشاء فاتورة مع عميل (`customer_id: 123`)
3. التحقق من server logs - يجب ألا ترى "customerId is not defined"

**النتيجة المتوقعة**: ✅ الفاتورة تُحفظ بنجاح في قاعدة البيانات
