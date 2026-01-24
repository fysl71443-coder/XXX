# تقرير فحص شامل: قاعدة ربط كل عملية بقيد (Comprehensive Journal Entry Rule Audit)

**التاريخ:** 2026-01-22  
**القاعدة:** أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود

---

## 1. ملخص تنفيذي

### ✅ النقاط الإيجابية
- ✅ **شاشة المحاسبة:** تطبق القاعدة بشكل صحيح
- ✅ **endpoints الحذف:** تحذف القيود المرتبطة عند حذف العملية
- ✅ **endpoints الإنشاء:** معظم endpoints تنشئ قيود تلقائياً
- ✅ **فلترة السجلات اليتيمة:** تم تطبيق فلترة في `GET /api/expenses` و `GET /api/supplier-invoices`

### 🔴 المشاكل الحرجة المكتشفة
- 🔴 **POST /api/invoices:** لا ينشئ قيد تلقائياً (يُنشئ فاتورة بحالة `draft` بدون قيد)
- 🔴 **POST /invoices:** لا ينشئ قيد تلقائياً (يُنشئ فاتورة بحالة `draft` بدون قيد)
- 🔴 **POST /api/payroll/run:** لا ينشئ قيد تلقائياً (يُنشئ مسير بحالة `draft` بدون قيد)
- ⚠️ **DELETE /api/invoices/:id:** لا يحذف القيد المرتبط
- ⚠️ **DELETE /api/supplier-invoices/:id:** لا يحذف القيد المرتبط
- ⚠️ **DELETE /api/payroll/run/:id:** يمنع الحذف إذا كان `journal_entry_id` موجود لكن لا يحذف القيد

### ⚠️ المشاكل المحتملة
- ⚠️ **عمود `journal_entry_id`:** لا يوجد `ALTER TABLE` لإضافة العمود في `bootDatabase`
- ⚠️ **payments:** لا يحتوي على `journal_entry_id` (قد لا يحتاج إذا كان مرتبطاً بـ `invoices`)

---

## 2. فحص الجداول التي تحتوي على `journal_entry_id`

### 2.1 الجداول التي تحتوي على `journal_entry_id`

1. **`expenses`**
   - ✅ يحتوي على `journal_entry_id INTEGER`
   - ⚠️ **مشكلة:** لا يوجد `ALTER TABLE` لإضافة العمود في `bootDatabase`

2. **`invoices`**
   - ✅ يحتوي على `journal_entry_id INTEGER`
   - ⚠️ **مشكلة:** لا يوجد `ALTER TABLE` لإضافة العمود في `bootDatabase`

3. **`supplier_invoices`**
   - ✅ يحتوي على `journal_entry_id INTEGER`
   - ⚠️ **مشكلة:** لا يوجد `ALTER TABLE` لإضافة العمود في `bootDatabase`

4. **`payroll_runs`**
   - ✅ يحتوي على `journal_entry_id INTEGER`
   - ✅ **موجود في:** `CREATE TABLE IF NOT EXISTS payroll_runs` (line 795)

5. **`payments`**
   - ⚠️ **لا يحتوي على `journal_entry_id`**
   - ⚠️ **ملاحظة:** قد لا يحتاج إذا كان مرتبطاً بـ `invoices` فقط

---

## 3. فحص endpoints الإنشاء

### 3.1 ✅ POST /api/expenses

**الموقع:** `backend/server.js:5074-5173`

**التحليل:**
- ✅ **ينشئ قيد تلقائياً:** إذا كان `status === 'posted'` و `total > 0` و `accountCode` موجود
- ✅ **يربط القيد:** `UPDATE expenses SET journal_entry_id = $1 WHERE id = $2`
- ✅ **يستخدم Transaction:** `BEGIN`/`COMMIT`/`ROLLBACK`
- ✅ **يفشل إذا فشل إنشاء القيد:** `ROLLBACK` إذا فشل `createJournalEntry`

**الحالة:** ✅ **مطابق للقاعدة**

### 3.2 ✅ POST /api/supplier-invoices

**الموقع:** `backend/server.js:6196-6308`

