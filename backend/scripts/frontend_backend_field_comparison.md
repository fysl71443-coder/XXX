# Frontend-Backend Field Comparison Report

## 1. EXPENSES Table

### Database Schema:
- id, type, amount, account_code, partner_id, description, status, branch, date, payment_method, created_at, updated_at

### Backend API (GET /api/expenses):
✅ Returns: id, type, amount, account_code, partner_id, description, status, branch, date, payment_method, created_at

### Frontend Components:

#### Expenses.jsx:
- ✅ Displays: id, type, amount, account_code, partner_id, description, status, branch, date, payment_method
- ✅ Form includes: date, amount, description, payment_method, account_code, branch, expense_type
- ⚠️ Missing display: created_at (in table view)
- ✅ All fields properly saved

#### ExpensesInvoices.jsx:
- ✅ Displays: id, date, amount, account_code, description, status, branch, payment_method
- ✅ Filters: date range, account_code, status
- ⚠️ Missing display: created_at, updated_at
- ⚠️ Missing display: partner_id, type (in table columns)

## 2. INVOICES Table

### Database Schema:
- id, number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at, updated_at

### Backend API (GET /api/invoices):
✅ Returns: id, number, date, customer_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at

### Frontend Components:
⚠️ **NEED TO CHECK**: Need to find invoice display/list components

## 3. SUPPLIER_INVOICES Table

### Database Schema:
- id, number, date, due_date, supplier_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at, updated_at

### Backend API (GET /api/supplier-invoices):
✅ Returns: id, number, date, due_date, supplier_id, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, created_at

### Frontend Components:

#### SupplierInvoice.jsx:
- ✅ Form includes: invoiceNumber (number), invoiceDate (date), dueDate, supplierId, status, paymentMethod, lines
- ✅ Calculates: subtotal, discount, tax, total
- ⚠️ Missing: branch (not set in form, defaults to server)
- ⚠️ Missing display: created_at, updated_at in view

## 4. JOURNAL_ENTRIES Table

### Database Schema:
- id, entry_number, description, date, period, reference_type, reference_id, status, created_at

### Backend API (GET /api/journal):
✅ Returns: id, entry_number, description, date, reference_type, reference_id, status, created_at, total_debit, total_credit

### Frontend Components:

#### Journal.jsx:
- ✅ Displays: entry_number, description, date, reference_type, reference_id, status
- ✅ Filters: date, period, status, reference_type, entry_number
- ⚠️ Missing display: period (in table columns)
- ⚠️ Missing display: created_at (in table columns)

## 5. JOURNAL_POSTINGS Table

### Database Schema:
- id, journal_entry_id, account_id, debit, credit

### Backend API (GET /api/journal):
✅ Returns: postings array with: account_id, account_number, account_name, debit, credit

### Frontend Components:

#### JournalEntryCard.jsx:
- ✅ Displays: postings with account_number, account_name, debit, credit
- ✅ Shows balanced/unbalanced status

## SUMMARY OF MISSING FIELDS

### Critical Missing Fields:
1. **ExpensesInvoices.jsx**: Missing `partner_id`, `type` columns in table
2. **ExpensesInvoices.jsx**: Missing `created_at`, `updated_at` display
3. **SupplierInvoice.jsx**: Missing `branch` field in form (relies on server default)
4. **Journal.jsx**: Missing `period` column in table display
5. **Journal.jsx**: Missing `created_at` column in table display

### Non-Critical Missing Fields:
- Most components don't display `created_at`/`updated_at` in table views (acceptable, can be shown in detail view)
- Some form components rely on server defaults for `branch` (acceptable if consistent)

## RECOMMENDATIONS

1. **Add missing columns to ExpensesInvoices table**:
   - partner_id (if exists)
   - type (expense type)
   - created_at (for sorting/filtering)

2. **Add branch field to SupplierInvoice form**:
   - Allow user to select branch instead of relying on server default

3. **Add period column to Journal table**:
   - Important for accounting period filtering

4. **Ensure all APIs return complete data**:
   - All APIs already return the required fields ✅

5. **Add defaults in frontend API calls**:
   - Ensure branch defaults to 'china_town' if missing
   - Ensure date defaults to today if missing
   - Ensure status defaults to 'draft' if missing
