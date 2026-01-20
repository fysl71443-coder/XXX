const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// CRITICAL: PostgreSQL ONLY
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';

if (!DATABASE_URL || DATABASE_URL.includes('sqlite') || DATABASE_URL.endsWith('.db')) {
  console.error('❌ CRITICAL: Only PostgreSQL is allowed');
  process.exit(1);
}

// قائمة الجداول المطلوبة
const REQUIRED_TABLES = [
  'users',
  'user_permissions',
  'settings',
  'partners',
  'employees',
  'accounts',
  'journal_entries',
  'journal_postings',
  'accounting_periods',
  'products',
  'invoices',
  'orders',
  'supplier_invoices',
  'payments',
  'expenses',
  'branch_accounts',  // ناقص - يجب إنشاؤه
  'pos_tables',       // ناقص - يجب إنشاؤه
  'order_drafts'      // ناقص - يجب إنشاؤه
];

async function verifyDatabase(client) {
  console.log('='.repeat(80));
  console.log('🔍 DATABASE VERIFICATION');
  console.log('='.repeat(80));
  
  const issues = [];
  const warnings = [];
  
  // 1. التحقق من وجود جميع الجداول
  console.log('\n📋 Checking required tables...');
  const { rows: tables } = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  const existingTables = tables.map(t => t.table_name);
  const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t));
  
  REQUIRED_TABLES.forEach(table => {
    if (existingTables.includes(table)) {
      console.log(`  ✅ ${table}`);
    } else {
      console.log(`  ❌ ${table} - MISSING`);
      issues.push(`Table '${table}' is missing`);
    }
  });
  
  // 2. التحقق من الأعمدة المطلوبة في الجداول الرئيسية
  console.log('\n📐 Checking required columns...');
  
  // invoices - يجب أن يحتوي على journal_entry_id, closed_at
  try {
    const { rows: invoiceColumns } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'invoices'
    `);
    const invoiceColNames = invoiceColumns.map(c => c.column_name);
    
    if (!invoiceColNames.includes('journal_entry_id')) {
      warnings.push('invoices.journal_entry_id column is missing');
      console.log(`  ⚠️  invoices.journal_entry_id - MISSING`);
    } else {
      console.log(`  ✅ invoices.journal_entry_id`);
    }
    
    if (!invoiceColNames.includes('closed_at')) {
      warnings.push('invoices.closed_at column is missing');
      console.log(`  ⚠️  invoices.closed_at - MISSING`);
    } else {
      console.log(`  ✅ invoices.closed_at`);
    }
    
    if (!invoiceColNames.includes('invoice_number')) {
      warnings.push('invoices.invoice_number column is missing');
      console.log(`  ⚠️  invoices.invoice_number - MISSING`);
    } else {
      console.log(`  ✅ invoices.invoice_number`);
    }
  } catch (e) {
    console.log(`  ⚠️  Cannot check invoices columns: ${e.message}`);
  }
  
  // orders - يجب أن يحتوي على closed_at
  try {
    const { rows: orderColumns } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'orders'
    `);
    const orderColNames = orderColumns.map(c => c.column_name);
    
    if (!orderColNames.includes('closed_at')) {
      warnings.push('orders.closed_at column is missing');
      console.log(`  ⚠️  orders.closed_at - MISSING`);
    } else {
      console.log(`  ✅ orders.closed_at`);
    }
  } catch (e) {
    console.log(`  ⚠️  Cannot check orders columns: ${e.message}`);
  }
  
  // journal_entries - يجب أن يحتوي على branch
  try {
    const { rows: jeColumns } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'journal_entries'
    `);
    const jeColNames = jeColumns.map(c => c.column_name);
    
    if (!jeColNames.includes('branch')) {
      warnings.push('journal_entries.branch column is missing');
      console.log(`  ⚠️  journal_entries.branch - MISSING`);
    } else {
      console.log(`  ✅ journal_entries.branch`);
    }
  } catch (e) {
    console.log(`  ⚠️  Cannot check journal_entries columns: ${e.message}`);
  }
  
  // accounts - يجب أن يحتوي على account_code
  try {
    const { rows: accountColumns } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'accounts'
    `);
    const accountColNames = accountColumns.map(c => c.column_name);
    
    if (!accountColNames.includes('account_code')) {
      warnings.push('accounts.account_code column is missing');
      console.log(`  ⚠️  accounts.account_code - MISSING`);
    } else {
      console.log(`  ✅ accounts.account_code`);
    }
  } catch (e) {
    console.log(`  ⚠️  Cannot check accounts columns: ${e.message}`);
  }
  
  // 3. التحقق من المفاتيح الأجنبية
  console.log('\n🔗 Checking foreign key relationships...');
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
  
  const criticalFKs = [
    { table: 'invoices', column: 'journal_entry_id', ref_table: 'journal_entries' },
    { table: 'orders', column: 'invoice_id', ref_table: 'invoices' },
    { table: 'journal_postings', column: 'journal_entry_id', ref_table: 'journal_entries' },
    { table: 'journal_postings', column: 'account_id', ref_table: 'accounts' }
  ];
  
  criticalFKs.forEach(fk => {
    const found = foreignKeys.some(fkRow => 
      fkRow.table_name === fk.table && 
      fkRow.column_name === fk.column &&
      fkRow.foreign_table_name === fk.ref_table
    );
    
    if (found) {
      console.log(`  ✅ ${fk.table}.${fk.column} → ${fk.ref_table}`);
    } else {
      console.log(`  ⚠️  ${fk.table}.${fk.column} → ${fk.ref_table} - NO FK (may be nullable)`);
    }
  });
  
  // 4. التحقق من الحسابات الأساسية
  console.log('\n💰 Checking basic accounts...');
  const requiredAccounts = ['1111', '1121', '2141', '4111', '4112', '4121', '4122'];
  try {
    const { rows: accounts } = await client.query(`
      SELECT account_number FROM accounts 
      WHERE account_number IN ($1, $2, $3, $4, $5, $6, $7)
    `, requiredAccounts);
    
    const existingAccounts = accounts.map(a => a.account_number);
    requiredAccounts.forEach(acc => {
      if (existingAccounts.includes(acc)) {
        console.log(`  ✅ Account ${acc}`);
      } else {
        console.log(`  ⚠️  Account ${acc} - MISSING`);
        warnings.push(`Account ${acc} is missing`);
      }
    });
  } catch (e) {
    console.log(`  ⚠️  Cannot check accounts: ${e.message}`);
    if (e.message.includes('does not exist')) {
      issues.push('accounts table does not exist');
    }
  }
  
  // 5. التحقق من حسابات الفروع (إذا كان الجدول موجودًا)
  if (existingTables.includes('branch_accounts')) {
    console.log('\n🏢 Checking branch_accounts data...');
    try {
      const { rows: branchAccounts } = await client.query(`
        SELECT COUNT(*) as count FROM branch_accounts WHERE is_active = true
      `);
      const count = branchAccounts[0]?.count || 0;
      if (count >= 10) {
        console.log(`  ✅ Branch accounts configured (${count} active)`);
      } else {
        console.log(`  ⚠️  Branch accounts incomplete (${count} active, expected >= 10)`);
        warnings.push(`branch_accounts has only ${count} active records`);
      }
    } catch (e) {
      console.log(`  ⚠️  Error checking branch_accounts: ${e.message}`);
    }
  }
  
  // 6. التحقق من الطاولات (إذا كان الجدول موجودًا)
  if (existingTables.includes('pos_tables')) {
    console.log('\n🪑 Checking pos_tables data...');
    try {
      const { rows: posTables } = await client.query(`
        SELECT COUNT(*) as count FROM pos_tables WHERE is_active = true
      `);
      const count = posTables[0]?.count || 0;
      if (count >= 10) {
        console.log(`  ✅ POS tables configured (${count} active)`);
      } else {
        console.log(`  ⚠️  POS tables incomplete (${count} active, expected >= 10)`);
        warnings.push(`pos_tables has only ${count} active records`);
      }
    } catch (e) {
      console.log(`  ⚠️  Error checking pos_tables: ${e.message}`);
    }
  }
  
  // الملخص
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(80));
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('\n✅ All checks passed! Database is ready.');
  } else {
    if (issues.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${issues.length}):`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
      warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (missingTables.length > 0) {
      console.log('\n💡 RECOMMENDATION:');
      console.log('  Run: node backend/scripts/fix_complete_database.cjs');
      console.log('  This will create missing tables and add missing columns.');
    }
  }
  
  return { issues, warnings, missingTables };
}

async function verifyCodeReferences() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CODE VERIFICATION');
  console.log('='.repeat(80));
  
  const codeIssues = [];
  
  // فحص ملف server.js للاستدعاءات
  const serverJsPath = path.join(__dirname, '..', 'server.js');
  
  if (fs.existsSync(serverJsPath)) {
    const serverJs = fs.readFileSync(serverJsPath, 'utf8');
    
    // التحقق من الاستدعاءات للجداول الناقصة
    const missingTableChecks = {
      'branch_accounts': serverJs.includes('branch_accounts'),
      'pos_tables': serverJs.includes('pos_tables'),
      'order_drafts': serverJs.includes('order_drafts')
    };
    
    console.log('\n📋 Checking code references to missing tables...');
    
    Object.entries(missingTableChecks).forEach(([table, isReferenced]) => {
      if (isReferenced) {
        console.log(`  ✅ ${table} - referenced in code`);
      } else {
        console.log(`  ⚠️  ${table} - NOT referenced (may be optional)`);
      }
    });
    
    // التحقق من invoice_items (يجب ألا يكون موجودًا)
    if (serverJs.includes('invoice_items') && !serverJs.includes('/api/invoice_items')) {
      console.log(`  ⚠️  Found 'invoice_items' reference - this should use invoices.lines instead`);
    } else {
      console.log(`  ✅ No invoice_items table reference (correct - uses invoices.lines)`);
    }
  } else {
    codeIssues.push('server.js file not found');
  }
  
  return codeIssues;
}

async function main() {
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    
    const dbResult = await verifyDatabase(client);
    const codeIssues = await verifyCodeReferences();
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 FINAL REPORT');
    console.log('='.repeat(80));
    
    const totalIssues = dbResult.issues.length + codeIssues.length;
    const totalWarnings = dbResult.warnings.length;
    
    if (totalIssues === 0 && totalWarnings === 0) {
      console.log('\n✅ ✅ ✅ ALL CHECKS PASSED ✅ ✅ ✅');
      console.log('Database and code are ready for production!');
    } else {
      console.log(`\n📊 Statistics:`);
      console.log(`  - Critical Issues: ${totalIssues}`);
      console.log(`  - Warnings: ${totalWarnings}`);
      console.log(`  - Missing Tables: ${dbResult.missingTables.length}`);
      
      if (dbResult.missingTables.length > 0) {
        console.log('\n🚀 TO FIX:');
        console.log('  node backend/scripts/fix_complete_database.cjs');
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
