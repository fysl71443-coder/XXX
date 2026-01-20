const { Client } = require('pg');

// Database connection string - use from environment or command line argument
// Usage: DATABASE_URL="..." node seed_branch_accounts_mapping.cjs
// Or: node seed_branch_accounts_mapping.cjs "postgresql://..."
const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a.oregon-postgres.render.com/china_town_db_czwv';

// ربط الحسابات بالفروع حسب الشجرة الكاملة
const branchAccountMappings = [
  // ═══════════════════════════════════════════════════════════════
  // China Town Branch
  // ═══════════════════════════════════════════════════════════════
  { branch_name: 'china_town', account_type: 'sales_cash', account_number: '4111' },
  { branch_name: 'china_town', account_type: 'sales_credit', account_number: '4112' },
  { branch_name: 'china_town', account_type: 'payment_cash', account_number: '1111' },
  { branch_name: 'china_town', account_type: 'payment_bank', account_number: '1121' },
  { branch_name: 'china_town', account_type: 'vat_output', account_number: '2141' },
  { branch_name: 'china_town', account_type: 'vat_input', account_number: '1150' },
  
  // ═══════════════════════════════════════════════════════════════
  // Place India Branch
  // ═══════════════════════════════════════════════════════════════
  { branch_name: 'place_india', account_type: 'sales_cash', account_number: '4121' },
  { branch_name: 'place_india', account_type: 'sales_credit', account_number: '4122' },
  { branch_name: 'place_india', account_type: 'payment_cash', account_number: '1111' },
  { branch_name: 'place_india', account_type: 'payment_bank', account_number: '1121' },
  { branch_name: 'place_india', account_type: 'vat_output', account_number: '2141' },
  { branch_name: 'place_india', account_type: 'vat_input', account_number: '1150' },
];

