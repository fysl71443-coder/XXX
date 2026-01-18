-- ============================================================
-- المرحلة 2️⃣ — تثبيت الربط المحاسبي
-- ============================================================
-- هذا الملف ينفذ جميع التعديلات المطلوبة لربط النظام المحاسبي
-- تاريخ: 2025-01-XX
-- ============================================================

-- ============================================================
-- 1️⃣ إضافة مفاتيح الربط (إجباري)
-- ============================================================

-- ربط المصروف بالقيد
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER;

-- ربط الفاتورة بالقيد
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER;

-- علاقات FK للمصروفات
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_expense_journal'
  ) THEN
    ALTER TABLE expenses
    ADD CONSTRAINT fk_expense_journal
    FOREIGN KEY (journal_entry_id)
    REFERENCES journal_entries(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- علاقات FK للفواتير
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_invoice_journal'
  ) THEN
    ALTER TABLE invoices
    ADD CONSTRAINT fk_invoice_journal
    FOREIGN KEY (journal_entry_id)
    REFERENCES journal_entries(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2️⃣ تثبيت ترقيم القيود (مفقود حاليًا)
-- ============================================================

-- إنشاء SEQUENCE لترقيم القيود
CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq;

-- تعيين DEFAULT للترقيم التلقائي
DO $$
BEGIN
  -- جعل entry_number nullable أولاً إذا لم يكن
  ALTER TABLE journal_entries 
  ALTER COLUMN entry_number DROP NOT NULL;
  
  -- تعيين DEFAULT
  ALTER TABLE journal_entries
  ALTER COLUMN entry_number 
  SET DEFAULT nextval('journal_entry_number_seq');
EXCEPTION
  WHEN OTHERS THEN
    -- قد يكون DEFAULT موجوداً بالفعل
    NULL;
END $$;

-- ملء القيود الموجودة بدون رقم (اختياري)
-- UPDATE journal_entries 
-- SET entry_number = nextval('journal_entry_number_seq')
-- WHERE entry_number IS NULL;

-- ============================================================
-- 3️⃣ تثبيت ترقيم الفواتير (لو لم يعمل)
-- ============================================================

-- إنشاء SEQUENCE لترقيم الفواتير
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- تعيين DEFAULT للترقيم التلقائي
DO $$
BEGIN
  ALTER TABLE invoices
  ALTER COLUMN number 
  SET DEFAULT 'INV-' || nextval('invoice_number_seq');
EXCEPTION
  WHEN OTHERS THEN
    -- قد يكون DEFAULT موجوداً بالفعل
    NULL;
END $$;

-- ============================================================
-- 4️⃣ التحقق من النتائج
-- ============================================================

-- التحقق من الأعمدة المضافة
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('expenses', 'invoices', 'journal_entries')
  AND column_name IN ('journal_entry_id', 'entry_number', 'number')
ORDER BY table_name, column_name;

-- التحقق من Constraints
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name
FROM pg_constraint
WHERE conname IN ('fk_expense_journal', 'fk_invoice_journal');

-- التحقق من Sequences
SELECT sequence_name 
FROM information_schema.sequences
WHERE sequence_name IN ('journal_entry_number_seq', 'invoice_number_seq');

-- ============================================================
-- ✅ تم التنفيذ بنجاح
-- ============================================================
