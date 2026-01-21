-- =====================================================
-- Performance Optimization Indexes
-- تحسين الأداء - إضافة الفهارس المفقودة
-- =====================================================
-- Run with: psql $DATABASE_URL -f indexes_optimization.sql
-- =====================================================

-- Start timing
\timing on

-- =====================================================
-- 1. Journal Entries (أكثر الجداول استخداماً)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for journal_entries...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_date 
    ON journal_entries(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_status 
    ON journal_entries(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_period 
    ON journal_entries(period);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_date_status 
    ON journal_entries(date, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_reference 
    ON journal_entries(reference_type, reference_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_branch 
    ON journal_entries(branch);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_je_created_at 
    ON journal_entries(created_at DESC);

-- =====================================================
-- 2. Journal Postings (يُستعلم مع journal_entries)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for journal_postings...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jp_account_id 
    ON journal_postings(account_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jp_journal_entry_id 
    ON journal_postings(journal_entry_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jp_account_journal 
    ON journal_postings(account_id, journal_entry_id);

-- =====================================================
-- 3. Partners (العملاء والموردين)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for partners...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partners_type 
    ON partners(type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partners_name 
    ON partners(name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partners_phone 
    ON partners(phone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partners_customer_type 
    ON partners(customer_type);

-- =====================================================
-- 4. Products (المنتجات)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for products...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_is_active 
    ON products(is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category 
    ON products(category);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_barcode 
    ON products(barcode);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku 
    ON products(sku);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name 
    ON products(name);

-- =====================================================
-- 5. Users (المستخدمين)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for users...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
    ON users(email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
    ON users(role);

-- =====================================================
-- 6. Invoices (الفواتير)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for invoices...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_date 
    ON invoices(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer_id 
    ON invoices(customer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_type 
    ON invoices(type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_number 
    ON invoices(number);

-- =====================================================
-- 7. Orders (الطلبات)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for orders...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at 
    ON orders(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id 
    ON orders(customer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_branch_table 
    ON orders(branch, table_code);

-- =====================================================
-- 8. Expenses (المصروفات)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for expenses...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_date 
    ON expenses(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_status 
    ON expenses(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_type 
    ON expenses(expense_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_account 
    ON expenses(expense_account_code);

-- =====================================================
-- 9. User Permissions (صلاحيات المستخدمين)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for user_permissions...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_perms_user_id 
    ON user_permissions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_perms_screen 
    ON user_permissions(screen_code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_perms_composite 
    ON user_permissions(user_id, screen_code, action_code);

-- =====================================================
-- 10. Accounts (شجرة الحسابات)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for accounts...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_code 
    ON accounts(account_code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_parent 
    ON accounts(parent_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_type 
    ON accounts(type);

-- =====================================================
-- 11. Settings (الإعدادات)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for settings...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settings_key 
    ON settings(key);

-- =====================================================
-- 12. Accounting Periods (الفترات المحاسبية)
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Creating indexes for accounting_periods...';
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_periods_period 
    ON accounting_periods(period);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_periods_status 
    ON accounting_periods(status);

-- =====================================================
-- Run ANALYZE to update statistics
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Running ANALYZE on all tables...';
END $$;

ANALYZE journal_entries;
ANALYZE journal_postings;
ANALYZE partners;
ANALYZE products;
ANALYZE users;
ANALYZE invoices;
ANALYZE orders;
ANALYZE expenses;
ANALYZE user_permissions;
ANALYZE accounts;
ANALYZE settings;

-- =====================================================
-- Summary
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Index creation completed!';
    RAISE NOTICE '=====================================================';
END $$;

-- List all indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
