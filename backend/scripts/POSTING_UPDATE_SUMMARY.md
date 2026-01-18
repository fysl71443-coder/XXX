# ملخص تحديث دوال الترحيل

**التاريخ:** 2025-01-17

---

## ✅ الإصلاحات المنفذة

### 1. تحديث دالة `post_expense`

**الملفات المعدلة:**
- `backend/server.js` - دالتان:
  - `POST /expenses/:id/post`
  - `POST /api/expenses/:id/post`

**التغييرات:**
- ✅ إضافة `branch` إلى `INSERT INTO journal_entries`
- ✅ تحسين `description` ليشمل `type` إذا كان موجوداً
- ✅ نسخ جميع الحقول الضرورية من `expenses` إلى `journal_entries`

**الكود الجديد:**
```javascript
const description = expense.type ? `مصروف #${expense.id} - ${expense.type}` : `مصروف #${expense.id}${expense.description ? ' - ' + expense.description : ''}`;
const { rows: entryRows } = await client.query(
  `INSERT INTO journal_entries(description, date, reference_type, reference_id, status, branch)
   VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, entry_number`,
  [description, expense.date, 'expense', expense.id, 'posted', expense.branch || null]
);
```

---

### 2. إضافة عمود `branch` إلى `journal_entries`

**السكريبت:**
- `backend/scripts/add-branch-column.js` - يضيف عمود `branch` إذا لم يكن موجوداً

**SQL:**
```sql
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='journal_entries' AND column_name='branch') THEN
    ALTER TABLE journal_entries ADD COLUMN branch TEXT;
  END IF;
END $$;
```

---

### 3. تحديث القيود الموجودة

**السكريبت:**
- `backend/scripts/update-existing-entries.js` - يحدث القيود الموجودة بنسخ الحقول من `expenses` و `invoices`

**SQL:**
```sql
-- تحديث القيود من expenses
UPDATE journal_entries
SET 
    description = CONCAT('مصروف #', e.id, 
      CASE WHEN e.type IS NOT NULL THEN CONCAT(' - ', e.type) ELSE '' END,
      CASE WHEN e.description IS NOT NULL THEN CONCAT(' - ', e.description) ELSE '' END),
    date = e.date,
    reference_type = 'expense',
    reference_id = e.id,
    branch = e.branch
FROM expenses e
WHERE journal_entries.id = e.journal_entry_id
  AND journal_entries.reference_type = 'expense';

-- تحديث القيود من invoices
UPDATE journal_entries
SET 
    description = CONCAT('فاتورة #', i.number),
    date = i.date,
    reference_type = 'invoice',
    reference_id = i.id,
    branch = i.branch
FROM invoices i
WHERE journal_entries.id = i.journal_entry_id
  AND journal_entries.reference_type = 'invoice';
```

---

## ⏳ المهام المتبقية

### 1. تحديث دالة `post_invoice`
- البحث عن دالة ترحيل الفواتير
- إضافة `branch` و `description` محسّن

### 2. تحديث Frontend
- قراءة `reference_type` من `journal_entries`
- قراءة `reference_id` لجلب رقم الفاتورة أو المصروف
- قراءة `branch` لعرض فرع النشاط
- قراءة `payment_method` من الفاتورة أو المصروف المرتبط

### 3. تحديث API Journal Entries
- إضافة `branch` إلى SELECT queries في `GET /api/journal` و `GET /journal`

---

## 📝 ملاحظات

1. **عمود `branch`**: يجب إضافته إلى `journal_entries` قبل تشغيل السكريبتات
2. **القيود الموجودة**: يجب تحديثها باستخدام `update-existing-entries.js`
3. **Frontend**: يحتاج تحديث لقراءة الحقول الجديدة

---

**الحالة:** ✅ جزئياً مكتمل (post_expense تم، post_invoice قيد العمل)
