const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// CRITICAL: PostgreSQL ONLY
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';

if (!DATABASE_URL || DATABASE_URL.includes('sqlite') || DATABASE_URL.endsWith('.db')) {
  console.error('❌ CRITICAL: Only PostgreSQL is allowed');
  process.exit(1);
}

async function executeSQLFile(client, sqlFile) {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // فصل SQL إلى استعلامات - نبحث عن COMMIT لنهاية المعاملة
  const commitIndex = sql.indexOf('COMMIT;');
  if (commitIndex === -1) {
    throw new Error('SQL file must contain COMMIT;');
  }
  
  // تنفيذ SQL حتى COMMIT (داخل معاملة واحدة)
  const sqlToExecute = sql.substring(0, commitIndex + 7);
  
  console.log('📋 Executing SQL file...\n');
  
  try {
    await client.query(sqlToExecute);
    console.log('✅ SQL executed successfully!\n');
    return true;
  } catch (e) {
    console.error('❌ Error executing SQL:', e.message);
    throw e;
  }
}

async function run() {
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');

    // قراءة وتنفيذ SQL
    const sqlFile = path.join(__dirname, 'fix_complete_database.sql');
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL file not found: ${sqlFile}`);
    }

    await executeSQLFile(client, sqlFile);

    // تقرير التحقق
    console.log('='.repeat(80));
    console.log('📊 VERIFICATION REPORT');
    console.log('='.repeat(80));

    // 1. الجداول
    console.log('\n📋 TABLES:');
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    tables.forEach(t => console.log(`  ✅ ${t.table_name}`));

    // 2. عدد الصفوف
    console.log('\n📊 ROW COUNTS:');
    const tablesToCheck = ['accounts', 'invoices', 'orders', 'journal_entries', 'journal_postings', 'branch_accounts', 'pos_tables', 'order_drafts'];
    for (const tableName of tablesToCheck) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`  ${tableName.padEnd(25)} ${String(rows[0]?.count || 0).padStart(5)} rows`);
      } catch (e) {
        console.log(`  ${tableName.padEnd(25)} ERROR: ${e.message}`);
      }
    }

    // 3. الحسابات الأساسية
    console.log('\n💰 BASIC ACCOUNTS:');
    try {
      const { rows: accounts } = await client.query(`
        SELECT account_number, name, type FROM accounts 
        WHERE account_number IN ('1111', '1121', '2141', '4111', '4112', '4121', '4122')
        ORDER BY account_number
      `);
      accounts.forEach(acc => {
        console.log(`  ${acc.account_number} - ${acc.name} (${acc.type})`);
      });
    } catch (e) {
      console.log(`  ⚠️  Error: ${e.message}`);
    }

    // 4. حسابات الفروع
    console.log('\n🏢 BRANCH ACCOUNTS:');
    try {
      const { rows: branchAccounts } = await client.query(`
        SELECT branch_name, account_type, account_number FROM branch_accounts 
        WHERE is_active = true ORDER BY branch_name, account_type
      `);
      branchAccounts.forEach(ba => {
        console.log(`  ${ba.branch_name.padEnd(15)} ${ba.account_type.padEnd(20)} → ${ba.account_number}`);
      });
    } catch (e) {
      console.log(`  ⚠️  Error: ${e.message}`);
    }

    // 5. الطاولات
    console.log('\n🪑 POS TABLES:');
    try {
      const { rows: posTables } = await client.query(`
        SELECT branch, table_code, status FROM pos_tables 
        WHERE is_active = true ORDER BY branch, table_code LIMIT 20
      `);
      posTables.forEach(t => {
        console.log(`  ${t.branch.padEnd(15)} Table ${t.table_code.padEnd(5)} - ${t.status}`);
      });
    } catch (e) {
      console.log(`  ⚠️  Error: ${e.message}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Database fix completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
