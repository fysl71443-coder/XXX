-- ============================================================================
-- COMPREHENSIVE FINANCIAL DATA FIX AND JOURNAL ENTRIES GENERATION
-- ============================================================================
-- Purpose: Fix missing columns, populate journal entries, and ensure data integrity
-- Target Database: Render PostgreSQL (china_town_db_czwv)
-- 
-- IMPORTANT: Run this script in sections and verify results before proceeding
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: INSPECT CURRENT STATE
-- ============================================================================
-- Check current data in all financial tables to understand what needs fixing

-- Count records and missing data
SELECT 'EXPENSES' as table_name, 
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE branch IS NULL OR branch = '') as missing_branch,
       COUNT(*) FILTER (WHERE status IS NULL OR status = '') as missing_status,
       COUNT(*) FILTER (WHERE date IS NULL) as missing_date,
       COUNT(*) FILTER (WHERE amount IS NULL OR amount = 0) as missing_amount
FROM expenses;

SELECT 'INVOICES' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE branch IS NULL OR branch = '') as missing_branch,
       COUNT(*) FILTER (WHERE status IS NULL OR status = '') as missing_status,
       COUNT(*) FILTER (WHERE date IS NULL) as missing_date,
       COUNT(*) FILTER (WHERE total IS NULL OR total = 0) as missing_total
FROM invoices;

SELECT 'SUPPLIER_INVOICES' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE branch IS NULL OR branch = '') as missing_branch,
       COUNT(*) FILTER (WHERE status IS NULL OR status = '') as missing_status,
       COUNT(*) FILTER (WHERE date IS NULL) as missing_date,
       COUNT(*) FILTER (WHERE total IS NULL OR total = 0) as missing_total
FROM supplier_invoices;

SELECT 'PAYMENTS' as table_name,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE branch IS NULL OR branch = '') as missing_branch,
       COUNT(*) FILTER (WHERE status IS NULL OR status = '') as missing_status,
       COUNT(*) FILTER (WHERE amount IS NULL OR amount = 0) as missing_amount
FROM payments;

-- Check existing journal entries
SELECT 'JOURNAL_ENTRIES' as table_name,
       COUNT(*) as total_entries,
       COUNT(DISTINCT reference_type) as reference_types,
       COUNT(*) FILTER (WHERE reference_type = 'expense') as expense_entries,
       COUNT(*) FILTER (WHERE reference_type = 'invoice') as invoice_entries,
       COUNT(*) FILTER (WHERE reference_type = 'supplier_invoice') as supplier_invoice_entries
FROM journal_entries;

-- ============================================================================
-- STEP 2: FIX MISSING COLUMNS IN EXPENSES TABLE
-- ============================================================================
-- Why: Expenses need branch, status, date, and amount for proper accounting and reporting
-- Fix: Set defaults for missing values

UPDATE expenses
SET 
    branch = COALESCE(NULLIF(branch, ''), 'china_town'),
    status = COALESCE(NULLIF(status, ''), 'draft'),
    date = COALESCE(date, created_at::DATE, CURRENT_DATE),
    description = COALESCE(NULLIF(description, ''), 'No description provided'),
    amount = COALESCE(amount, 0),
    payment_method = COALESCE(NULLIF(payment_method, ''), 'cash')
WHERE 
    branch IS NULL OR branch = '' OR
    status IS NULL OR status = '' OR
    date IS NULL OR
    description IS NULL OR description = '' OR
    amount IS NULL OR
    payment_method IS NULL OR payment_method = '';

-- Report changes
SELECT 'EXPENSES UPDATED' as action, COUNT(*) as records_updated
FROM expenses
WHERE 
    branch = 'china_town' AND 
    status = 'draft' AND
    date = CURRENT_DATE;

-- ============================================================================
-- STEP 3: FIX MISSING COLUMNS IN INVOICES TABLE
-- ============================================================================
-- Why: Invoices need branch, status, date, and totals for sales tracking and reporting
-- Fix: Set defaults for missing values

UPDATE invoices
SET 
    branch = COALESCE(NULLIF(branch, ''), 'china_town'),
    status = COALESCE(NULLIF(status, ''), 'draft'),
    date = COALESCE(date, created_at::DATE, CURRENT_DATE),
    subtotal = COALESCE(subtotal, 0),
    discount_amount = COALESCE(discount_amount, 0),
    tax_amount = COALESCE(tax_amount, 0),
    total = COALESCE(total, COALESCE(subtotal, 0) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0))
