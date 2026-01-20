-- ============================================
-- إصلاح قاعدة البيانات بالكامل لنظام POS
-- PostgreSQL ONLY - NO SQLite
-- Database: postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv
-- ============================================

BEGIN;

-- ============================================
-- 1️⃣ إنشاء الجداول الناقصة
-- ============================================

-- جدول branch_accounts (حسابات الفروع)
CREATE TABLE IF NOT EXISTS branch_accounts (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER,
  branch_name TEXT NOT NULL,
  account_type TEXT NOT NULL,  -- 'sales_cash', 'sales_credit', 'payment_cash', 'payment_bank', 'vat'
  account_number TEXT NOT NULL,  -- رقم الحساب مثل '4111', '4112', '1111', '1121', '2141'
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_name, account_type)
);

-- جدول pos_tables (طاولات POS)
CREATE TABLE IF NOT EXISTS pos_tables (
  id SERIAL PRIMARY KEY,
  branch TEXT NOT NULL,
  table_code TEXT NOT NULL,  -- رقم الطاولة مثل '1', '2', '3'
  table_name TEXT,  -- اسم الطاولة (اختياري)
  status TEXT DEFAULT 'AVAILABLE',  -- 'AVAILABLE', 'BUSY', 'RESERVED', 'CLEANING'
  current_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  capacity INTEGER DEFAULT 4,  -- عدد المقاعد
  location TEXT,  -- موقع الطاولة (داخلي/خارجي)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch, table_code)
);

-- جدول order_drafts (مسودات الطلبات)
CREATE TABLE IF NOT EXISTS order_drafts (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  table_code TEXT NOT NULL,
  lines JSONB,  -- نفس البيانات في orders.lines
  status TEXT DEFAULT 'draft',  -- 'draft', 'closed', 'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_drafts_order_id ON order_drafts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_drafts_branch_table ON order_drafts(branch, table_code);

-- ============================================
-- 2️⃣ إضافة الأعمدة الناقصة للجداول الموجودة
-- ============================================

-- جدول invoices - إضافة journal_entry_id إذا لم يكن موجودًا
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='invoices' AND column_name='journal_entry_id') THEN
    ALTER TABLE invoices ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- جدول invoices - إضافة closed_at إذا لم يكن موجودًا
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='invoices' AND column_name='closed_at') THEN
    ALTER TABLE invoices ADD COLUMN closed_at TIMESTAMPTZ;
  END IF;
END $$;

-- جدول orders - إضافة closed_at إذا لم يكن موجودًا
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='orders' AND column_name='closed_at') THEN
    ALTER TABLE orders ADD COLUMN closed_at TIMESTAMPTZ;
  END IF;
END $$;

-- جدول journal_entries - إضافة branch إذا لم يكن موجودًا (تم بالفعل في الكود لكن للتأكد)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='journal_entries' AND column_name='branch') THEN
    ALTER TABLE journal_entries ADD COLUMN branch TEXT;
  END IF;
END $$;

-- جدول accounts - إضافة account_code إذا لم يكن موجودًا (بعض الأنظمة تستخدم account_number فقط)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='accounts' AND column_name='account_code') THEN
    ALTER TABLE accounts ADD COLUMN account_code TEXT;
    -- نسخ account_number إلى account_code للتوافق
    UPDATE accounts SET account_code = account_number WHERE account_code IS NULL;
  END IF;
END $$;

-- ============================================
-- 3️⃣ إنشاء الحسابات الأساسية (شجرة الحسابات)
-- ============================================

