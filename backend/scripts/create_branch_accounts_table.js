const { Client } = require('pg');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  try {
    // إنشاء جدول branch_accounts
    await client.query(`
      CREATE TABLE IF NOT EXISTS branch_accounts (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        branch_name TEXT NOT NULL,
        account_type TEXT NOT NULL,  -- 'sales_cash', 'sales_credit', 'payment_cash', 'payment_bank', etc.
        account_number TEXT NOT NULL,  -- رقم الحساب مثل '4111', '4112', '1111', '1121'
        account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_name, account_type)
      )
    `);
    
    console.log('✅ Table branch_accounts created successfully');
    
    // إضافة بيانات افتراضية للفروع الموجودة
    const defaultAccounts = [
      // China Town - Cash Sales
      { branch_name: 'china_town', account_type: 'sales_cash', account_number: '4111' },
      // China Town - Credit Sales
      { branch_name: 'china_town', account_type: 'sales_credit', account_number: '4112' },
      // Place India - Cash Sales
      { branch_name: 'place_india', account_type: 'sales_cash', account_number: '4121' },
      // Place India - Credit Sales
      { branch_name: 'place_india', account_type: 'sales_credit', account_number: '4122' },
      // Payment accounts (shared across branches)
      { branch_name: 'china_town', account_type: 'payment_cash', account_number: '1111' },
      { branch_name: 'china_town', account_type: 'payment_bank', account_number: '1121' },
      { branch_name: 'place_india', account_type: 'payment_cash', account_number: '1111' },
      { branch_name: 'place_india', account_type: 'payment_bank', account_number: '1121' },
    ];
    
    for (const acc of defaultAccounts) {
      // الحصول على account_id من رقم الحساب
      const { rows: accountRows } = await client.query(
        'SELECT id FROM accounts WHERE account_number = $1 LIMIT 1',
        [acc.account_number]
      );
      const accountId = accountRows && accountRows[0] ? accountRows[0].id : null;
      
      // إدراج أو تحديث السجل
      await client.query(`
        INSERT INTO branch_accounts (branch_name, account_type, account_number, account_id, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (branch_name, account_type)
        DO UPDATE SET account_number = $3, account_id = $4, updated_at = NOW()
      `, [acc.branch_name, acc.account_type, acc.account_number, accountId]);
      
      console.log(`✅ Default account added: ${acc.branch_name} - ${acc.account_type} = ${acc.account_number}`);
    }
    
    console.log('\n✅ Branch accounts migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Table branch_accounts created');
    console.log('  - Default accounts configured for china_town and place_india');
    console.log('\n💡 Next steps:');
    console.log('  1. Verify accounts exist in accounts table');
    console.log('  2. Update branch_accounts.account_id if needed');
    console.log('  3. Test invoice creation to ensure accounts are loaded correctly');
    
  } catch (e) {
    console.error('❌ Error creating branch_accounts table:', e);
    throw e;
  } finally {
    await client.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