WHERE 
    branch IS NULL OR branch = '' OR
    status IS NULL OR status = '' OR
    date IS NULL OR
    subtotal IS NULL OR
    discount_amount IS NULL OR
    tax_amount IS NULL OR
    total IS NULL;

-- Report changes
SELECT 'INVOICES UPDATED' as action, COUNT(*) as records_updated
FROM invoices
WHERE branch = 'china_town' AND status = 'draft';

-- ============================================================================
-- STEP 4: FIX MISSING COLUMNS IN SUPPLIER_INVOICES TABLE
-- ============================================================================
-- Why: Supplier invoices need branch, status, date, and totals for purchase tracking
-- Fix: Set defaults for missing values

UPDATE supplier_invoices
SET 
    branch = COALESCE(NULLIF(branch, ''), 'china_town'),
    status = COALESCE(NULLIF(status, ''), 'draft'),
    date = COALESCE(date, created_at::DATE, CURRENT_DATE),
    subtotal = COALESCE(subtotal, 0),
    discount_amount = COALESCE(discount_amount, 0),
    tax_amount = COALESCE(tax_amount, 0),
    total = COALESCE(total, COALESCE(subtotal, 0) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0))
WHERE 
    branch IS NULL OR branch = '' OR
    status IS NULL OR status = '' OR
    date IS NULL OR
    subtotal IS NULL OR
    discount_amount IS NULL OR
    tax_amount IS NULL OR
    total IS NULL;

-- Report changes
SELECT 'SUPPLIER_INVOICES UPDATED' as action, COUNT(*) as records_updated
FROM supplier_invoices
WHERE branch = 'china_town' AND status = 'draft';

-- ============================================================================
-- STEP 5: FIX MISSING COLUMNS IN PAYMENTS TABLE (if exists)
-- ============================================================================
-- Why: Payments need branch, status, and amounts for reconciliation
-- Fix: Set defaults for missing values

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        EXECUTE '
        UPDATE payments
        SET 
            branch = COALESCE(NULLIF(branch, ''''), ''china_town''),
            status = COALESCE(NULLIF(status, ''''), ''draft''),
            amount = COALESCE(amount, 0)
        WHERE 
            branch IS NULL OR branch = '''' OR
            status IS NULL OR status = '''' OR
            amount IS NULL;
        ';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: FIX JOURNAL_ENTRIES SEQUENCE
-- ============================================================================
-- Why: entry_number sequence must be set to max existing value + 1 to avoid conflicts
-- Fix: Get max entry_number and set sequence to that value

DO $$
DECLARE
    max_entry_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(entry_number), 0) INTO max_entry_number FROM journal_entries;
    
    -- Set sequence to max + 1
    EXECUTE format('SELECT setval(''journal_entries_entry_number_seq'', %s, false)', max_entry_number);
    
    -- If sequence doesn't exist, create it
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'journal_entries_entry_number_seq') THEN
        CREATE SEQUENCE journal_entries_entry_number_seq START WITH max_entry_number + 1;
    END IF;
    
    RAISE NOTICE 'Journal entries sequence set to: %', max_entry_number + 1;
END $$;

-- ============================================================================
-- STEP 7: CREATE JOURNAL ENTRIES FOR EXPENSES
-- ============================================================================
-- Why: Each expense must have a corresponding journal entry for proper double-entry accounting
-- Fix: Create journal entries for expenses that don't have one yet
-- Logic: Debit expense account, Credit cash/bank account

INSERT INTO journal_entries (entry_number, description, date, period, reference_type, reference_id, status)
SELECT 
    nextval('journal_entries_entry_number_seq') as entry_number,
    COALESCE(NULLIF(e.description, ''), 'مصروف #' || e.id) as description,
    e.date,
    TO_CHAR(e.date, 'YYYY-MM') as period,
    'expense' as reference_type,
    e.id as reference_id,
    CASE WHEN e.status = 'posted' THEN 'posted' ELSE 'draft' END as status
FROM expenses e
WHERE NOT EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.reference_type = 'expense' AND je.reference_id = e.id
)
AND e.amount > 0;

