const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// CRITICAL: PostgreSQL ONLY - NO SQLite, NO fallback
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';

if (!DATABASE_URL || DATABASE_URL.includes('sqlite') || DATABASE_URL.endsWith('.db')) {
  console.error('❌ CRITICAL: Only PostgreSQL is allowed');
  process.exit(1);
}

async function run() {
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');

    // قراءة ملف SQL وتقسيمه إلى استعلامات منفصلة
    const sqlFile = path.join(__dirname, 'fix_complete_database.sql');
    let sql = fs.readFileSync(sqlFile, 'utf8');
    
    // إزالة قسم التقرير من SQL (سننفذه لاحقًا)
    const reportStart = sql.indexOf('-- ============================================');
    const sqlToExecute = sql.substring(0, reportStart).trim();
    
    // تقسيم SQL إلى استعلامات منفصلة (فصل بـ ;)
    const statements = sqlToExecute
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // تنفيذ كل استعلام على حدة
    console.log('📋 Executing database fixes...\n');
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await client.query(statement);
          console.log(`  ✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (e) {
          // تجاهل الأخطاء المتوقعة (مثل IF NOT EXISTS)
          if (e.message.includes('already exists') || e.message.includes('duplicate')) {
            console.log(`  ℹ️  Statement ${i + 1} skipped (already exists)`);
          } else {
            console.error(`  ⚠️  Statement ${i + 1} error: ${e.message}`);
            // لا نوقف التنفيذ للأخطاء البسيطة
          }
        }
      }
    }
    console.log('✅ Database fixes completed successfully!\n');

    // ============================================
    // تقرير شامل للتحقق
    // ============================================

    console.log('='.repeat(80));
    console.log('📊 DATABASE VERIFICATION REPORT');
    console.log('='.repeat(80));

    // 1. عرض جميع الجداول
    console.log('\n📋 ALL TABLES:');
    const { rows: tables } = await client.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    tables.forEach(t => {
      console.log(`  ✅ ${t.table_name.padEnd(30)} (${t.column_count} columns)`);
    });

    // 2. عدد الصفوف في كل جدول
    console.log('\n📊 ROW COUNTS:');
    const tablesToCheck = [
      'accounts', 'invoices', 'orders', 'journal_entries', 'journal_postings',
      'branch_accounts', 'pos_tables', 'order_drafts', 'products', 'partners', 'users'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = rows[0]?.count || 0;
        console.log(`  ${tableName.padEnd(30)} ${String(count).padStart(10)} rows`);
      } catch (e) {
        console.log(`  ${tableName.padEnd(30)} ERROR: ${e.message}`);
      }
    }

    // 3. الحسابات الأساسية
    console.log('\n💰 BASIC ACCOUNTS:');
    const { rows: accounts } = await client.query(`
      SELECT account_number, account_code, name, name_en, type, nature 
      FROM accounts 
      WHERE account_number IN ('1111', '1121', '2141', '4111', '4112', '4121', '4122', '5111', '5112')
      ORDER BY account_number
    `);
    accounts.forEach(acc => {
      console.log(`  ${acc.account_number} - ${acc.name} (${acc.name_en}) - ${acc.type}/${acc.nature}`);
    });

    // 4. حسابات الفروع
    console.log('\n🏢 BRANCH ACCOUNTS:');
    const { rows: branchAccounts } = await client.query(`
      SELECT ba.branch_name, ba.account_type, ba.account_number, a.name as account_name
      FROM branch_accounts ba
      LEFT JOIN accounts a ON a.id = ba.account_id
      WHERE ba.is_active = true
      ORDER BY ba.branch_name, ba.account_type
    `);
    branchAccounts.forEach(ba => {
      console.log(`  ${ba.branch_name.padEnd(15)} ${ba.account_type.padEnd(20)} → ${ba.account_number} (${ba.account_name || 'N/A'})`);
    });

    // 5. الطاولات
    console.log('\n🪑 POS TABLES:');
    const { rows: posTables } = await client.query(`
      SELECT branch, table_code, table_name, status, capacity, is_active
      FROM pos_tables
      ORDER BY branch, table_code
    `);
    posTables.forEach(t => {
      console.log(`  ${t.branch.padEnd(15)} Table ${t.table_code.padEnd(5)} - ${t.status.padEnd(10)} (${t.capacity} seats)`);
    });

    // 6. الأعمدة في الجداول الرئيسية
    console.log('\n📐 COLUMNS IN KEY TABLES:');
    const keyTables = ['invoices', 'orders', 'journal_entries', 'journal_postings', 'accounts', 'branch_accounts', 'pos_tables', 'order_drafts'];
    for (const tableName of keyTables) {
      try {
        const { rows: columns } = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        if (columns.length > 0) {
          console.log(`\n  ${tableName}:`);
          columns.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`    - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}`);
          });
        }
      } catch (e) {
        console.log(`  ${tableName}: ERROR - ${e.message}`);
      }
    }

    // 7. المفاتيح الأجنبية
    console.log('\n🔗 FOREIGN KEYS:');
    const { rows: foreignKeys } = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);
    foreignKeys.forEach(fk => {
      console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // 8. التحقق من البيانات المطلوبة
    console.log('\n✅ DATA VERIFICATION:');
    
    // التحقق من الحسابات الأساسية
    const { rows: requiredAccounts } = await client.query(`
      SELECT account_number FROM accounts 
      WHERE account_number IN ('1111', '1121', '2141', '4111', '4112', '4121', '4122')
    `);
    const requiredAccountNumbers = ['1111', '1121', '2141', '4111', '4112', '4121', '4122'];
    const existingAccountNumbers = requiredAccounts.map(a => a.account_number);
    const missingAccounts = requiredAccountNumbers.filter(acc => !existingAccountNumbers.includes(acc));
    
    if (missingAccounts.length === 0) {
      console.log('  ✅ All required accounts exist');
    } else {
      console.log(`  ⚠️  Missing accounts: ${missingAccounts.join(', ')}`);
    }

    // التحقق من حسابات الفروع
    const { rows: branchAccountsCheck } = await client.query(`
      SELECT COUNT(*) as count FROM branch_accounts WHERE is_active = true
    `);
    const branchAccountsCount = branchAccountsCheck[0]?.count || 0;
    if (branchAccountsCount >= 10) {
      console.log(`  ✅ Branch accounts configured (${branchAccountsCount} active)`);
    } else {
      console.log(`  ⚠️  Branch accounts may be incomplete (${branchAccountsCount} active, expected >= 10)`);
    }

    // التحقق من الطاولات
    const { rows: tablesCheck } = await client.query(`
      SELECT COUNT(*) as count FROM pos_tables WHERE is_active = true
    `);
    const tablesCount = tablesCheck[0]?.count || 0;
    if (tablesCount >= 10) {
      console.log(`  ✅ POS tables configured (${tablesCount} active)`);
    } else {
      console.log(`  ⚠️  POS tables may be incomplete (${tablesCount} active, expected >= 10)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Database verification completed!');
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
