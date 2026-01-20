# 📋 شرح تفصيلي: كيفية إنشاء الفاتورة داخل النظام

## 🔄 نظرة عامة على العملية

العملية تمر عبر **6 مراحل رئيسية** من Frontend إلى Backend:

1. **Frontend: تحضير البيانات** → بناء payload
2. **Frontend: إرسال الطلب** → استدعاء API
3. **Backend: بدء Transaction** → BEGIN
4. **Backend: إنشاء الفاتورة** → INSERT INTO invoices
5. **Backend: إنشاء القيد المحاسبي** → journal entry + postings
6. **Backend: إنهاء Transaction** → COMMIT أو ROLLBACK

---

## 📍 المرحلة 1: Frontend - تحضير البيانات

### الملف: `backend/frontend/src/pages/POSInvoice.jsx`

### الخطوة 1.1: حفظ المسودة أولاً (`saveDraft`)

**الموقع**: السطر ~480-600

```javascript
async function lockedSaveDraft(payload) {
  // 1. تحويل items إلى lines (مع type='item' لكل عنصر)
  const normalized = {
    ...payload,
    items: payload.items.map(it => ({
      type: 'item',
      product_id: it.id || it.product_id,
      name: it.name,
      qty: Number(it.qty || it.quantity || 0),
      price: Number(it.price || 0),
      discount: Number(it.discount || 0)
    }))
  };
  
  // 2. حفظ المسودة في orders table
  const res = await apiOrders.saveDraft(normalized);
  
  // 3. الحصول على order_id
  const orderId = res?.order_id || res?.id;
  
  return res;
}
```

**النتيجة**: يحصل على `order_id` من المسودة المحفوظة

### الخطوة 1.2: بناء Payload للإصدار (`issue`)

**الموقع**: السطر ~860-910

```javascript
async function issue() {
  // 1. التأكد من وجود order_id
  let id = await saveDraft(); // order_id
  
  // 2. بناء payload للإصدار
  const payload = {
    order_id: id,  // ⚠️ CRITICAL: order_id مطلوب
    tableId: Number(table),
    table: String(table),
    branchId: Number(sel?.id || 0),
    branch: String(branch),
    
    // الخطوط (items → lines)
    lines: items.map(it => ({
      type: 'item',
      product_id: it.id || it.product_id,
      name: it.name,
      qty: Number(it.qty || it.quantity || 0),
      price: Number(it.price || 0),
      discount: Number(it.discount || 0)
    })),
    
    // بيانات العميل
    customer_id: partnerId || null,
    
    // طريقة الدفع
    payment_method: paymentMethod || 'CASH',
    
    // رقم الفاتورة (سيتم توليده تلقائياً إذا كان "Auto")
    number: 'Auto',
    
    // الخصومات والضرائب
    discount_pct: Number(discountPct || 0),
    tax_pct: Number(taxPct || 15),
    
    // المبالغ المحسوبة
    subtotal: calculateSubtotal(items),
    discount_amount: calculateDiscount(items),
    tax_amount: calculateTax(items, taxPct),
    total: calculateTotal(items, discountPct, taxPct),
    
    // الحالة
    status: 'posted'  // ⚠️ CRITICAL: 'posted' يعني يجب إنشاء journal entry
  };
  
  // 3. إرسال الطلب
  const res = await issueInvoice(paymentMethod, id);
}
```

**النتيجة**: payload جاهز مع `order_id` و `lines` و `status: 'posted'`

---

## 📍 المرحلة 2: Frontend - إرسال الطلب

### الملف: `backend/frontend/src/services/api/index.js`

**الموقع**: السطر ~238

```javascript
export const pos = {
  issueInvoice: (paymentMethod, orderId) => {
    return request('/pos/issueInvoice', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        payment_method: paymentMethod,
        // ... باقي البيانات من payload
      })
    });
  }
}
```

**API Endpoint**: `POST /pos/issueInvoice`

---

## 📍 المرحلة 3: Backend - بدء Transaction

### الملف: `backend/server.js`

**الموقع**: السطر 5544-5567

```javascript
async function handleIssueInvoice(req, res) {
  // 1. الاتصال بقاعدة البيانات
  const client = await pool.connect();
  
  try {
    // 2. بدء Transaction
    await client.query('BEGIN');
    
    const b = req.body || {};
    
    // 3. التحقق من order_id (مطلوب)
    const order_id = b.order_id ? Number(b.order_id) : null;
    
    if (!order_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: "missing_order_id", 
        details: "order_id is required" 
      });
    }
  }
}
```

**النتيجة**: Transaction بدأ، `order_id` موجود

---

## 📍 المرحلة 4: Backend - توليد رقم الفاتورة

**الموقع**: السطر 5571-5611

