-- إضافة عمود branch إلى journal_entries إذا لم يكن موجوداً
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='journal_entries' AND column_name='branch') THEN
    ALTER TABLE journal_entries ADD COLUMN branch TEXT;
  END IF;
END $$;

-- تحديث القيود الموجودة من expenses
UPDATE journal_entries
SET 
    description = CONCAT('مصروف #', e.id, CASE WHEN e.type IS NOT NULL THEN CONCAT(' - ', e.type) ELSE '' END, CASE WHEN e.description IS NOT NULL THEN CONCAT(' - ', e.description) ELSE '' END),
    date = e.date,
    reference_type = 'expense',
    reference_id = e.id,
    branch = e.branch,
    updated_at = NOW()
FROM expenses e
WHERE journal_entries.id = e.journal_entry_id
  AND journal_entries.reference_type = 'expense';

-- تحديث القيود الموجودة من invoices
UPDATE journal_entries
SET 
    description = CONCAT('فاتورة #', i.number),
    date = i.date,
    reference_type = 'invoice',
    reference_id = i.id,
    branch = i.branch,
    updated_at = NOW()
FROM invoices i
WHERE journal_entries.id = i.journal_entry_id
  AND journal_entries.reference_type = 'invoice';

-- التحقق من النتائج
SELECT 
    je.id,
    je.entry_number,
    je.description,
    je.date,
    je.reference_type,
    je.reference_id,
    je.branch,
    je.status
FROM journal_entries je
WHERE je.status = 'posted'
ORDER BY je.id DESC
LIMIT 10;
