#!/usr/bin/env node
/**
 * سكريبت تنفيذ إصلاح الربط المحاسبي
 * 
 * الاستخدام:
 *   node backend/scripts/run_accounting_fix.js
 * 
 * أو مع DATABASE_URL:
 *   DATABASE_URL=postgresql://... node backend/scripts/run_accounting_fix.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ خطأ: DATABASE_URL غير محدد');
  console.error('   استخدم: DATABASE_URL=postgresql://... node backend/scripts/run_accounting_fix.js');
  process.exit(1);
}

async function runSQLFile(client, filePath, description) {
  console.log(`\n📄 ${description}...`);
  console.log(`   الملف: ${filePath}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    console.log(`   ✅ تم التنفيذ بنجاح`);
    return true;
  } catch (error) {
    console.error(`   ❌ خطأ: ${error.message}`);
    if (error.code) {
      console.error(`   الكود: ${error.code}`);
    }
    return false;
  }
}

async function verifyResults(client) {
  console.log(`\n🔍 التحقق من النتائج...`);
  
  try {
    // التحقق من الأعمدة
    const { rows: columns } = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('expenses', 'invoices', 'journal_entries')
        AND column_name IN ('journal_entry_id', 'entry_number', 'number')
      ORDER BY table_name, column_name
    `);
    
    console.log(`\n   الأعمدة المضافة:`);
    columns.forEach(col => {
      console.log(`   - ${col.table_name}.${col.column_name} (${col.data_type})`);
    });
    
    // التحقق من Constraints
    const { rows: constraints } = await client.query(`
      SELECT 
        conname AS constraint_name,
        conrelid::regclass AS table_name
      FROM pg_constraint
      WHERE conname IN ('fk_expense_journal', 'fk_invoice_journal')
    `);
    
    console.log(`\n   Foreign Keys:`);
    constraints.forEach(con => {
      console.log(`   - ${con.constraint_name} على ${con.table_name}`);
    });
    
    // التحقق من Sequences
    const { rows: sequences } = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences
      WHERE sequence_name IN ('journal_entry_number_seq', 'invoice_number_seq')
    `);
    
    console.log(`\n   Sequences:`);
    sequences.forEach(seq => {
      console.log(`   - ${seq.sequence_name}`);
    });
    
    return true;
  } catch (error) {
    console.error(`   ❌ خطأ في التحقق: ${error.message}`);
    return false;
  }
}

async function main() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚀 بدء إصلاح الربط المحاسبي...');
    console.log(`   قاعدة البيانات: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    
    await client.connect();
    console.log('   ✅ الاتصال بقاعدة البيانات نجح');
    
    // المرحلة 2: إصلاح الربط
    const fixLinksPath = path.join(__dirname, 'fix_accounting_links.sql');
    const success = await runSQLFile(
      client, 
      fixLinksPath, 
      'المرحلة 2: إضافة مفاتيح الربط والترقيم التلقائي'
    );
    
    if (!success) {
      console.error('\n❌ فشل تنفيذ إصلاح الربط');
      process.exit(1);
    }
    
    // التحقق من النتائج
    await verifyResults(client);
    
    console.log('\n✅✅ تم إصلاح الربط المحاسبي بنجاح!');
    console.log('\n📝 الخطوات التالية:');
    console.log('   1. اختبر القيد يدوياً: psql $DATABASE_URL -f backend/scripts/test_manual_journal_entry.sql');
    console.log('   2. اختبر النظام: قم بإنشاء مصروف جديد و POST');
    console.log('   3. (اختياري) عطل الجداول القديمة: psql $DATABASE_URL -f backend/scripts/disable_old_accounting_tables.sql');
    
  } catch (error) {
    console.error('\n❌ خطأ عام:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
