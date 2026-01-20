const { Client } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

async function fix() {
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check accounts that have NULL or empty account_code
    const { rows: nullCodes } = await client.query(
      `SELECT id, account_number, account_code, name 
       FROM accounts 
       WHERE account_code IS NULL OR account_code = '' 
       AND account_number IN ('1111', '1121', '4111', '4112', '4121', '4122', '2141')`
    );
    
    if (nullCodes && nullCodes.length > 0) {
      console.log(`⚠️  Found ${nullCodes.length} accounts with NULL/empty account_code:`);
      nullCodes.forEach(acc => {
        console.log(`   ${acc.account_number} - ${acc.name}`);
      });
      
      // Fix them
      console.log('\n🔧 Fixing account_code...');
      for (const acc of nullCodes) {
        await client.query(
          'UPDATE accounts SET account_code = $1 WHERE id = $2',
          [acc.account_number, acc.id]
        );
        console.log(`   ✅ Fixed: ${acc.account_number}`);
      }
    } else {
      console.log('✅ All required accounts have account_code set');
    }
    
    // Verify all required accounts
    console.log('\n🔍 Verifying required accounts:');
    const { rows: allAccounts } = await client.query(
      `SELECT account_number, account_code, id, name 
       FROM accounts 
       WHERE account_number IN ('1111', '1121', '4111', '4112', '4121', '4122', '2141')
       ORDER BY account_number`
    );
    
    for (const acc of allAccounts) {
      const hasCode = acc.account_code && acc.account_code.trim() !== '';
      const status = hasCode ? '✅' : '❌';
      console.log(`${status} ${acc.account_number} - Code: ${acc.account_code || 'NULL'} - ID: ${acc.id} - ${acc.name}`);
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

fix();