```javascript
// 1. التحقق من رقم الفاتورة (إذا كان موجوداً)
let number = b.number || null;

if (number && number !== 'Auto') {
  // التحقق من عدم تكراره
  const { rows: existingRows } = await client.query(
    'SELECT id FROM invoices WHERE number = $1',
    [number]
  );
  if (existingRows && existingRows.length > 0) {
    number = null; // سيتم توليد رقم جديد
  }
}

// 2. توليد رقم فاتورة جديد إذا لم يكن موجوداً
if (!number || number === 'Auto') {
  // محاولة استخدام sequence
  const { rows: seqCheck } = await client.query(
    "SELECT EXISTS(SELECT 1 FROM pg_sequences WHERE sequencename = 'invoice_number_seq') as exists"
  );
  
  if (seqCheck && seqCheck[0] && seqCheck[0].exists) {
    // استخدام sequence
    const { rows: seqRows } = await client.query("SELECT nextval('invoice_number_seq') as next_num");
    number = `INV-${seqRows[0].next_num}`;
  } else {
    // توليد رقم باستخدام max id + timestamp
    const { rows: maxRows } = await client.query('SELECT COALESCE(MAX(id), 0) as max_id FROM invoices');
    const maxId = maxRows && maxRows[0] ? Number(maxRows[0].max_id || 0) : 0;
    const timestamp = Date.now().toString().slice(-6);
    number = `INV-${maxId + 1}-${timestamp}`;
  }
}
```

**النتيجة**: `number` جاهز (مثلاً: `INV-3-852562`)

---

## 📍 المرحلة 5: Backend - جلب بيانات الطلب وتحضير Lines

**الموقع**: السطر 5630-5933

```javascript
// 1. جلب بيانات الطلب من orders table
if (order_id) {
  const { rows: orderRows } = await client.query(
    'SELECT id, status, invoice_id, lines FROM orders WHERE id=$1 FOR UPDATE',
    [order_id]
  );
  const order = orderRows && orderRows[0];
  
  // 2. التحقق من حالة الطلب (يجب أن يكون DRAFT)
  if (!order || order.status !== 'DRAFT') {
    await client.query('ROLLBACK');
    return res.status(400).json({ 
      error: "invalid_order_status",
      details: "Order must be in DRAFT status" 
    });
  }
  
  // 3. استخدام lines من الطلب (أو من req.body)
  let lines = Array.isArray(b.lines) ? b.lines : 
              (Array.isArray(order.lines) ? order.lines : []);
  
  // 4. تطبيع Lines (ضمان وجود type='item')
  const linesArray = lines
    .filter(item => item && item.type === 'item')
    .map(item => ({
      type: 'item',
      product_id: item.product_id || item.id || null,
      name: item.name || item.product_name || '',
      qty: Number(item.qty || item.quantity || 0),
      price: Number(item.price || item.unit_price || 0),
      discount: Number(item.discount || 0)
    }));
}
```

**النتيجة**: `linesArray` جاهز بتنسيق موحد

---

## 📍 المرحلة 6: Backend - إنشاء الفاتورة (INSERT)

**الموقع**: السطر 5956-5967

```javascript
// 1. تحويل linesArray إلى JSON string
const linesJson = JSON.stringify(linesArray);

// 2. استخراج البيانات
const invoiceNumber = number;
const date = b.date || new Date();
const customer_id = b.customer_id || null;
const subtotal = Number(b.subtotal || 0);
const discount_pct = Number(b.discount_pct || 0);
const discount_amount = Number(b.discount_amount || 0);
const tax_pct = Number(b.tax_pct || 0);
const tax_amount = Number(b.tax_amount || 0);
const total = Number(b.total || 0);
const payment_method = b.payment_method || null;
const branch = b.branch || req.user?.default_branch || 'china_town';
const status = String(b.status || 'posted');

// 3. INSERT INTO invoices
const { rows } = await client.query(
  `INSERT INTO invoices(
    number, invoice_number, date, customer_id, lines, 
    subtotal, discount_pct, discount_amount, 
    tax_pct, tax_amount, total, payment_method, status, branch
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) 
  RETURNING id, number, invoice_number, status, total, branch`,
  [
    invoiceNumber, invoiceNumber, date, customer_id, linesJson, 
    subtotal, discount_pct, discount_amount, 
    tax_pct, tax_amount, total, payment_method, status, branch
  ]
);

const invoice = rows && rows[0];

if (!invoice) {
  await client.query('ROLLBACK');
  return res.status(500).json({ 
    error: "server_error", 
    details: "Failed to create invoice" 
  });
}
```

**النتيجة**: ✅ الفاتورة تم إنشاؤها في `invoices` table مع `id` جديد

---

## 📍 المرحلة 7: Backend - إنشاء القيد المحاسبي (Journal Entry)

**الموقع**: السطر 5969-6026