-- Report created entries
SELECT 'EXPENSE JOURNAL ENTRIES CREATED' as action, COUNT(*) as entries_created
FROM journal_entries
WHERE reference_type = 'expense'
AND id > (SELECT COALESCE(MAX(id), 0) FROM journal_entries WHERE reference_type = 'expense' AND id < 999999);

-- ============================================================================
-- STEP 8: CREATE JOURNAL POSTINGS FOR EXPENSES
-- ============================================================================
-- Why: Journal entries need postings to show which accounts are debited/credited
-- Fix: Create postings for expense journal entries that don't have postings
-- Logic: 
--   - Debit: Expense account (from account_code)
--   - Credit: Cash (1111) or Bank (1121) based on payment_method

INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    a.id as account_id,
    e.amount as debit,
    0 as credit
FROM journal_entries je
JOIN expenses e ON je.reference_type = 'expense' AND je.reference_id = e.id
LEFT JOIN accounts a ON a.account_number = e.account_code
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.debit > 0
)
AND e.amount > 0
AND a.id IS NOT NULL;

-- Create credit posting (cash/bank)
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    COALESCE(
        (SELECT id FROM accounts WHERE account_number = '1121' AND LOWER(e.payment_method) LIKE '%bank%' LIMIT 1),
        (SELECT id FROM accounts WHERE account_number = '1111' LIMIT 1)
    ) as account_id,
    0 as debit,
    e.amount as credit
FROM journal_entries je
JOIN expenses e ON je.reference_type = 'expense' AND je.reference_id = e.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.credit > 0
)
AND e.amount > 0;

-- ============================================================================
-- STEP 9: CREATE JOURNAL ENTRIES FOR INVOICES
-- ============================================================================
-- Why: Each invoice must have a journal entry to record sales and receivables
-- Fix: Create journal entries for invoices that don't have one yet
-- Logic: Based on payment method - cash sales vs credit sales

INSERT INTO journal_entries (entry_number, description, date, period, reference_type, reference_id, status)
SELECT 
    nextval('journal_entries_entry_number_seq') as entry_number,
    'فاتورة مبيعات #' || COALESCE(i.number, i.id::TEXT) as description,
    i.date,
    TO_CHAR(i.date, 'YYYY-MM') as period,
    'invoice' as reference_type,
    i.id as reference_id,
    CASE WHEN i.status = 'posted' THEN 'posted' ELSE 'draft' END as status
FROM invoices i
WHERE NOT EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.reference_type = 'invoice' AND je.reference_id = i.id
)
AND i.total > 0;

-- Report created entries
SELECT 'INVOICE JOURNAL ENTRIES CREATED' as action, COUNT(*) as entries_created
FROM journal_entries
WHERE reference_type = 'invoice'
AND id > (SELECT COALESCE(MAX(id), 0) FROM journal_entries WHERE reference_type = 'invoice' AND id < 999999);

-- ============================================================================
-- STEP 10: CREATE JOURNAL POSTINGS FOR INVOICES
-- ============================================================================
-- Why: Invoice journal entries need postings to show sales, receivables, and VAT
-- Fix: Create postings for invoice journal entries
-- Logic:
--   - Debit: Customer Receivable (if credit) or Cash/Bank (if cash)
--   - Credit: Sales Revenue (4111 or 4121 based on branch)
--   - Credit: VAT Output (2141) if tax > 0

-- Debit posting: Customer Receivable (for credit sales) or Cash/Bank (for cash sales)
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    COALESCE(
        CASE 
            WHEN LOWER(i.payment_method) LIKE '%credit%' AND i.customer_id IS NOT NULL THEN
                (SELECT account_id FROM partners WHERE id = i.customer_id LIMIT 1)
            WHEN LOWER(i.payment_method) LIKE '%bank%' THEN
                (SELECT id FROM accounts WHERE account_number = '1121' LIMIT 1)
            ELSE
                (SELECT id FROM accounts WHERE account_number = '1111' LIMIT 1)
        END,
        (SELECT id FROM accounts WHERE account_number = '1111' LIMIT 1)
    ) as account_id,
    i.total as debit,
    0 as credit
FROM journal_entries je
JOIN invoices i ON je.reference_type = 'invoice' AND je.reference_id = i.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.debit > 0
)
AND i.total > 0;