**التحليل:**
- ✅ **ينشئ قيد تلقائياً:** دائماً عند الإنشاء (status='posted' افتراضياً)
- ✅ **يربط القيد:** `UPDATE supplier_invoices SET journal_entry_id = $1, status = $2 WHERE id = $3`
- ✅ **يستخدم Transaction:** `BEGIN`/`COMMIT`/`ROLLBACK`
- ✅ **يفشل إذا فشل إنشاء القيد:** `ROLLBACK` إذا فشل `createSupplierInvoiceJournalEntry`

**الحالة:** ✅ **مطابق للقاعدة**

### 3.3 ✅ POST /api/pos/issueInvoice

**الموقع:** `backend/server.js:7417-7890`

**التحليل:**
- ✅ **ينشئ قيد تلقائياً:** إذا كان `status === 'posted'` و `total > 0`
- ✅ **يربط القيد:** `UPDATE invoices SET journal_entry_id = $1 WHERE id = $2`
- ✅ **يستخدم Transaction:** `BEGIN`/`COMMIT`/`ROLLBACK`
- ✅ **يفشل إذا فشل إنشاء القيد:** `ROLLBACK` إذا فشل `createInvoiceJournalEntry`

**الحالة:** ✅ **مطابق للقاعدة**

### 3.4 🔴 POST /api/invoices

**الموقع:** `backend/server.js:6403-6419`

**التحليل:**
- ❌ **لا ينشئ قيد تلقائياً:** ينشئ فاتورة بحالة `draft` بدون قيد
- ❌ **لا يربط قيد:** لا يوجد `UPDATE invoices SET journal_entry_id`
- ⚠️ **يستخدم Transaction:** لا (لا يوجد `BEGIN`/`COMMIT`)

**المشكلة:**
```javascript
// Line 6411-6413
const { rows } = await client.query(
  'INSERT INTO invoices(..., status, ...) VALUES (..., $12, ...)',
  [..., String(b.status||'draft'), ...]  // ❌ draft بدون قيد
);
// ❌ لا يوجد createInvoiceJournalEntry
// ❌ لا يوجد UPDATE invoices SET journal_entry_id
```

**الحالة:** 🔴 **غير مطابق للقاعدة**

### 3.5 🔴 POST /invoices

**الموقع:** `backend/server.js:6390-6402`

**التحليل:**
- ❌ **لا ينشئ قيد تلقائياً:** ينشئ فاتورة بحالة `draft` بدون قيد
- ❌ **لا يربط قيد:** لا يوجد `UPDATE invoices SET journal_entry_id`
- ⚠️ **يستخدم Transaction:** لا (لا يوجد `BEGIN`/`COMMIT`)

**الحالة:** 🔴 **غير مطابق للقاعدة**

### 3.6 🔴 POST /api/payroll/run

**الموقع:** `backend/server.js:4164-4213`

**التحليل:**
- ❌ **لا ينشئ قيد تلقائياً:** ينشئ مسير بحالة `draft` بدون قيد
- ❌ **لا يربط قيد:** لا يوجد `UPDATE payroll_runs SET journal_entry_id`
- ✅ **يستخدم Transaction:** `BEGIN`/`COMMIT`/`ROLLBACK`

**المشكلة:**
```javascript
// Line 4173-4174
const { rows: runRows } = await client.query(
  'INSERT INTO payroll_runs(period, status) VALUES ($1, $2) RETURNING *',
  [runPeriod, 'draft']  // ❌ draft بدون قيد
);
// ❌ لا يوجد createPayrollJournalEntry
// ❌ لا يوجد UPDATE payroll_runs SET journal_entry_id
```

**الحالة:** 🔴 **غير مطابق للقاعدة** (لكن هذا مقبول لأن المسير يُنشأ كـ `draft` ثم يُنشر لاحقاً)

---

## 4. فحص endpoints الحذف

### 4.1 ✅ DELETE /api/journal/:id

**الموقع:** `backend/server.js:2364-2440`

**التحليل:**
- ✅ **يحذف العملية المرتبطة:** إذا كان `reference_type === 'expense'` → يحذف `expenses`
- ✅ **يحذف العملية المرتبطة:** إذا كان `reference_type === 'invoice'` → يحذف `invoices`
- ✅ **يحذف العملية المرتبطة:** إذا كان `reference_type === 'payroll'` → يحذف `payroll_runs` و `payroll_run_items`
- ✅ **يحذف العملية المرتبطة:** إذا كان `reference_type === 'supplier_invoice'` → يحذف `supplier_invoices`
- ✅ **يستخدم Transaction:** `BEGIN`/`COMMIT`/`ROLLBACK`