-- الحسابات الأساسية المطلوبة للنظام
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, opening_balance, allow_manual_entry)
VALUES 
  -- الأصول (Assets)
  ('1111', '1111', 'نقد', 'Cash', 'asset', 'debit', 0, true),
  ('1121', '1121', 'بنك', 'Bank', 'asset', 'debit', 0, true),
  
  -- الخصوم (Liabilities)
  ('2141', '2141', 'ضريبة القيمة المضافة', 'VAT Payable', 'liability', 'credit', 0, true),
  
  -- الإيرادات (Revenue)
  ('4111', '4111', 'مبيعات نقدية', 'Cash Sales', 'revenue', 'credit', 0, true),
  ('4112', '4112', 'مبيعات آجلة', 'Credit Sales', 'revenue', 'credit', 0, true),
  ('4121', '4121', 'مبيعات نقدية - Place India', 'Cash Sales - Place India', 'revenue', 'credit', 0, true),
  ('4122', '4122', 'مبيعات آجلة - Place India', 'Credit Sales - Place India', 'revenue', 'credit', 0, true),
  
  -- المصروفات (Expenses)
  ('5111', '5111', 'مصروفات عامة', 'General Expenses', 'expense', 'debit', 0, true),
  ('5112', '5112', 'مصروفات تشغيلية', 'Operating Expenses', 'expense', 'debit', 0, true)
ON CONFLICT (account_number) DO NOTHING;

-- ============================================
-- 4️⃣ إضافة البيانات الأساسية لـ branch_accounts
-- ============================================

-- الحصول على account_id من الحسابات
DO $$
DECLARE
  v_cash_sales_id INTEGER;
  v_credit_sales_id INTEGER;
  v_place_india_cash_id INTEGER;
  v_place_india_credit_id INTEGER;
  v_cash_account_id INTEGER;
  v_bank_account_id INTEGER;
  v_vat_account_id INTEGER;
BEGIN
  -- الحصول على معرفات الحسابات
  SELECT id INTO v_cash_sales_id FROM accounts WHERE account_number = '4111' LIMIT 1;
  SELECT id INTO v_credit_sales_id FROM accounts WHERE account_number = '4112' LIMIT 1;
  SELECT id INTO v_place_india_cash_id FROM accounts WHERE account_number = '4121' LIMIT 1;
  SELECT id INTO v_place_india_credit_id FROM accounts WHERE account_number = '4122' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_number = '1111' LIMIT 1;
  SELECT id INTO v_bank_account_id FROM accounts WHERE account_number = '1121' LIMIT 1;
  SELECT id INTO v_vat_account_id FROM accounts WHERE account_number = '2141' LIMIT 1;
  
  -- China Town - Sales Accounts
  INSERT INTO branch_accounts (branch_name, account_type, account_number, account_id, is_active)
  VALUES 
    ('china_town', 'sales_cash', '4111', v_cash_sales_id, true),
    ('china_town', 'sales_credit', '4112', v_credit_sales_id, true),
    ('china_town', 'payment_cash', '1111', v_cash_account_id, true),
    ('china_town', 'payment_bank', '1121', v_bank_account_id, true),
    ('china_town', 'vat', '2141', v_vat_account_id, true)
  ON CONFLICT (branch_name, account_type) 
  DO UPDATE SET account_number = EXCLUDED.account_number, account_id = EXCLUDED.account_id, updated_at = NOW();
  
  -- Place India - Sales Accounts
  INSERT INTO branch_accounts (branch_name, account_type, account_number, account_id, is_active)
  VALUES 
    ('place_india', 'sales_cash', '4121', v_place_india_cash_id, true),
    ('place_india', 'sales_credit', '4122', v_place_india_credit_id, true),
    ('place_india', 'payment_cash', '1111', v_cash_account_id, true),
    ('place_india', 'payment_bank', '1121', v_bank_account_id, true),
    ('place_india', 'vat', '2141', v_vat_account_id, true)
  ON CONFLICT (branch_name, account_type) 
  DO UPDATE SET account_number = EXCLUDED.account_number, account_id = EXCLUDED.account_id, updated_at = NOW();
END $$;

-- ============================================
-- 5️⃣ إضافة البيانات الأساسية لـ pos_tables
-- ============================================

