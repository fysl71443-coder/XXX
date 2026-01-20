-- إضافة Constraints للمحاسبة
-- Lead QA Engineer + Accounting System Analyst
-- تاريخ: 2026-01-20

-- 1. UNIQUE constraint على invoice number
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_unique 
  ON invoices(number) 
  WHERE number IS NOT NULL;

-- 2. CHECK constraints لمنع المبالغ السالبة
ALTER TABLE journal_postings 
  DROP CONSTRAINT IF EXISTS check_non_negative_debit;
ALTER TABLE journal_postings 
  ADD CONSTRAINT check_non_negative_debit CHECK (debit >= 0);

ALTER TABLE journal_postings 
  DROP CONSTRAINT IF EXISTS check_non_negative_credit;
ALTER TABLE journal_postings 
  ADD CONSTRAINT check_non_negative_credit CHECK (credit >= 0);

-- 3. Foreign Key constraints (إذا لم تكن موجودة)
DO $$
BEGIN
  -- invoices.journal_entry_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_invoices_journal_entry'
  ) THEN
    ALTER TABLE invoices 
      ADD CONSTRAINT fk_invoices_journal_entry 
      FOREIGN KEY (journal_entry_id) 
      REFERENCES journal_entries(id) 
      ON DELETE SET NULL;
  END IF;

  -- expenses.journal_entry_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_expenses_journal_entry'
  ) THEN
    ALTER TABLE expenses 
      ADD CONSTRAINT fk_expenses_journal_entry 
      FOREIGN KEY (journal_entry_id) 
      REFERENCES journal_entries(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4. التحقق من القيود غير المتوازنة
SELECT 
  je.id,
  je.entry_number,
  je.description,
  je.date,
  je.status,
  SUM(jp.debit) as total_debit,
  SUM(jp.credit) as total_credit,
  ABS(SUM(jp.debit) - SUM(jp.credit)) as imbalance
FROM journal_entries je
JOIN journal_postings jp ON jp.journal_entry_id = je.id
WHERE je.status = 'posted'
GROUP BY je.id, je.entry_number, je.description, je.date, je.status
HAVING ABS(SUM(jp.debit) - SUM(jp.credit)) > 0.01
ORDER BY je.date DESC
LIMIT 20;
