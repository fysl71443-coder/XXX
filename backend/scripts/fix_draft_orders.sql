-- ============================================
-- Fix Draft Orders - Complete Solution
-- ============================================
-- This script fixes all DRAFT orders to ensure:
-- 1. lines[0].meta contains all required fields
-- 2. Calculated totals (subtotal, discount_amount, tax_amount, total_amount) are present
-- 3. Customer fields (customerId, customer_name, customer_phone) are properly set
-- 4. All null values are replaced with defaults
-- ============================================

BEGIN;

-- Step 1: Add missing columns to orders table if they don't exist
DO $$
BEGIN
    -- Add subtotal column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='subtotal') THEN
        ALTER TABLE orders ADD COLUMN subtotal NUMERIC(18,2) DEFAULT 0;
    END IF;
    
    -- Add discount_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='discount_amount') THEN
        ALTER TABLE orders ADD COLUMN discount_amount NUMERIC(18,2) DEFAULT 0;
    END IF;
    
    -- Add tax_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='tax_amount') THEN
        ALTER TABLE orders ADD COLUMN tax_amount NUMERIC(18,2) DEFAULT 0;
    END IF;
    
    -- Add total_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='total_amount') THEN
        ALTER TABLE orders ADD COLUMN total_amount NUMERIC(18,2) DEFAULT 0;
    END IF;
    
    -- Add customerId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='customerId') THEN
        ALTER TABLE orders ADD COLUMN "customerId" INTEGER;
    END IF;
    
    -- Add customer_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='customer_name') THEN
        ALTER TABLE orders ADD COLUMN customer_name TEXT;
    END IF;
    
    -- Add customer_phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='customer_phone') THEN
        ALTER TABLE orders ADD COLUMN customer_phone TEXT;
    END IF;
END $$;

-- Step 2: Fix lines JSON for all DRAFT orders
-- This ensures lines[0].meta contains all required fields with calculated totals
UPDATE orders
SET lines = (
    SELECT jsonb_set(
        COALESCE(lines, '[]'::jsonb),
        '{0}',
        jsonb_build_object(
            'type', 'meta',
            'table', COALESCE((lines->0->>'table'), table_code::text, ''),
            'branch', COALESCE((lines->0->>'branch'), branch::text, 'china_town'),
            'taxPct', COALESCE((lines->0->>'taxPct')::numeric, 15),
            'payLines', COALESCE(lines->0->'payLines', '[]'::jsonb),
            'subtotal', COALESCE((
                SELECT SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))
                FROM jsonb_array_elements(COALESCE(lines, '[]'::jsonb)) AS elem(item)
                WHERE item->>'type' = 'item'
            ), 0),
            'discountPct', COALESCE((lines->0->>'discountPct')::numeric, 0),
            'discount_amount', COALESCE((
                SELECT SUM(COALESCE((item->>'discount')::numeric, 0))
                FROM jsonb_array_elements(COALESCE(lines, '[]'::jsonb)) AS elem(item)
                WHERE item->>'type' = 'item'
            ), 0),
            'tax_amount', COALESCE((
                SELECT ((SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))
                         - SUM(COALESCE((item->>'discount')::numeric, 0))) 
                        * COALESCE((lines->0->>'taxPct')::numeric, 15) / 100)
                FROM jsonb_array_elements(COALESCE(lines, '[]'::jsonb)) AS elem(item)
                WHERE item->>'type' = 'item'
            ), 0),
            'total_amount', COALESCE((
                SELECT ((SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))
                         - SUM(COALESCE((item->>'discount')::numeric, 0))) 
                        * (1 + COALESCE((lines->0->>'taxPct')::numeric, 15) / 100))
                FROM jsonb_array_elements(COALESCE(lines, '[]'::jsonb)) AS elem(item)
                WHERE item->>'type' = 'item'
            ), 0),
            'customerId', COALESCE((lines->0->>'customerId')::integer, 0),
            'customer_name', COALESCE(lines->0->>'customer_name', lines->0->>'customerName', ''),
            'paymentMethod', COALESCE(lines->0->>'paymentMethod', lines->0->>'payment_method', ''),
            'customer_phone', COALESCE(lines->0->>'customer_phone', lines->0->>'customerPhone', '')
        )
    )
)
WHERE status = 'DRAFT' AND (lines IS NULL OR jsonb_array_length(COALESCE(lines, '[]'::jsonb)) = 0 OR lines->0 IS NULL);