**الحالة:** ✅ **مطابق للقاعدة**

### 4.2 ✅ DELETE /api/expenses/:id

**الموقع:** `backend/server.js:5884-5931`

**التحليل:**
- ✅ **يحذف القيد المرتبط:** إذا كان `status === 'posted'` و `journal_entry_id` موجود
- ✅ **يحذف journal_postings:** `DELETE FROM journal_postings WHERE journal_entry_id = $1`
- ✅ **يحذف journal_entry:** `DELETE FROM journal_entries WHERE id = $1`
- ✅ **يستخدم Transaction:** `BEGIN`/`COMMIT`/`ROLLBACK`

**الحالة:** ✅ **مطابق للقاعدة**

### 4.3 ⚠️ DELETE /api/invoices/:id

**الموقع:** `backend/server.js:6431-6437`

**التحليل:**
- ❌ **لا يحذف القيد المرتبط:** يحذف `invoices` فقط
- ❌ **لا يحذف journal_postings:** لا يوجد `DELETE FROM journal_postings`
- ❌ **لا يحذف journal_entry:** لا يوجد `DELETE FROM journal_entries`
- ⚠️ **يستخدم Transaction:** لا (لا يوجد `BEGIN`/`COMMIT`)

**المشكلة:**
```javascript
// Line 6434
await pool.query('DELETE FROM invoices WHERE id=$1', [id]);
// ❌ لا يوجد DELETE FROM journal_postings
// ❌ لا يوجد DELETE FROM journal_entries
```

**الحالة:** ⚠️ **غير مطابق للقاعدة**

### 4.4 ⚠️ DELETE /api/supplier-invoices/:id

**الموقع:** `backend/server.js:6342-6351`

**التحليل:**
- ❌ **لا يحذف القيد المرتبط:** يحذف `supplier_invoices` فقط
- ❌ **لا يحذف journal_postings:** لا يوجد `DELETE FROM journal_postings`
- ❌ **لا يحذف journal_entry:** لا يوجد `DELETE FROM journal_entries`
- ⚠️ **يستخدم Transaction:** لا (لا يوجد `BEGIN`/`COMMIT`)

**المشكلة:**
```javascript
// Line 6345
await pool.query('DELETE FROM supplier_invoices WHERE id=$1', [id]);
// ❌ لا يوجد DELETE FROM journal_postings
// ❌ لا يوجد DELETE FROM journal_entries
```

**الحالة:** ⚠️ **غير مطابق للقاعدة**

### 4.5 ⚠️ DELETE /api/payroll/run/:id

**الموقع:** `backend/server.js:4517-4526`

**التحليل:**
- ⚠️ **يمنع الحذف:** إذا كان `journal_entry_id` موجود → `return res.status(400).json({ error: 'cannot_delete_posted' })`
- ❌ **لا يحذف القيد المرتبط:** يمنع الحذف فقط
- ⚠️ **يستخدم Transaction:** لا (لا يوجد `BEGIN`/`COMMIT`)

**المشكلة:**
```javascript
// Line 4522
if (check[0].journal_entry_id) return res.status(400).json({ error: 'cannot_delete_posted' });
// ❌ يجب حذف القيد أولاً ثم حذف المسير
```

**الحالة:** ⚠️ **غير مطابق للقاعدة** (يجب حذف القيد أولاً)

---

## 5. فحص السجلات اليتيمة (Orphaned Records)

### 5.1 ✅ فلترة في GET /api/expenses

**الموقع:** `backend/server.js:4837-4872`

**التحليل:**
- ✅ **يفلتر السجلات اليتيمة:** `WHERE NOT ((status = 'posted' OR status = 'reversed') AND journal_entry_id IS NULL)`
- ✅ **يستبعد:** الفواتير المنشورة/المعكوسة بدون `journal_entry_id`

**الحالة:** ✅ **مطابق للقاعدة**

### 5.2 ✅ فلترة في GET /expenses

**الموقع:** `backend/server.js:4800-4835`

