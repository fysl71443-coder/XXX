const { Client } = require('pg');
require('dotenv').config();

async function test() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const accountNumbers = ['1111', '1121', '4111', '4112', '4121', '4122', '2141'];
    
    console.log('🔍 Testing account lookup...\n');
    
    for (const accountNumber of accountNumbers) {
      const { rows } = await client.query(
        'SELECT id, account_number, account_code, name FROM accounts WHERE account_number = $1 OR account_code = $1 LIMIT 1',
        [accountNumber]
      );
      
      if (rows && rows.length > 0) {
        console.log(`✅ ${accountNumber}: Found - ID: ${rows[0].id}, Number: ${rows[0].account_number}, Code: ${rows[0].account_code}, Name: ${rows[0].name}`);
      } else {
        console.log(`❌ ${accountNumber}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

test();
