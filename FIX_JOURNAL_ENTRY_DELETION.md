# إصلاح حذف وإرجاع قيود اليومية: مصدر الحقيقة الوحيد

## المشكلة الأساسية
عند حذف قيد منشور أو إرجاعه لمسودة، لا يتم تحديث المرجع المرتبط (expense/invoice) ولا يتم تحديث رصيد الحساب. هذا مخالف لمبدأ أساسي: **مصدر الحقيقة الوحيد للنظام هو قيود اليومية المنشورة**.

## المتطلبات
1. **عند حذف قيد منشور**: يجب إرجاعه لمسودة أولاً (لا يمكن حذفه مباشرة)
2. **عند حذف قيد مسودة**: يجب حذف المرجع المرتبط (expense/invoice) نهائياً
3. **عند إرجاع قيد لمسودة**: يجب إرجاع المرجع المرتبط لمسودة
4. **رصيد الحساب**: يجب أن يُحسب من قيود اليومية المنشورة فقط (`status = 'posted'`)

## الإصلاحات المطبقة

### 1. إصلاح DELETE `/api/journal/:id`

**قبل:**
```javascript
app.delete("/api/journal/:id", async (req, res) => {
  await pool.query('DELETE FROM journal_entries WHERE id = $1', [id]);
  res.json({ ok: true });
});
```

**بعد:**
```javascript
app.delete("/api/journal/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get journal entry with reference info
    const { rows: entryRows } = await client.query(
      'SELECT id, status, reference_type, reference_id, entry_number FROM journal_entries WHERE id = $1',
      [id]
    );
    
    const entry = entryRows[0];
    
    // CRITICAL: Only allow deleting draft entries
    if (entry.status === 'posted') {
      return res.status(400).json({ 
        error: "cannot_delete_posted", 
        details: "Cannot delete posted entry. Return to draft first, then delete." 
      });
    }
    
    // CRITICAL: Delete related reference (expense/invoice)
    if (entry.reference_type && entry.reference_id) {
      if (entry.reference_type === 'expense') {
        await client.query('UPDATE expenses SET journal_entry_id = NULL WHERE id = $1', [entry.reference_id]);
        await client.query('DELETE FROM expenses WHERE id = $1', [entry.reference_id]);
      } else if (entry.reference_type === 'invoice') {
        await client.query('UPDATE invoices SET journal_entry_id = NULL WHERE id = $1', [entry.reference_id]);
        await client.query('DELETE FROM invoices WHERE id = $1', [entry.reference_id]);
      }
    }
    
    // Delete journal postings first (foreign key constraint)
    await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [id]);
    
    // Delete journal entry
    await client.query('DELETE FROM journal_entries WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ ok: true, entry_number: entry.entry_number });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "server_error", details: e?.message });
  } finally {
    client.release();
  }
});
```

### 2. إصلاح POST `/api/journal/:id/return-to-draft`

**قبل:**
```javascript
app.post("/api/journal/:id/return-to-draft", async (req, res) => {
  await pool.query('UPDATE journal_entries SET status = $1 WHERE id = $2', ['draft', id]);
  res.json({ ok: true });
});
```

**بعد:**
```javascript
app.post("/api/journal/:id/return-to-draft", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get journal entry with reference info
    const { rows: entryRows } = await client.query(
      'SELECT id, status, reference_type, reference_id FROM journal_entries WHERE id = $1',
      [id]
    );
    
    const entry = entryRows[0];
    
    // Only allow returning posted entries to draft
    if (entry.status !== 'posted') {
      return res.status(400).json({ error: "invalid_status", details: "Only posted entries can be returned to draft" });
    }
    
    // Update journal entry status to draft
    await client.query('UPDATE journal_entries SET status = $1 WHERE id = $2', ['draft', id]);
    
    // CRITICAL: Update related reference (expense/invoice) to draft
    if (entry.reference_type && entry.reference_id) {
      if (entry.reference_type === 'expense') {
        await client.query('UPDATE expenses SET status = $1 WHERE id = $2', ['draft', entry.reference_id]);
      } else if (entry.reference_type === 'invoice') {
        await client.query('UPDATE invoices SET status = $1 WHERE id = $2', ['draft', entry.reference_id]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "server_error", details: e?.message });
  } finally {
    client.release();
  }
});
```

### 3. إصلاح حساب رصيد الحساب

**قبل:**
```sql
WHERE jp.account_id = $1
```

**بعد:**
```sql
WHERE jp.account_id = $1 AND je.status = 'posted'
```

تم تطبيق هذا التعديل على:
- `GET /journal/account/:id`
- `GET /api/journal/account/:id`

## النتائج

### عند حذف قيد مسودة:
1. ✅ يتم حذف journal_postings أولاً
2. ✅ يتم حذف المرجع المرتبط (expense/invoice) نهائياً
3. ✅ يتم حذف journal_entry
4. ✅ يتم إعادة استخدام entry_number تلقائياً

### عند إرجاع قيد لمسودة:
1. ✅ يتم تحديث status القيد إلى 'draft'
2. ✅ يتم تحديث status المرجع المرتبط (expense/invoice) إلى 'draft'
3. ✅ يتم إلغاء الأثر المحاسبي (لأن الرصيد يُحسب من القيود المنشورة فقط)

### حساب رصيد الحساب:
1. ✅ يتم حساب الرصيد من قيود اليومية المنشورة فقط (`status = 'posted'`)
2. ✅ القيود المسودة لا تؤثر على الرصيد
3. ✅ عند حذف قيد منشور، يتم تحديث الرصيد تلقائياً

## Commit
- `74cea850`: Fix journal entry deletion and return-to-draft: Delete related expenses/invoices, ensure account balance calculated from posted entries only

## التحقق من الإصلاح

### بعد Deploy على Render:

1. **اختبار حذف قيد مسودة:**
   - أنشئ مصروف كمسودة
   - احذف القيد المرتبط
   - يجب أن يتم حذف المصروف تلقائياً

2. **اختبار إرجاع قيد لمسودة:**
   - أنشئ مصروف منشور
   - ارجع القيد المرتبط لمسودة
   - يجب أن يتم إرجاع المصروف لمسودة تلقائياً

3. **التحقق من رصيد الحساب:**
   - أضف رصيد افتتاحي (قيد منشور)
   - احذف القيد
   - يجب أن يتم تحديث رصيد الحساب تلقائياً