**التحليل:**
- ✅ **يفلتر السجلات اليتيمة:** `WHERE NOT ((status = 'posted' OR status = 'reversed') AND journal_entry_id IS NULL)`
- ✅ **يستبعد:** الفواتير المنشورة/المعكوسة بدون `journal_entry_id`

**الحالة:** ✅ **مطابق للقاعدة**

### 5.3 ⚠️ GET /api/invoices

**الموقع:** `backend/server.js:6360-6365`

**التحليل:**
- ❌ **لا يفلتر السجلات اليتيمة:** يعرض جميع الفواتير بغض النظر عن `journal_entry_id`
- ⚠️ **يجب إضافة فلترة:** `WHERE NOT ((status IN ('posted', 'open', 'partial') AND journal_entry_id IS NULL)`

**الحالة:** ⚠️ **غير مطابق للقاعدة**

### 5.4 ⚠️ GET /api/supplier-invoices

**الموقع:** `backend/server.js:5934-6031`

**التحليل:**
- ⚠️ **يفلتر جزئياً:** يستخدم `LEFT JOIN journal_entries` لكن لا يفلتر السجلات اليتيمة
- ⚠️ **يجب إضافة فلترة:** `WHERE NOT ((status = 'posted' OR status = 'reversed') AND journal_entry_id IS NULL)`

**الحالة:** ⚠️ **غير مطابق للقاعدة**

---

## 6. المشاكل الحرجة التي تحتاج إصلاح فوري

### 6.1 🔴 POST /api/invoices لا ينشئ قيد تلقائياً

**الموقع:** `backend/server.js:6403-6419`

**المشكلة:**
- ينشئ فاتورة بحالة `draft` بدون قيد
- لا يوجد `createInvoiceJournalEntry`
- لا يوجد `UPDATE invoices SET journal_entry_id`

**الحل المقترح:**
```javascript
app.post("/api/invoices", authenticateToken, authorize("sales","create", { branchFrom: r => (r.body?.branch || null) }), checkAccountingPeriod(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const invoiceType = b.type || 'sale';
    const status = String(b.status||'draft');
    const linesJson = lines.length > 0 ? JSON.stringify(lines) : null;
    
    // Insert invoice
    const { rows } = await client.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, type) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, number, status, total, branch, type',
      [b.number||null, b.date||null, b.customer_id||null, linesJson, Number(b.subtotal||0), Number(b.discount_pct||0), Number(b.discount_amount||0), Number(b.tax_pct||0), Number(b.tax_amount||0), Number(b.total||0), b.payment_method||null, status, branch, invoiceType]
    );
    
    const invoice = rows && rows[0];
    if (!invoice) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "server_error", details: "Failed to create invoice" });
    }
    
    // ✅ Create journal entry automatically if posted
    let journalEntryId = null;
    if (status === 'posted' && invoice.total > 0) {
      try {
        journalEntryId = await createInvoiceJournalEntry(
          invoice.id,
          b.customer_id,
          Number(b.subtotal||0),
          Number(b.discount_amount||0),
          Number(b.tax_amount||0),
          Number(b.total||0),
          b.payment_method,
          branch,
          client
        );
        
        if (journalEntryId) {
          await client.query(
            'UPDATE invoices SET journal_entry_id = $1 WHERE id = $2',
            [journalEntryId, invoice.id]
          );
        }
      } catch (journalError) {
        await client.query('ROLLBACK');
        return res.status(500).json({ 
          error: "journal_creation_failed", 
          details: journalError?.message || "Failed to create journal entry"
        });
      }
    }
    
    await client.query('COMMIT');
    res.json({ ...invoice, journal_entry_id: journalEntryId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[INVOICES] Error creating invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
```

### 6.2 🔴 POST /invoices لا ينشئ قيد تلقائياً

**الموقع:** `backend/server.js:6390-6402`

**المشكلة:**
- نفس المشكلة في `POST /api/invoices`

**الحل:** نفس الحل أعلاه

### 6.3 ⚠️ DELETE /api/invoices/:id لا يحذف القيد المرتبط

**الموقع:** `backend/server.js:6431-6437`

**المشكلة:**
- يحذف `invoices` فقط بدون حذف القيد المرتبط

