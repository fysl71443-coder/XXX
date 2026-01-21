-- =====================================================
-- Fiscal Years Management System
-- نظام إدارة السنوات المالية
-- =====================================================

-- 1. جدول السنوات المالية
CREATE TABLE IF NOT EXISTS fiscal_years (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'rollover')),
  temporary_open BOOLEAN DEFAULT FALSE,
  temporary_open_by INT REFERENCES users(id),
  temporary_open_at TIMESTAMP,
  temporary_open_reason TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  closed_by INT REFERENCES users(id),
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. جدول سجل أنشطة السنة المالية
CREATE TABLE IF NOT EXISTS fiscal_year_activities (
  id SERIAL PRIMARY KEY,
  fiscal_year_id INT REFERENCES fiscal_years(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'open', 'close', 'temporary_open', 'temporary_close', 'create_entry', 'import'
  description TEXT,
  details JSONB,
  user_id INT REFERENCES users(id),
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. إضافة أعمدة للجداول الحالية
ALTER TABLE journal_entries 
  ADD COLUMN IF NOT EXISTS fiscal_year_id INT REFERENCES fiscal_years(id);

ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS fiscal_year_id INT REFERENCES fiscal_years(id);

ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS fiscal_year_id INT REFERENCES fiscal_years(id);

-- 4. Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_fiscal_years_year ON fiscal_years(year);
CREATE INDEX IF NOT EXISTS idx_fiscal_years_status ON fiscal_years(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_year_activities_fiscal_year ON fiscal_year_activities(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_year_activities_action ON fiscal_year_activities(action);
CREATE INDEX IF NOT EXISTS idx_fiscal_year_activities_user ON fiscal_year_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal_year ON journal_entries(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_invoices_fiscal_year ON invoices(fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_expenses_fiscal_year ON expenses(fiscal_year_id);

-- 5. إدراج السنة الحالية إذا لم تكن موجودة
INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
VALUES (
  EXTRACT(YEAR FROM CURRENT_DATE)::INT,
  'open',
  DATE_TRUNC('year', CURRENT_DATE)::DATE,
  (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::DATE,
  'السنة المالية الحالية'
)
ON CONFLICT (year) DO NOTHING;

-- 6. إدراج السنة السابقة (للاختبار)
INSERT INTO fiscal_years (year, status, start_date, end_date, notes)
VALUES (
  EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1,
  'closed',
  (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year')::DATE,
  (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 day')::DATE,
  'السنة المالية السابقة'
)
ON CONFLICT (year) DO NOTHING;

-- 7. دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_fiscal_year_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger لتحديث updated_at
DROP TRIGGER IF EXISTS fiscal_year_updated_at ON fiscal_years;
CREATE TRIGGER fiscal_year_updated_at
  BEFORE UPDATE ON fiscal_years
  FOR EACH ROW
  EXECUTE FUNCTION update_fiscal_year_timestamp();

-- 9. دالة للتحقق من إمكانية الإدخال في السنة المالية
CREATE OR REPLACE FUNCTION can_create_entry_for_date(entry_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  fiscal_record RECORD;
BEGIN
  SELECT * INTO fiscal_record
  FROM fiscal_years
  WHERE entry_date BETWEEN start_date AND end_date;
  
  IF NOT FOUND THEN
    RETURN FALSE; -- لا توجد سنة مالية لهذا التاريخ
  END IF;
  
  IF fiscal_record.status = 'open' THEN
    RETURN TRUE;
  END IF;
  
  IF fiscal_record.status = 'closed' AND fiscal_record.temporary_open = TRUE THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 10. عرض ملخص
SELECT 
  year,
  status,
  temporary_open,
  start_date,
  end_date,
  notes
FROM fiscal_years
ORDER BY year DESC;
