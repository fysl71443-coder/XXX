# ✅ تحقق نهائي - endpoint /api/invoice_items/:id

## ✅ Endpoint الحالي صحيح ويعمل

### الموقع: `backend/server.js:4626`

```javascript
app.get("/api/invoice_items/:id", authenticateToken, authorize("sales","view"), async (req, res) => {
  const id = Number(req.params.id||0);
  
  // CRITICAL: Query uses invoice.id directly (NOT order_id)
  const { rows } = await pool.query(
    `SELECT id, number, invoice_number, lines
     FROM invoices
     WHERE id = $1`,
    [id]
  );
  
  if (!rows || rows.length === 0) {
    return res.status(404).json({ error: "not_found", details: `Invoice ${id} not found` });
  }
  
  const invoice = rows[0];
  
  // Parse lines (JSONB → array)
  let lines = invoice.lines;
  if (typeof lines === 'string') {
    lines = JSON.parse(lines);
  }
  
  // Filter to only return items with type='item'
  lines = Array.isArray(lines) ? lines.filter(item => item && item.type === 'item') : [];
  
  // Transform to old format
  const items = lines.map(item => ({
    id: item.id || item.product_id || null,
    product_id: item.product_id || item.id || null,
    name: item.name || item.product_name || '',
    quantity: item.quantity || item.qty || 0,
    qty: item.qty || item.quantity || 0,
    unit_price: item.unit_price || item.price || 0,
    price: item.price || item.unit_price || 0,
    discount: item.discount || 0,
    ...item
  }));
  
  // Return in old format
  res.json({
    id: invoice.id,
    number: invoice.number,
    invoice_number: invoice.invoice_number || invoice.number,
    items: items,
    lines: items
  });
});
```

## ✅ التأكيدات

1. ✅ **يستخدم `invoice.id` مباشرة** - NOT `order_id`
2. ✅ **يستعلم من جدول `invoices`** - NOT `invoice_items`
3. ✅ **يجلب من `invoices.lines`** - JSONB field
4. ✅ **يفلتر العناصر**: `filter(item => item.type === 'item')`
5. ✅ **يحول للشكل القديم**: `quantity`, `unit_price`, etc.

## 🔍 إذا حدث 404

إذا استمر 404، الأسباب المحتملة:

1. **الفاتورة غير موجودة**: Invoice ID المُرسل غير موجود في قاعدة البيانات
   - الحل: تحقق من أن `inv.id` في frontend صحيح (من استجابة `issueInvoice`)

2. **Race condition**: Frontend يحاول جلب items قبل أن تُحفظ الفاتورة
   - الحل: تأكد من أن `apiInvoices.items(inv.id)` يُستدعى بعد `issueInvoice` بنجاح

3. **ID خاطئ**: Frontend يرسل ID خاطئ (من مسودة قديمة)
   - الحل: تأكد من استخدام `res.id` من استجابة `issueInvoice` مباشرة

## 🧪 للتحقق

```sql
-- تحقق من وجود الفاتورة
SELECT id, number, invoice_number, lines 
FROM invoices 
WHERE id = 11;  -- استبدل 11 بـ ID الفاتورة الفعلية
```

---

## ✅ الخلاصة

**Endpoint صحيح ولا يحتاج تعديل** ✅

الكود يستخدم `invoice.id` مباشرة من جدول `invoices` ويجلب من `invoices.lines`.

إذا حدث 404، المشكلة على الأرجح في:
- Frontend يرسل ID خاطئ
- الفاتورة لم تُحفظ بعد في قاعدة البيانات
- Race condition في timing