-- Step 3: Update existing meta objects in lines (for orders that already have meta)
UPDATE orders
SET lines = jsonb_set(
    lines,
    '{0}',
    (lines->0) || jsonb_build_object(
        'type', 'meta',
        'table', COALESCE((lines->0->>'table'), table_code::text, ''),
        'branch', COALESCE((lines->0->>'branch'), branch::text, 'china_town'),
        'taxPct', COALESCE((lines->0->>'taxPct')::numeric, 15),
        'payLines', COALESCE(lines->0->'payLines', '[]'::jsonb),
        'subtotal', COALESCE((
            SELECT SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))
            FROM jsonb_array_elements(lines) AS elem(item)
            WHERE item->>'type' = 'item'
        ), COALESCE((lines->0->>'subtotal')::numeric, 0)),
        'discountPct', COALESCE((lines->0->>'discountPct')::numeric, 0),
        'discount_amount', COALESCE((
            SELECT SUM(COALESCE((item->>'discount')::numeric, 0))
            FROM jsonb_array_elements(lines) AS elem(item)
            WHERE item->>'type' = 'item'
        ), COALESCE((lines->0->>'discount_amount')::numeric, 0)),
        'tax_amount', COALESCE((
            SELECT ((SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))
                     - SUM(COALESCE((item->>'discount')::numeric, 0))) 
                    * COALESCE((lines->0->>'taxPct')::numeric, 15) / 100)
            FROM jsonb_array_elements(lines) AS elem(item)
            WHERE item->>'type' = 'item'
        ), COALESCE((lines->0->>'tax_amount')::numeric, 0)),
        'total_amount', COALESCE((
            SELECT ((SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))
                     - SUM(COALESCE((item->>'discount')::numeric, 0))) 
                    * (1 + COALESCE((lines->0->>'taxPct')::numeric, 15) / 100))
            FROM jsonb_array_elements(lines) AS elem(item)
            WHERE item->>'type' = 'item'
        ), COALESCE((lines->0->>'total_amount')::numeric, 0)),
        'customerId', COALESCE((lines->0->>'customerId')::integer, 0),
        'customer_name', COALESCE(lines->0->>'customer_name', lines->0->>'customerName', ''),
        'paymentMethod', COALESCE(lines->0->>'paymentMethod', lines->0->>'payment_method', ''),
        'customer_phone', COALESCE(lines->0->>'customer_phone', lines->0->>'customerPhone', '')
    )
)
WHERE status = 'DRAFT' 
  AND lines IS NOT NULL 
  AND jsonb_array_length(lines) > 0 
  AND lines->0 IS NOT NULL
  AND (lines->0->>'type') = 'meta';

-- Step 4: Update columns from JSON (sync columns with JSON data)
UPDATE orders
SET
    subtotal = COALESCE((lines->0->>'subtotal')::numeric, 0),
    discount_amount = COALESCE((lines->0->>'discount_amount')::numeric, 0),
    tax_amount = COALESCE((lines->0->>'tax_amount')::numeric, 0),
    total_amount = COALESCE((lines->0->>'total_amount')::numeric, 0),
    "customerId" = COALESCE((lines->0->>'customerId')::integer, 0),
    customer_name = COALESCE(lines->0->>'customer_name', lines->0->>'customerName', ''),
    customer_phone = COALESCE(lines->0->>'customer_phone', lines->0->>'customerPhone', '')
WHERE status = 'DRAFT'
  AND lines IS NOT NULL
  AND jsonb_array_length(lines) > 0
  AND lines->0 IS NOT NULL;

-- Step 5: Verification query - Check for any remaining issues
SELECT 
    id,
    branch,
    table_code,
    status,
    CASE 
        WHEN lines IS NULL THEN 'MISSING_LINES'
        WHEN jsonb_array_length(lines) = 0 THEN 'EMPTY_LINES'
        WHEN lines->0 IS NULL THEN 'MISSING_META'
        WHEN (lines->0->>'type') != 'meta' THEN 'INVALID_META_TYPE'
        WHEN (lines->0->>'subtotal') IS NULL THEN 'MISSING_SUBTOTAL'
        WHEN (lines->0->>'total_amount') IS NULL THEN 'MISSING_TOTAL'
        ELSE 'OK'
    END as issue_status,
    (lines->0->>'subtotal')::numeric as subtotal,
    (lines->0->>'total_amount')::numeric as total_amount,
    (lines->0->>'customerId')::integer as customerId
FROM orders
WHERE status = 'DRAFT'
ORDER BY id DESC
LIMIT 20;

COMMIT;

-- ============================================
-- Summary
-- ============================================
-- This script:
-- 1. Adds missing columns to orders table
-- 2. Fixes lines JSON for all DRAFT orders
-- 3. Calculates and sets all totals in meta
-- 4. Syncs columns with JSON data
-- 5. Provides verification query
-- ============================================
