-- ============================================================
-- إضافة الحسابات المطلوبة للنظام
-- Add Required Accounts for the System
-- ============================================================
-- هذا الملف يضيف الحسابات الأساسية المطلوبة لعمل النظام:
-- 1111: صندوق رئيسي (Main Cash)
-- 1121: بنك الراجحي (Al Rajhi Bank)
-- 4111: مبيعات نقدية – China Town
-- 4112: مبيعات آجلة – China Town
-- 4121: مبيعات نقدية – Place India
-- 4122: مبيعات آجلة – Place India
-- 2141: ضريبة القيمة المضافة – مستحقة (VAT Output)
-- ============================================================

-- إنشاء الحسابات الرئيسية (Parent Accounts) أولاً
-- Create parent accounts first

-- 0001 - الأصول (Assets)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '0001', '0001', 'الأصول', 'Assets', 'asset', 'debit', NULL, 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '0001');

-- 0002 - الالتزامات (Liabilities)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '0002', '0002', 'الالتزامات', 'Liabilities', 'liability', 'credit', NULL, 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '0002');

-- 0004 - الإيرادات (Revenue)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '0004', '0004', 'الإيرادات', 'Revenue', 'revenue', 'credit', NULL, 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '0004');

-- 1100 - أصول متداولة (Current Assets)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '1100', '1100', 'أصول متداولة', 'Current Assets', 'asset', 'debit', 
       (SELECT id FROM accounts WHERE account_number = '0001'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1100');

-- 1110 - النقد وما في حكمه (Cash and Cash Equivalents)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '1110', '1110', 'النقد وما في حكمه', 'Cash and Cash Equivalents', 'cash', 'debit',
       (SELECT id FROM accounts WHERE account_number = '1100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1110');

-- 1120 - بنوك (Banks)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '1120', '1120', 'بنوك', 'Banks', 'bank', 'debit',
       (SELECT id FROM accounts WHERE account_number = '1100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1120');

-- 2100 - التزامات متداولة (Current Liabilities)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '2100', '2100', 'التزامات متداولة', 'Current Liabilities', 'liability', 'credit',
       (SELECT id FROM accounts WHERE account_number = '0002'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '2100');

-- 2140 - ضرائب مستحقة (Tax Payables)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '2140', '2140', 'ضرائب مستحقة', 'Tax Payables', 'liability', 'credit',
       (SELECT id FROM accounts WHERE account_number = '2100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '2140');

-- 4100 - الإيرادات التشغيلية حسب الفرع (Operating Revenue by Branch)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '4100', '4100', 'الإيرادات التشغيلية حسب الفرع', 'Operating Revenue by Branch', 'revenue', 'credit',
       (SELECT id FROM accounts WHERE account_number = '0004'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '4100');

-- ============================================================
-- الحسابات المطلوبة (Required Accounts)
-- ============================================================

-- 1111 - صندوق رئيسي (Main Cash)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '1111', '1111', 'صندوق رئيسي', 'Main Cash', 'cash', 'debit',
       (SELECT id FROM accounts WHERE account_number = '1110'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1111');

-- 1121 - بنك الراجحي (Al Rajhi Bank)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '1121', '1121', 'بنك الراجحي', 'Al Rajhi Bank', 'bank', 'debit',
       (SELECT id FROM accounts WHERE account_number = '1120'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1121');

-- 4111 - مبيعات نقدية – China Town
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '4111', '4111', 'مبيعات نقدية – China Town', 'Cash Sales - China Town', 'revenue', 'credit',
       (SELECT id FROM accounts WHERE account_number = '4100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '4111');

-- 4112 - مبيعات آجلة – China Town
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '4112', '4112', 'مبيعات آجلة – China Town', 'Credit Sales - China Town', 'revenue', 'credit',
       (SELECT id FROM accounts WHERE account_number = '4100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '4112');

-- 4121 - مبيعات نقدية – Place India
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '4121', '4121', 'مبيعات نقدية – Place India', 'Cash Sales - Place India', 'revenue', 'credit',
       (SELECT id FROM accounts WHERE account_number = '4100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '4121');

-- 4122 - مبيعات آجلة – Place India
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '4122', '4122', 'مبيعات آجلة – Place India', 'Credit Sales - Place India', 'revenue', 'credit',
       (SELECT id FROM accounts WHERE account_number = '4100'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '4122');

-- 2141 - ضريبة القيمة المضافة – مستحقة (VAT Output)
INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
SELECT '2141', '2141', 'ضريبة القيمة المضافة – مستحقة', 'VAT Output', 'liability', 'credit',
       (SELECT id FROM accounts WHERE account_number = '2140'), 0, true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '2141');

-- ============================================================
-- التحقق من الحسابات المضافة
-- Verify Added Accounts
-- ============================================================
SELECT 
    account_number, 
    account_code, 
    name, 
    name_en, 
    type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM accounts WHERE account_number IN ('1111', '1121', '4111', '4112', '4121', '4122', '2141')) 
        THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status
FROM accounts 
WHERE account_number IN ('1111', '1121', '4111', '4112', '4121', '4122', '2141')
ORDER BY account_number;