**الحل المقترح:**
```javascript
app.delete("/api/invoices/:id", authenticateToken, authorize("sales","delete"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id||0);
    
    // Get invoice to check journal_entry_id
    const { rows: invoiceRows } = await client.query('SELECT id, status, journal_entry_id FROM invoices WHERE id = $1', [id]);
    if (!invoiceRows || !invoiceRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", details: "Invoice not found" });
    }
    
    const invoice = invoiceRows[0];
    const journalEntryId = invoice.journal_entry_id;
    
    // If invoice is posted, delete journal entry first
    if (invoice.status === 'posted' && journalEntryId) {
      // Delete journal postings first
      await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [journalEntryId]);
      // Delete journal entry
      await client.query('DELETE FROM journal_entries WHERE id = $1', [journalEntryId]);
    }
    
    // Delete invoice
    await client.query('DELETE FROM invoices WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ ok: true, id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[INVOICES] Error deleting invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
```

### 6.4 ⚠️ DELETE /api/supplier-invoices/:id لا يحذف القيد المرتبط

**الموقع:** `backend/server.js:6342-6351`

**المشكلة:**
- يحذف `supplier_invoices` فقط بدون حذف القيد المرتبط

**الحل المقترح:**
```javascript
async function handleDeleteSupplierInvoice(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id||0);
    
    // Get supplier invoice to check journal_entry_id
    const { rows: invoiceRows } = await client.query('SELECT id, status, journal_entry_id FROM supplier_invoices WHERE id = $1', [id]);
    if (!invoiceRows || !invoiceRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", details: "Supplier invoice not found" });
    }
    
    const invoice = invoiceRows[0];
    const journalEntryId = invoice.journal_entry_id;
    
    // If invoice is posted, delete journal entry first
    if (invoice.status === 'posted' && journalEntryId) {
      // Delete journal postings first
      await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [journalEntryId]);
      // Delete journal entry
      await client.query('DELETE FROM journal_entries WHERE id = $1', [journalEntryId]);
    }
    
    // Delete supplier invoice
    await client.query('DELETE FROM supplier_invoices WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ ok: true, id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[SUPPLIER INVOICES] Error deleting invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}
```

### 6.5 ⚠️ DELETE /api/payroll/run/:id يمنع الحذف بدلاً من حذف القيد

**الموقع:** `backend/server.js:4517-4526`

**المشكلة:**
- يمنع الحذف إذا كان `journal_entry_id` موجود
- يجب حذف القيد أولاً ثم حذف المسير

**الحل المقترح:**
```javascript
app.delete("/api/payroll/run/:id", authenticateToken, authorize("payroll","delete"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = Number(req.params.id || 0);
    
    const { rows: check } = await client.query('SELECT * FROM payroll_runs WHERE id = $1', [runId]);
    if (!check.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }
    
    const payrollRun = check[0];
    const journalEntryId = payrollRun.journal_entry_id;
    
    // If payroll run has journal entry, delete it first
    if (journalEntryId) {
      // Delete journal postings first
      await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [journalEntryId]);
      // Delete journal entry
      await client.query('DELETE FROM journal_entries WHERE id = $1', [journalEntryId]);
    }
    
    // Delete payroll run items
    await client.query('DELETE FROM payroll_run_items WHERE run_id = $1', [runId]);
    // Delete payroll run
    await client.query('DELETE FROM payroll_runs WHERE id = $1', [runId]);
    
    await client.query('COMMIT');
    res.json({ ok: true, id: runId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[PAYROLL] Error deleting run:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
});
```

### 6.6 ⚠️ إضافة عمود `journal_entry_id` في `bootDatabase`

**الموقع:** `backend/server.js:603-665`

**المشكلة:**
- لا يوجد `ALTER TABLE` لإضافة `journal_entry_id` إلى `invoices`, `expenses`, `supplier_invoices`

**الحل المقترح:**
```javascript
// Add journal_entry_id columns if they don't exist
await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL');
await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL');
await pool.query('ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL');
```

### 6.7 ⚠️ فلترة السجلات اليتيمة في GET /api/invoices

**الموقع:** `backend/server.js:6360-6365`

**المشكلة:**
- لا يفلتر السجلات اليتيمة