-- Credit posting: Sales Revenue
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    COALESCE(
        CASE 
            WHEN i.branch LIKE '%india%' OR i.branch LIKE '%place%' THEN
                CASE WHEN LOWER(i.payment_method) LIKE '%credit%' THEN 
                    (SELECT id FROM accounts WHERE account_number = '4122' LIMIT 1)
                ELSE 
                    (SELECT id FROM accounts WHERE account_number = '4121' LIMIT 1)
                END
            ELSE
                CASE WHEN LOWER(i.payment_method) LIKE '%credit%' THEN 
                    (SELECT id FROM accounts WHERE account_number = '4112' LIMIT 1)
                ELSE 
                    (SELECT id FROM accounts WHERE account_number = '4111' LIMIT 1)
                END
        END,
        (SELECT id FROM accounts WHERE account_number = '4111' LIMIT 1)
    ) as account_id,
    0 as debit,
    (i.subtotal - COALESCE(i.discount_amount, 0)) as credit
FROM journal_entries je
JOIN invoices i ON je.reference_type = 'invoice' AND je.reference_id = i.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.credit > 0 AND jp.account_id IN (
        SELECT id FROM accounts WHERE account_number IN ('4111', '4112', '4121', '4122')
    )
)
AND i.subtotal > 0;

-- Credit posting: VAT Output (if tax > 0)
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    (SELECT id FROM accounts WHERE account_number = '2141' LIMIT 1) as account_id,
    0 as debit,
    i.tax_amount as credit
FROM journal_entries je
JOIN invoices i ON je.reference_type = 'invoice' AND je.reference_id = i.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.account_id = (
        SELECT id FROM accounts WHERE account_number = '2141' LIMIT 1
    )
)
AND COALESCE(i.tax_amount, 0) > 0;

-- ============================================================================
-- STEP 11: CREATE JOURNAL ENTRIES FOR SUPPLIER INVOICES
-- ============================================================================
-- Why: Supplier invoices need journal entries to record purchases and payables
-- Fix: Create journal entries for supplier invoices that don't have one yet

INSERT INTO journal_entries (entry_number, description, date, period, reference_type, reference_id, status)
SELECT 
    nextval('journal_entries_entry_number_seq') as entry_number,
    'فاتورة شراء #' || COALESCE(si.number, si.id::TEXT) as description,
    si.date,
    TO_CHAR(si.date, 'YYYY-MM') as period,
    'supplier_invoice' as reference_type,
    si.id as reference_id,
    CASE WHEN si.status = 'posted' THEN 'posted' ELSE 'draft' END as status
FROM supplier_invoices si
WHERE NOT EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.reference_type = 'supplier_invoice' AND je.reference_id = si.id
)
AND si.total > 0;

-- Report created entries
SELECT 'SUPPLIER_INVOICE JOURNAL ENTRIES CREATED' as action, COUNT(*) as entries_created
FROM journal_entries
WHERE reference_type = 'supplier_invoice'
AND id > (SELECT COALESCE(MAX(id), 0) FROM journal_entries WHERE reference_type = 'supplier_invoice' AND id < 999999);

-- ============================================================================
-- STEP 12: CREATE JOURNAL POSTINGS FOR SUPPLIER INVOICES
-- ============================================================================
-- Why: Supplier invoice journal entries need postings for inventory, payables, and VAT
-- Logic:
--   - Debit: Inventory (1161) or Expense account
--   - Credit: Supplier Payable (2111 or supplier account)
--   - Debit: VAT Input (1170) if tax > 0

-- Debit posting: Inventory or Expense (based on type)
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    COALESCE(
        (SELECT id FROM accounts WHERE account_number = '1161' LIMIT 1),
        (SELECT id FROM accounts WHERE account_number = '5100' LIMIT 1)
    ) as account_id,
    (si.subtotal - COALESCE(si.discount_amount, 0)) as debit,
    0 as credit
FROM journal_entries je
JOIN supplier_invoices si ON je.reference_type = 'supplier_invoice' AND je.reference_id = si.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.debit > 0
)
AND si.subtotal > 0;