async function seedBranchAccounts(client) {
  console.log('📋 ربط الحسابات بالفروع...');
  
  // Ensure branch_accounts table exists with correct structure
  try {
    // Check if table exists
    const { rows: tableCheck } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'branch_accounts'
      )
    `);
    
    if (!tableCheck[0].exists) {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE branch_accounts (
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
      console.log('✅ تم إنشاء جدول branch_accounts');
    } else {
      // Check if branch_name column exists
      const { rows: columnCheck } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'branch_accounts' 
          AND column_name = 'branch_name'
        )
      `);
      
      if (!columnCheck[0].exists) {
        // Add branch_name column if it doesn't exist
        await client.query('ALTER TABLE branch_accounts ADD COLUMN branch_name TEXT');
        console.log('✅ تم إضافة عمود branch_name');
      }
      
      // Check and add other missing columns
      const requiredColumns = [
        { name: 'account_type', type: 'TEXT', nullable: false },
        { name: 'account_number', type: 'TEXT', nullable: false },
        { name: 'account_id', type: 'INTEGER', nullable: true, fk: 'accounts(id)' },
        { name: 'is_active', type: 'BOOLEAN', nullable: true, default: 'true' },
        { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'NOW()' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'NOW()' },
        { name: 'branch_code', type: 'TEXT', nullable: true } // Some tables might have this
      ];
      
      for (const col of requiredColumns) {
        const { rows: colCheck } = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'branch_accounts' 
            AND column_name = $1
          )
        `, [col.name]);
        
        if (!colCheck[0].exists) {
          let alterSql = `ALTER TABLE branch_accounts ADD COLUMN ${col.name} ${col.type}`;
          if (!col.nullable && col.name !== 'branch_code') {
            alterSql += ' NOT NULL';
          }
          if (col.default) {
            alterSql += ` DEFAULT ${col.default}`;
          }
          if (col.fk) {
            // Add FK constraint separately if needed
            alterSql += ` REFERENCES ${col.fk} ON DELETE SET NULL`;
          }
          await client.query(alterSql);
          console.log(`✅ تم إضافة عمود ${col.name}`);
        }
      }
      
      // Check if branch_code exists and make it nullable if it's causing issues
      try {
        const { rows: branchCodeCheck } = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'branch_accounts' 
            AND column_name = 'branch_code'
          )
        `);
        
        if (branchCodeCheck[0].exists) {
          // Make branch_code nullable if it's not already
          await client.query('ALTER TABLE branch_accounts ALTER COLUMN branch_code DROP NOT NULL');
          console.log('✅ تم جعل عمود branch_code اختياري');
        }
      } catch (e) {
        // Ignore if column doesn't exist or already nullable
      }
      
      // Add unique constraint if it doesn't exist
      try {
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'branch_accounts_branch_name_account_type_key'
            ) THEN
              ALTER TABLE branch_accounts ADD CONSTRAINT branch_accounts_branch_name_account_type_key 
              UNIQUE (branch_name, account_type);
            END IF;
          END $$;
        `);
      } catch (e) {
        // Constraint might already exist, ignore
      }
      
      console.log('✅ جدول branch_accounts موجود وجاهز');
    }
  } catch (e) {
    console.error('❌ خطأ في التحقق من جدول branch_accounts:', e.message);
    throw e;
  }
  
  // Clear existing mappings (optional - comment out if you want to keep existing)
  console.log('🗑️  مسح الربط القديم...');
  await client.query('DELETE FROM branch_accounts');
  
  // Get account IDs
  const accountIdMap = new Map();
  for (const mapping of branchAccountMappings) {
    if (!accountIdMap.has(mapping.account_number)) {
      try {
        const { rows } = await client.query(
          'SELECT id FROM accounts WHERE account_number = $1 LIMIT 1',
          [mapping.account_number]
        );
        if (rows && rows[0]) {
          accountIdMap.set(mapping.account_number, rows[0].id);
        } else {
          console.warn(`⚠️  حساب ${mapping.account_number} غير موجود في قاعدة البيانات`);
        }
      } catch (e) {
        console.warn(`⚠️  خطأ في البحث عن حساب ${mapping.account_number}:`, e.message);
      }
    }
  }
  
  // Insert mappings
  let inserted = 0;
  let skipped = 0;
  
  for (const mapping of branchAccountMappings) {
    const accountId = accountIdMap.get(mapping.account_number);
    
    if (!accountId) {
      console.warn(`⚠️  تخطي ربط ${mapping.branch_name} - ${mapping.account_type} (حساب ${mapping.account_number} غير موجود)`);
      skipped++;
      continue;
    }
    
    try {
      // Check if branch_code column exists
      const { rows: hasBranchCode } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'branch_accounts' 
          AND column_name = 'branch_code'
        )
      `);
      
      const hasBranchCodeCol = hasBranchCode[0].exists;
      
      if (hasBranchCodeCol) {
        // Insert with branch_code
        await client.query(
          `INSERT INTO branch_accounts (branch_name, branch_code, account_type, account_number, account_id, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (branch_name, account_type) 
           DO UPDATE SET account_number = $4, account_id = $5, updated_at = NOW()`,
          [mapping.branch_name, mapping.branch_name, mapping.account_type, mapping.account_number, accountId]
        );
      } else {
        // Insert without branch_code
        await client.query(
          `INSERT INTO branch_accounts (branch_name, account_type, account_number, account_id, is_active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (branch_name, account_type) 
           DO UPDATE SET account_number = $3, account_id = $4, updated_at = NOW()`,
          [mapping.branch_name, mapping.account_type, mapping.account_number, accountId]
        );
      }
      console.log(`  ✅ ربط ${mapping.branch_name} - ${mapping.account_type} → ${mapping.account_number}`);
      inserted++;
    } catch (e) {
      console.error(`  ❌ خطأ في ربط ${mapping.branch_name} - ${mapping.account_type}:`, e.message);
      skipped++;
    }
  }
  
  console.log(`\n✅ تم ربط ${inserted} حساب بنجاح`);
  if (skipped > 0) {
    console.log(`⚠️  تم تخطي ${skipped} ربط (حسابات غير موجودة)`);
  }
  
  return { inserted, skipped };
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    await seedBranchAccounts(client);
    
    console.log('\n✅ اكتملت عملية الربط بنجاح!');
  } catch (e) {
    console.error('❌ خطأ:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