```javascript
// 1. التحقق من total > 0
if (total > 0) {
  // 2. تحديد طريقة الدفع الفعلية
  let effectivePaymentMethod = payment_method?.toLowerCase().trim() || '';
  if (!effectivePaymentMethod && customer_id) {
    effectivePaymentMethod = 'credit'; // عميل آجل
  } else if (!effectivePaymentMethod) {
    effectivePaymentMethod = 'cash'; // افتراضي
  }
  
  // 3. إنشاء القيد المحاسبي
  journalEntryId = await createInvoiceJournalEntry(
    invoice.id,           // invoice_id
    customer_id,          // customer_id
    subtotal,            // subtotal
    discount_amount,     // discount
    tax_amount,          // tax
    total,               // total
    effectivePaymentMethod, // payment_method
    branch,              // branch
    client,              // ⚠️ CRITICAL: client للـ transaction
    linesArray           // lines للـ COGS calculation
  );
  
  // 4. ⚠️ CRITICAL: التحقق من نجاح إنشاء journal entry
  if (!journalEntryId) {
    console.error('[POS] CRITICAL: Failed to create journal entry');
    await client.query('ROLLBACK');  // ⚠️ ROLLBACK هنا يلغي الفاتورة أيضاً!
    return res.status(500).json({ 
      error: "accounting_entry_failed", 
      details: "Journal entry creation failed → ROLLBACK" 
    });
  }
  
  // 5. ربط journal entry بالفاتورة
  await client.query(
    'UPDATE invoices SET journal_entry_id = $1, status = $2 WHERE id = $3',
    [journalEntryId, 'posted', invoice.id]
  );
} else {
  console.warn('[POS] Invoice with zero total, skipping journal entry');
}
```

**النتيجة**: ✅ Journal entry تم إنشاؤه وربطه بالفاتورة

---

## 📍 المرحلة 8: Backend - إغلاق الطلب وتحرير الطاولة

**الموقع**: السطر 6028-6112

```javascript
if (order_id) {
  // 1. جلب بيانات الطلب (table_code, branch)
  const { rows: orderRows } = await client.query(
    'SELECT branch, table_code FROM orders WHERE id=$1',
    [order_id]
  );
  const orderTableCode = orderRows[0]?.table_code;
  const orderBranch = orderRows[0]?.branch;
  
  // 2. تحديث حالة الطلب إلى CLOSED
  await client.query(
    'UPDATE orders SET status=$1, invoice_id=$2, closed_at=NOW() WHERE id=$3',
    ['CLOSED', invoice.id, order_id]
  );
  
  // 3. حذف order_drafts
  try {
    await client.query('DELETE FROM order_drafts WHERE order_id = $1', [order_id]);
  } catch {}
  
  // 4. تحديث حالة الطاولة إلى AVAILABLE
  if (orderTableCode && orderBranch) {
    try {
      await client.query(
        'UPDATE pos_tables SET status=$1, current_order_id=NULL WHERE branch=$2 AND table_code=$3',
        ['AVAILABLE', orderBranch, orderTableCode]
      );
    } catch {}
  }
}
```

**النتيجة**: ✅ الطلب مغلق، الطاولة متاحة

---

## 📍 المرحلة 9: Backend - COMMIT Transaction

**الموقع**: السطر 6114-6135

```javascript
// 1. ✅ COMMIT - جميع التغييرات تُحفظ نهائياً
await client.query('COMMIT');

// 2. إعداد Response للـ frontend
const finalInvoice = {
  ...invoice,
  id: invoice.id,
  invoiceId: invoice.id,  // alias للتوافق
  invoice_number: invoice.invoice_number || invoice.number,
  journal_entry_id: journalEntryId,
  order_id: order_id || null
};

console.log('[POS] Invoice issued successfully:', {
  invoiceId: finalInvoice.id,
  invoiceNumber: finalInvoice.invoice_number,
  journalEntryId: finalInvoice.journal_entry_id,
  orderId: finalInvoice.order_id
});

// 3. إرجاع Response
res.json(finalInvoice);

} catch (e) {
  // 4. ❌ في حالة الخطأ: ROLLBACK
  await client.query('ROLLBACK');
  console.error('[POS] issueInvoice error:', e);
  res.status(500).json({ error: "server_error", details: e?.message });
} finally {
  // 5. تحرير الاتصال
  client.release();
}
```

**النتيجة**: ✅ Transaction مكتمل، الفاتورة محفوظة نهائياً

---

## ⚠️ المشكلة المحتملة

### إذا فشل `createInvoiceJournalEntry`:

```javascript
// في السطر 6000-6016
if (!journalEntryId) {
  await client.query('ROLLBACK');  // ⚠️ هذا يلغي الفاتورة أيضاً!
  return res.status(500).json({ error: "accounting_entry_failed" });
}
```

**النتيجة**: ❌ الفاتورة لا تُحفظ في قاعدة البيانات لأن Transaction تم إلغاؤه (ROLLBACK)

---

## ✅ الخلاصة

1. ✅ Frontend يبني payload مع `order_id` و `lines`
2. ✅ Backend يبدأ Transaction
3. ✅ Backend ينشئ الفاتورة (INSERT)
4. ⚠️ Backend يحاول إنشاء journal entry
5. ❌ إذا فشل journal entry → ROLLBACK → الفاتورة تُلغى
6. ✅ إذا نجح journal entry → COMMIT → الفاتورة محفوظة

---

## 🔍 للتحقق من المشكلة

افحص server logs للبحث عن:
- `[POS] CRITICAL: Failed to create journal entry`
- `[ACCOUNTING] Error creating journal entry`
- `[ACCOUNTING] Journal entry unbalanced`
