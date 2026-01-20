const { Client } = require('pg');

const DATABASE_URL = 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';

async function run() {
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    await client.query('BEGIN');

    // 1. إنشاء الجداول
    console.log('📋 Creating branch_accounts...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS branch_accounts (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        branch_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_name, account_type)
      )
    `);

    console.log('📋 Creating pos_tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pos_tables (
        id SERIAL PRIMARY KEY,
        branch TEXT NOT NULL,
        table_code TEXT NOT NULL,
        table_name TEXT,
        status TEXT DEFAULT 'AVAILABLE',
        current_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        capacity INTEGER DEFAULT 4,
        location TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch, table_code)
      )
    `);

    console.log('📋 Creating order_drafts...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_drafts (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        branch TEXT NOT NULL,
        table_code TEXT NOT NULL,
        lines JSONB,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. إضافة الأعمدة
    console.log('📋 Adding missing columns...');
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='journal_entry_id') THEN
          ALTER TABLE invoices ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='closed_at') THEN
          ALTER TABLE invoices ADD COLUMN closed_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='closed_at') THEN
          ALTER TABLE orders ADD COLUMN closed_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='account_code') THEN
          ALTER TABLE accounts ADD COLUMN account_code TEXT;
          UPDATE accounts SET account_code = account_number WHERE account_code IS NULL;
        END IF;
      END $$;
    `);

    // 3. الحسابات الأساسية
    console.log('📋 Creating basic accounts...');
    await client.query(`
      INSERT INTO accounts (account_number, account_code, name, name_en, type, nature, opening_balance, allow_manual_entry)
      VALUES 
        ('1111', '1111', 'نقد', 'Cash', 'asset', 'debit', 0, true),
        ('1121', '1121', 'بنك', 'Bank', 'asset', 'debit', 0, true),
        ('2141', '2141', 'ضريبة القيمة المضافة', 'VAT Payable', 'liability', 'credit', 0, true),
        ('4111', '4111', 'مبيعات نقدية', 'Cash Sales', 'revenue', 'credit', 0, true),
        ('4112', '4112', 'مبيعات آجلة', 'Credit Sales', 'revenue', 'credit', 0, true),
        ('4121', '4121', 'مبيعات نقدية - Place India', 'Cash Sales - Place India', 'revenue', 'credit', 0, true),
        ('4122', '4122', 'مبيعات آجلة - Place India', 'Credit Sales - Place India', 'revenue', 'credit', 0, true),
        ('5111', '5111', 'مصروفات عامة', 'General Expenses', 'expense', 'debit', 0, true),
        ('5112', '5112', 'مصروفات تشغيلية', 'Operating Expenses', 'expense', 'debit', 0, true)
      ON CONFLICT (account_number) DO NOTHING
    `);

    // 4. حسابات الفروع
    console.log('📋 Creating branch_accounts data...');
    await client.query(`
      DO $$
      DECLARE
        v_cash_sales_id INTEGER; v_credit_sales_id INTEGER;
        v_place_india_cash_id INTEGER; v_place_india_credit_id INTEGER;
        v_cash_account_id INTEGER; v_bank_account_id INTEGER; v_vat_account_id INTEGER;
      BEGIN
        SELECT id INTO v_cash_sales_id FROM accounts WHERE account_number = '4111' LIMIT 1;
        SELECT id INTO v_credit_sales_id FROM accounts WHERE account_number = '4112' LIMIT 1;
        SELECT id INTO v_place_india_cash_id FROM accounts WHERE account_number = '4121' LIMIT 1;
        SELECT id INTO v_place_india_credit_id FROM accounts WHERE account_number = '4122' LIMIT 1;
        SELECT id INTO v_cash_account_id FROM accounts WHERE account_number = '1111' LIMIT 1;
        SELECT id INTO v_bank_account_id FROM accounts WHERE account_number = '1121' LIMIT 1;
        SELECT id INTO v_vat_account_id FROM accounts WHERE account_number = '2141' LIMIT 1;
        
        INSERT INTO branch_accounts (branch_name, account_type, account_number, account_id, is_active)
        VALUES 
          ('china_town', 'sales_cash', '4111', v_cash_sales_id, true),
          ('china_town', 'sales_credit', '4112', v_credit_sales_id, true),
          ('china_town', 'payment_cash', '1111', v_cash_account_id, true),
          ('china_town', 'payment_bank', '1121', v_bank_account_id, true),
          ('china_town', 'vat', '2141', v_vat_account_id, true),
          ('place_india', 'sales_cash', '4121', v_place_india_cash_id, true),
          ('place_india', 'sales_credit', '4122', v_place_india_credit_id, true),
          ('place_india', 'payment_cash', '1111', v_cash_account_id, true),
          ('place_india', 'payment_bank', '1121', v_bank_account_id, true),
          ('place_india', 'vat', '2141', v_vat_account_id, true)
        ON CONFLICT (branch_name, account_type) 
        DO UPDATE SET account_number = EXCLUDED.account_number, account_id = EXCLUDED.account_id, updated_at = NOW();
      END $$;
    `);

    // 5. الطاولات
    console.log('📋 Creating pos_tables data...');
    await client.query(`
      INSERT INTO pos_tables (branch, table_code, table_name, status, capacity, is_active)
      VALUES 
        ('china_town', '1', 'طاولة 1', 'AVAILABLE', 4, true), ('china_town', '2', 'طاولة 2', 'AVAILABLE', 4, true),
        ('china_town', '3', 'طاولة 3', 'AVAILABLE', 4, true), ('china_town', '4', 'طاولة 4', 'AVAILABLE', 4, true),
        ('china_town', '5', 'طاولة 5', 'AVAILABLE', 4, true), ('china_town', '6', 'طاولة 6', 'AVAILABLE', 4, true),
        ('china_town', '7', 'طاولة 7', 'AVAILABLE', 4, true), ('china_town', '8', 'طاولة 8', 'AVAILABLE', 4, true),
        ('china_town', '9', 'طاولة 9', 'AVAILABLE', 4, true), ('china_town', '10', 'طاولة 10', 'AVAILABLE', 4, true),
        ('place_india', '1', 'Table 1', 'AVAILABLE', 4, true), ('place_india', '2', 'Table 2', 'AVAILABLE', 4, true),
        ('place_india', '3', 'Table 3', 'AVAILABLE', 4, true), ('place_india', '4', 'Table 4', 'AVAILABLE', 4, true),
        ('place_india', '5', 'Table 5', 'AVAILABLE', 4, true), ('place_india', '6', 'Table 6', 'AVAILABLE', 4, true),
        ('place_india', '7', 'Table 7', 'AVAILABLE', 4, true), ('place_india', '8', 'Table 8', 'AVAILABLE', 4, true),
        ('place_india', '9', 'Table 9', 'AVAILABLE', 4, true), ('place_india', '10', 'Table 10', 'AVAILABLE', 4, true)
      ON CONFLICT (branch, table_code) DO UPDATE SET table_name = EXCLUDED.table_name, updated_at = NOW()
    `);

    await client.query('COMMIT');
    console.log('\n✅ All fixes completed successfully!\n');

    // التحقق
    const { rows: tables } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
    console.log('📋 Tables:', tables.map(t => t.table_name).join(', '));
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

run().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