-- إضافة طاولات افتراضية للفروع
INSERT INTO pos_tables (branch, table_code, table_name, status, capacity, is_active)
VALUES 
  -- China Town - 10 طاولات
  ('china_town', '1', 'طاولة 1', 'AVAILABLE', 4, true),
  ('china_town', '2', 'طاولة 2', 'AVAILABLE', 4, true),
  ('china_town', '3', 'طاولة 3', 'AVAILABLE', 4, true),
  ('china_town', '4', 'طاولة 4', 'AVAILABLE', 4, true),
  ('china_town', '5', 'طاولة 5', 'AVAILABLE', 4, true),
  ('china_town', '6', 'طاولة 6', 'AVAILABLE', 4, true),
  ('china_town', '7', 'طاولة 7', 'AVAILABLE', 4, true),
  ('china_town', '8', 'طاولة 8', 'AVAILABLE', 4, true),
  ('china_town', '9', 'طاولة 9', 'AVAILABLE', 4, true),
  ('china_town', '10', 'طاولة 10', 'AVAILABLE', 4, true),
  
  -- Place India - 10 طاولات
  ('place_india', '1', 'Table 1', 'AVAILABLE', 4, true),
  ('place_india', '2', 'Table 2', 'AVAILABLE', 4, true),
  ('place_india', '3', 'Table 3', 'AVAILABLE', 4, true),
  ('place_india', '4', 'Table 4', 'AVAILABLE', 4, true),
  ('place_india', '5', 'Table 5', 'AVAILABLE', 4, true),
  ('place_india', '6', 'Table 6', 'AVAILABLE', 4, true),
  ('place_india', '7', 'Table 7', 'AVAILABLE', 4, true),
  ('place_india', '8', 'Table 8', 'AVAILABLE', 4, true),
  ('place_india', '9', 'Table 9', 'AVAILABLE', 4, true),
  ('place_india', '10', 'Table 10', 'AVAILABLE', 4, true)
ON CONFLICT (branch, table_code) 
DO UPDATE SET table_name = EXCLUDED.table_name, updated_at = NOW();

-- ============================================
-- 6️⃣ إنشاء الفهارس لتحسين الأداء
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invoices_journal_entry_id ON invoices(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_orders_branch_table ON orders(branch, table_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_branch ON journal_entries(branch);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_pos_tables_branch_code ON pos_tables(branch, table_code);
CREATE INDEX IF NOT EXISTS idx_pos_tables_status ON pos_tables(status);

COMMIT;

-- ============================================
-- 7️⃣ تقرير التحقق من قاعدة البيانات
-- ============================================

-- عرض جميع الجداول
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- عرض عدد الصفوف في كل جدول أساسي
SELECT 
  'accounts' as table_name, COUNT(*) as row_count FROM accounts
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'journal_entries', COUNT(*) FROM journal_entries
UNION ALL
SELECT 'journal_postings', COUNT(*) FROM journal_postings
UNION ALL
SELECT 'branch_accounts', COUNT(*) FROM branch_accounts
UNION ALL
SELECT 'pos_tables', COUNT(*) FROM pos_tables
UNION ALL
SELECT 'order_drafts', COUNT(*) FROM order_drafts
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'partners', COUNT(*) FROM partners
UNION ALL
SELECT 'users', COUNT(*) FROM users
ORDER BY table_name;

-- عرض الحسابات الأساسية
SELECT account_number, account_code, name, name_en, type, nature 
FROM accounts 
WHERE account_number IN ('1111', '1121', '2141', '4111', '4112', '4121', '4122', '5111', '5112')
ORDER BY account_number;

-- عرض حسابات الفروع
SELECT ba.branch_name, ba.account_type, ba.account_number, a.name as account_name
FROM branch_accounts ba
LEFT JOIN accounts a ON a.id = ba.account_id
WHERE ba.is_active = true
ORDER BY ba.branch_name, ba.account_type;

-- عرض الطاولات
SELECT branch, table_code, table_name, status, capacity, is_active
FROM pos_tables
ORDER BY branch, table_code;

-- عرض الأعمدة في الجداول الرئيسية
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('invoices', 'orders', 'journal_entries', 'journal_postings', 'accounts', 'branch_accounts', 'pos_tables', 'order_drafts')
ORDER BY table_name, ordinal_position;

-- عرض المفاتيح الأجنبية
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