-- Credit posting: Supplier Payable
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    COALESCE(
        (SELECT account_id FROM partners WHERE id = si.supplier_id AND type = 'supplier' LIMIT 1),
        (SELECT id FROM accounts WHERE account_number = '2111' LIMIT 1)
    ) as account_id,
    0 as debit,
    si.total as credit
FROM journal_entries je
JOIN supplier_invoices si ON je.reference_type = 'supplier_invoice' AND je.reference_id = si.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.credit > 0 AND jp.account_id IN (
        SELECT id FROM accounts WHERE account_number = '2111'
        UNION
        SELECT account_id FROM partners WHERE type = 'supplier'
    )
)
AND si.total > 0;

-- Debit posting: VAT Input (if tax > 0)
INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
SELECT 
    je.id as journal_entry_id,
    (SELECT id FROM accounts WHERE account_number = '1170' LIMIT 1) as account_id,
    si.tax_amount as debit,
    0 as credit
FROM journal_entries je
JOIN supplier_invoices si ON je.reference_type = 'supplier_invoice' AND je.reference_id = si.id
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id AND jp.account_id = (
        SELECT id FROM accounts WHERE account_number = '1170' LIMIT 1
    )
)
AND COALESCE(si.tax_amount, 0) > 0;

-- ============================================================================
-- STEP 13: VERIFICATION - DISPLAY RESULTS
-- ============================================================================

-- Show sample data from each table
SELECT '=== EXPENSES SAMPLE ===' as info;
SELECT id, branch, status, date, amount, description, payment_method, account_code
FROM expenses
ORDER BY id DESC
LIMIT 10;

SELECT '=== INVOICES SAMPLE ===' as info;
SELECT id, branch, status, date, total, subtotal, tax_amount, customer_id, payment_method
FROM invoices
ORDER BY id DESC
LIMIT 10;

SELECT '=== SUPPLIER_INVOICES SAMPLE ===' as info;
SELECT id, branch, status, date, total, subtotal, tax_amount, supplier_id
FROM supplier_invoices
ORDER BY id DESC
LIMIT 10;

-- Check journal entries created
SELECT '=== JOURNAL ENTRIES SUMMARY ===' as info;
SELECT 
    reference_type,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE status = 'posted') as posted_entries,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_entries
FROM journal_entries
GROUP BY reference_type;

-- Check journal postings balance
SELECT '=== JOURNAL POSTINGS BALANCE CHECK ===' as info;
SELECT 
    je.reference_type,
    COUNT(DISTINCT je.id) as entries_with_postings,
    SUM(jp.debit) as total_debits,
    SUM(jp.credit) as total_credits,
    ABS(SUM(jp.debit) - SUM(jp.credit)) as imbalance
FROM journal_entries je
LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
GROUP BY je.reference_type
HAVING ABS(SUM(jp.debit) - SUM(jp.credit)) > 0.01;

-- Check for entries without postings
SELECT '=== JOURNAL ENTRIES WITHOUT POSTINGS ===' as info;
SELECT 
    je.reference_type,
    je.reference_id,
    je.description,
    je.status
FROM journal_entries je
WHERE NOT EXISTS (
    SELECT 1 FROM journal_postings jp WHERE jp.journal_entry_id = je.id
)
LIMIT 20;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================
-- Ensure no NULL values in critical columns

SELECT '=== NULL VALUES CHECK ===' as info;
SELECT 'expenses' as table_name, COUNT(*) as null_branch FROM expenses WHERE branch IS NULL OR branch = ''
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses WHERE status IS NULL OR status = ''
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses WHERE date IS NULL
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses WHERE amount IS NULL
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE branch IS NULL OR branch = ''
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE status IS NULL OR status = ''
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE date IS NULL
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE total IS NULL
UNION ALL
SELECT 'supplier_invoices', COUNT(*) FROM supplier_invoices WHERE branch IS NULL OR branch = ''
UNION ALL
SELECT 'supplier_invoices', COUNT(*) FROM supplier_invoices WHERE status IS NULL OR status = '';

COMMIT;

-- ============================================================================
-- SCRIPT COMPLETE
-- ============================================================================
-- Review the verification results above to ensure:
-- 1. All NULL values have been filled
-- 2. Journal entries exist for all financial records
-- 3. Journal postings are balanced (debits = credits)
-- 4. No entries are missing postings
-- ============================================================================
