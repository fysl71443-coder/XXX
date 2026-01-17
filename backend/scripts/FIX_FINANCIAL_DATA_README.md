# Financial Data Fix and Journal Entries Generation Script

## Overview

This SQL script fixes missing columns in financial tables and automatically generates journal entries and postings for all financial transactions (expenses, invoices, supplier invoices).

## What This Script Does

### 1. Data Inspection
- Counts records and identifies missing data in all financial tables
- Shows current state of journal entries and postings

### 2. Column Fixes
- **Expenses**: Sets default values for `branch`, `status`, `date`, `description`, `amount`, `payment_method`
- **Invoices**: Sets default values for `branch`, `status`, `date`, `subtotal`, `discount_amount`, `tax_amount`, `total`
- **Supplier Invoices**: Sets default values for `branch`, `status`, `date`, `subtotal`, `discount_amount`, `tax_amount`, `total`
- **Payments**: Sets default values for `branch`, `status`, `amount` (if table exists)

### 3. Sequence Fixes
- Fixes `journal_entries_entry_number_seq` to ensure no conflicts
- Sets sequence to max existing entry_number + 1

### 4. Journal Entry Generation
- Creates journal entries for expenses without entries
- Creates journal entries for invoices without entries
- Creates journal entries for supplier invoices without entries
- Sets proper `period` (YYYY-MM) from transaction date

### 5. Journal Posting Generation

#### For Expenses:
- **Debit**: Expense account (from `account_code`)
- **Credit**: Cash (1111) or Bank (1121) based on `payment_method`

#### For Invoices:
- **Debit**: Customer Receivable (if credit) or Cash/Bank (if cash)
- **Credit**: Sales Revenue (4111/4112 for China Town, 4121/4122 for Place India)
- **Credit**: VAT Output (2141) if `tax_amount` > 0

#### For Supplier Invoices:
- **Debit**: Inventory (1161) or COGS (5100)
- **Credit**: Supplier Payable (2111 or supplier account)
- **Debit**: VAT Input (1170) if `tax_amount` > 0

### 6. Verification
- Shows sample data from each table
- Summarizes journal entries by type
- Checks journal postings balance (debits should equal credits)
- Identifies entries without postings
- Checks for remaining NULL values

## How to Run

### Option 1: Using psql Command Line

```bash
psql "postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv" -f backend/scripts/fix_financial_data_and_journals.sql
```

### Option 2: Using pgAdmin or DBeaver

1. Open the SQL script file
2. Connect to the database
3. Execute the entire script or run sections one by one
4. Review the output and verification results

### Option 3: Using Node.js Script

A Node.js wrapper script can be created to run this SQL and parse results.

## Expected Results

After running the script:

1. ✅ All financial records have `branch`, `status`, `date`, and amounts filled
2. ✅ Each expense, invoice, and supplier invoice has a corresponding journal entry
3. ✅ Each journal entry has balanced postings (debits = credits)
4. ✅ Sequences are set correctly to avoid conflicts
5. ✅ No NULL values in critical columns

## Safety Features

- Uses `BEGIN` and `COMMIT` transactions - can be rolled back if needed
- Checks for existing journal entries before creating new ones (no duplicates)
- Uses `COALESCE` to safely handle NULL values
- Verifies results after each major step

## Troubleshooting

### If script fails:
1. Check error message
2. Run `ROLLBACK;` to undo changes
3. Fix the issue and re-run

### If verification shows imbalances:
1. Review journal postings for the affected entries
2. Check if accounts exist in chart of accounts
3. Manually fix specific entries if needed

### If sequences conflict:
1. Check current sequence value: `SELECT currval('journal_entries_entry_number_seq');`
2. Check max entry_number: `SELECT MAX(entry_number) FROM journal_entries;`
3. Adjust sequence if needed: `SELECT setval('journal_entries_entry_number_seq', MAX_VALUE, false);`

## Account Mapping Reference

| Transaction Type | Debit Account | Credit Account | Notes |
|-----------------|---------------|----------------|-------|
| Expense (Cash) | Expense Account | 1111 (Cash) | Based on `account_code` |
| Expense (Bank) | Expense Account | 1121 (Bank) | Based on `payment_method` |
| Invoice (Cash) | 1111 (Cash) | 4111/4121 (Sales) + 2141 (VAT) | Based on branch |
| Invoice (Credit) | Customer Account | 4112/4122 (Sales) + 2141 (VAT) | Customer has account_id |
| Supplier Invoice | 1161 (Inventory) + 1170 (VAT Input) | 2111 (Supplier Payable) | VAT if applicable |

## Notes

- The script uses default branch "china_town" for missing branches
- Default status is "draft" for all records
- Dates default to `created_at` or `CURRENT_DATE`
- Amounts default to 0 if missing
- Journal entries are only created for records with amount/total > 0
