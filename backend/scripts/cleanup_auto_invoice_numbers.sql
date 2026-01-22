-- ============================================
-- Script to clean up invoices with "Auto" number
-- ============================================
-- This script removes any invoices that have "Auto" as their number
-- These are invalid records that should not exist
-- 
-- WARNING: This will DELETE invoices with number = 'Auto'
-- Make sure to backup your database before running this!

-- First, check how many invoices have "Auto" as number
SELECT COUNT(*) as auto_invoice_count 
FROM invoices 
WHERE number = 'Auto';

-- Show the invoices that will be deleted (for review)
SELECT id, number, date, customer_id, total, status, branch, created_at
FROM invoices 
WHERE number = 'Auto'
ORDER BY created_at DESC;

-- ============================================
-- UNCOMMENT THE FOLLOWING LINE TO DELETE:
-- ============================================
-- DELETE FROM invoices WHERE number = 'Auto';

-- After deletion, verify no "Auto" invoices remain
SELECT COUNT(*) as remaining_auto_invoices 
FROM invoices 
WHERE number = 'Auto';