**الحل المقترح:**
```javascript
app.get("/api/invoices", authenticateToken, authorize("sales","view", { branchFrom: r => (r.query.branch || null) }), async (req, res) => {
  try {
    // CRITICAL: Filter out orphaned invoices (posted/open/partial without journal_entry_id)
    const { rows } = await pool.query(`
      SELECT id, number, date, customer_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, journal_entry_id, created_at 
      FROM invoices 
      WHERE NOT (
        (status IN ('posted', 'open', 'partial') AND journal_entry_id IS NULL)
      )
      ORDER BY id DESC
    `);
    res.json({ items: rows || [] });
  } catch (e) { 
    console.error('[INVOICES] Error listing:', e);
    res.json({ items: [] }); 
  }
});
```

### 6.8 ⚠️ فلترة السجلات اليتيمة في GET /api/supplier-invoices

**الموقع:** `backend/server.js:5934-6031`

**المشكلة:**
- لا يفلتر السجلات اليتيمة بشكل صريح

**الحل المقترح:**
- إضافة `WHERE NOT ((status = 'posted' OR status = 'reversed') AND journal_entry_id IS NULL)` إلى الاستعلام

---

## 7. التوصيات

### 7.1 🔴 إصلاحات حرجة (يجب تنفيذها فوراً)

1. **إصلاح POST /api/invoices:**
   - إضافة `createInvoiceJournalEntry` عند `status === 'posted'`
   - إضافة `UPDATE invoices SET journal_entry_id`

2. **إصلاح POST /invoices:**
   - نفس الإصلاح أعلاه

3. **إصلاح DELETE /api/invoices/:id:**
   - إضافة حذف `journal_postings` و `journal_entries` المرتبطة

4. **إصلاح DELETE /api/supplier-invoices/:id:**
   - إضافة حذف `journal_postings` و `journal_entries` المرتبطة

5. **إصلاح DELETE /api/payroll/run/:id:**
   - حذف القيد المرتبط أولاً ثم حذف المسير

6. **إضافة عمود `journal_entry_id` في `bootDatabase`:**
   - إضافة `ALTER TABLE` لإضافة العمود إلى `invoices`, `expenses`, `supplier_invoices`

7. **فلترة السجلات اليتيمة:**
   - إضافة فلترة في `GET /api/invoices`
   - تحسين فلترة في `GET /api/supplier-invoices`

### 7.2 ⚠️ تحسينات مقترحة

1. **إضافة constraint في قاعدة البيانات:**
   - `CHECK (status IN ('posted', 'reversed') AND journal_entry_id IS NOT NULL)`
   - لكن هذا قد يمنع إنشاء فواتير `draft` بدون قيد (وهذا مقبول)

2. **إضافة endpoint للتنظيف:**
   - `POST /api/debug/cleanup-orphaned` (موجود بالفعل)
   - لكن يجب إضافة تنظيف لـ `invoices` و `supplier_invoices` و `payroll_runs`

3. **إضافة validation في Frontend:**
   - منع إنشاء فواتير `posted` بدون قيد
   - عرض تحذير إذا كانت الفاتورة `posted` بدون `journal_entry_id`

---

## 8. الخلاصة

### ✅ النقاط الإيجابية
- معظم endpoints الإنشاء تنشئ قيود تلقائياً
- `DELETE /api/journal/:id` يحذف العملية المرتبطة بشكل صحيح
- `DELETE /api/expenses/:id` يحذف القيد المرتبط بشكل صحيح
- تم تطبيق فلترة السجلات اليتيمة في `GET /api/expenses`

### 🔴 المشاكل الحرجة
- `POST /api/invoices` و `POST /invoices` لا ينشئان قيود تلقائياً
- `DELETE /api/invoices/:id` و `DELETE /api/supplier-invoices/:id` لا يحذفان القيود المرتبطة
- `DELETE /api/payroll/run/:id` يمنع الحذف بدلاً من حذف القيد
- لا يوجد `ALTER TABLE` لإضافة `journal_entry_id` في `bootDatabase`
- `GET /api/invoices` لا يفلتر السجلات اليتيمة

### ⚠️ المشاكل المحتملة
- `payments` لا يحتوي على `journal_entry_id` (قد لا يحتاج)
- `POST /api/payroll/run` لا ينشئ قيد (مقبول لأن المسير يُنشأ كـ `draft`)

---

**تم إنشاء التقرير:** 2026-01-22  
**آخر تحديث:** 2026-01-22
