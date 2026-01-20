#!/usr/bin/env node
/**
 * تنظيف قاعدة البيانات بالكامل وإعادة تعيين الترقيمات
 * يبدأ كل الترقيم من البداية
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanDatabase() {
  const client = await dbPool.connect();
  try {
    console.log('🧹 بدء تنظيف قاعدة البيانات...');
    console.log('============================================================\n');
    
    // استخدام transaction منفصلة لكل عملية حذف لتجنب مشاكل transaction aborted
    console.log('🗑️ حذف البيانات...\n');
    
    // حذف journal_postings أولاً (لأنها مرتبطة بـ journal_entries)
    try {
      await client.query('BEGIN');
      console.log('   حذف journal_postings...');
      await client.query('DELETE FROM journal_postings');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف journal_postings\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ journal_postings: ${e.message}\n`);
    }
    
    // حذف journal_entries
    try {
      await client.query('BEGIN');
      console.log('   حذف journal_entries...');
      await client.query('DELETE FROM journal_entries');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف journal_entries\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ journal_entries: ${e.message}\n`);
    }
    
    // حذف invoices
    try {
      await client.query('BEGIN');
      console.log('   حذف invoices...');
      await client.query('DELETE FROM invoices');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف invoices\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ invoices: ${e.message}\n`);
    }
    
    // حذف expenses
    try {
      await client.query('BEGIN');
      console.log('   حذف expenses...');
      await client.query('DELETE FROM expenses');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف expenses\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ expenses: ${e.message}\n`);
    }
    
    // حذف orders
    try {
      await client.query('BEGIN');
      console.log('   حذف orders...');
      await client.query('DELETE FROM orders');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف orders\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ orders: ${e.message}\n`);
    }
    
    // حذف purchase_orders (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM purchase_orders');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف purchase_orders\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist - that's OK
    }
    
    // حذف supplier_invoices (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM supplier_invoices');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف supplier_invoices\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist
    }
    
    // حذف payroll_runs (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payroll_runs');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف payroll_runs\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist
    }
    
    // حذف payroll_payments (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payroll_payments');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف payroll_payments\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist
    }
    
    // حذف audit_log (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM audit_log');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف audit_log\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist
    }
    
    // حذف user_permissions (لكن نحتفظ بالمستخدمين)
    try {
      await client.query('BEGIN');
      console.log('   حذف user_permissions...');
      await client.query('DELETE FROM user_permissions');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف user_permissions\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ user_permissions: ${e.message}\n`);
    }
    
    // حذف partners (clients/suppliers) - لكن نحتفظ بالحسابات المرتبطة
    try {
      await client.query('BEGIN');
      console.log('   حذف partners...');
      await client.query('DELETE FROM partners');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف partners\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ partners: ${e.message}\n`);
    }
    
    // حذف employees (لكن نحتفظ بالحسابات المرتبطة)
    try {
      await client.query('BEGIN');
      console.log('   حذف employees...');
      await client.query('DELETE FROM employees');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف employees\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ employees: ${e.message}\n`);
    }
    
    // حذف products
    try {
      await client.query('BEGIN');
      console.log('   حذف products...');
      await client.query('DELETE FROM products');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف products\n');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log(`   ⚠️ products: ${e.message}\n`);
    }
    
    // حذف inventory_transactions (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM inventory_transactions');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف inventory_transactions\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist
    }
    
    // حذف stock_movements (إن وجدت)
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM stock_movements');
      await client.query('COMMIT');
      console.log('   ✅ تم حذف stock_movements\n');
    } catch (e) {
      await client.query('ROLLBACK');
      // Table might not exist
    }
    
    // ملاحظة: نحتفظ بـ users و accounts لأنها بيانات أساسية
    
    // بدء transaction جديدة لإعادة تعيين الترقيمات
    await client.query('BEGIN');
    
    // 2. إعادة تعيين جميع SEQUENCEs و auto-increment IDs
    console.log('🔄 إعادة تعيين الترقيمات...\n');
    
    // إعادة تعيين journal_entries_entry_number_seq (إن وجد)
    try {
      await client.query('ALTER SEQUENCE IF EXISTS journal_entries_entry_number_seq RESTART WITH 1');
      console.log('   ✅ تم إعادة تعيين journal_entries_entry_number_seq إلى 1');
    } catch (e) {
      // Sequence might not exist - that's OK, we use manual numbering
      console.log(`   ℹ️ journal_entries_entry_number_seq: لا يوجد (يتم الترقيم يدوياً)`);
    }
    
    // إعادة تعيين أي sequences أخرى (غير id sequences)
    try {
      const { rows: sequences } = await client.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
        AND sequence_name NOT LIKE '%_id_seq'
      `);
      
      for (const seq of sequences) {
        try {
          await client.query(`ALTER SEQUENCE ${seq.sequence_name} RESTART WITH 1`);
          console.log(`   ✅ تم إعادة تعيين ${seq.sequence_name} إلى 1`);
        } catch (e) {
          console.log(`   ⚠️ ${seq.sequence_name}: ${e.message}`);
        }
      }
      if (sequences.length > 0) {
        console.log('');
      }
    } catch (e) {
      console.log(`   ⚠️ خطأ في فحص sequences: ${e.message}\n`);
    }
    
    // 3. إعادة تعيين auto-increment IDs (إذا كانت تستخدم SERIAL)
    console.log('🔄 إعادة تعيين auto-increment IDs...\n');
    
    const tables = [
      'journal_entries',
      'journal_postings',
      'invoices',
      'expenses',
      'orders',
      'products',
      'partners',
      'employees'
    ];
    
    for (const table of tables) {
      try {
        // إعادة تعيين sequence للـ id
        const { rows: seqRows } = await client.query(
          `SELECT pg_get_serial_sequence('${table}', 'id') as seq_name`
        );
        if (seqRows && seqRows[0] && seqRows[0].seq_name) {
          await client.query(`SELECT setval('${seqRows[0].seq_name}', 1, false)`);
          console.log(`   ✅ تم إعادة تعيين ${table}.id إلى 1`);
        } else {
          // Try direct sequence name
          try {
            await client.query(`SELECT setval('${table}_id_seq', 1, false)`);
            console.log(`   ✅ تم إعادة تعيين ${table}.id إلى 1`);
          } catch (e2) {
            console.log(`   ℹ️ ${table}.id: لا يوجد sequence`);
          }
        }
      } catch (e) {
        // Table might not have serial id or doesn't exist - that's OK
        console.log(`   ℹ️ ${table}.id: ${e.message.includes('does not exist') ? 'لا يوجد sequence' : e.message}`);
      }
    }
    console.log('');
    
    // 4. ملاحظة مهمة: entry_number و invoice number يتم ترقيمها يدوياً
    console.log('ℹ️ ملاحظة:');
    console.log('   - entry_number يتم ترقيمه يدوياً (سيبدأ من 1 تلقائياً)');
    console.log('   - invoice number يتم ترقيمه يدوياً (سيبدأ من 1 تلقائياً)');
    console.log('   - سيتم إعادة استخدام الأرقام المحذوفة تلقائياً\n');
    
    await client.query('COMMIT');
    
    console.log('============================================================');
    console.log('✅ تم تنظيف قاعدة البيانات بنجاح');
    console.log('============================================================\n');
    
    console.log('📋 ملخص:');
    console.log('   ✅ تم حذف جميع البيانات');
    console.log('   ✅ تم إعادة تعيين جميع الترقيمات');
    console.log('   ✅ تم الاحتفاظ بـ users و accounts');
    console.log('   ✅ النظام جاهز للبدء من جديد');
    console.log('   ✅ سيتم إعادة استخدام الأرقام المحذوفة تلقائياً\n');
    
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    console.error('❌ خطأ في تنظيف قاعدة البيانات:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

async function verifyCleanup() {
  try {
    console.log('🔍 التحقق من التنظيف...\n');
    
    const checks = [
      { table: 'journal_entries', name: 'القيود' },
      { table: 'journal_postings', name: 'القيود الفرعية' },
      { table: 'invoices', name: 'الفواتير' },
      { table: 'expenses', name: 'المصروفات' },
      { table: 'orders', name: 'الطلبات' },
      { table: 'products', name: 'المنتجات' },
      { table: 'partners', name: 'الشركاء' },
      { table: 'employees', name: 'الموظفين' }
    ];
    
    for (const check of checks) {
      try {
        const { rows } = await dbPool.query(`SELECT COUNT(*) as count FROM ${check.table}`);
        const count = Number(rows[0].count || 0);
        if (count === 0) {
          console.log(`   ✅ ${check.name}: 0 سجل`);
        } else {
          console.log(`   ⚠️ ${check.name}: ${count} سجل متبقي`);
        }
      } catch (e) {
        console.log(`   ⚠️ ${check.name}: لا يمكن التحقق (${e.message})`);
      }
    }
    
    console.log('');
    
    // التحقق من sequences
    try {
      const { rows: seqRows } = await dbPool.query(`
        SELECT last_value 
        FROM journal_entries_entry_number_seq
      `);
      if (seqRows && seqRows[0]) {
        const lastValue = Number(seqRows[0].last_value || 0);
        console.log(`   📊 journal_entries_entry_number_seq: ${lastValue}`);
      }
    } catch (e) {
      // Sequence might not exist - that's OK, we use manual numbering
      console.log(`   ℹ️ journal_entries_entry_number_seq: لا يوجد (يتم الترقيم يدوياً)`);
    }
    
    // التحقق من أن الترقيم سيعمل بشكل صحيح
    console.log('\n✅ التحقق من منطق الترقيم:');
    try {
      const { rows: entryCheck } = await dbPool.query(`
        SELECT COUNT(*) as count FROM journal_entries
      `);
      const count = Number(entryCheck[0]?.count || 0);
      if (count === 0) {
        console.log('   ✅ لا توجد قيود - القيد التالي سيكون رقم 1');
      } else {
        console.log(`   ✅ يوجد ${count} قيد - القيد التالي سيستخدم أول رقم محذوف أو ${count + 1}`);
      }
    } catch (e) {
      console.log(`   ⚠️ لا يمكن التحقق: ${e.message}`);
    }
    
    console.log('');
    
  } catch (e) {
    console.error('❌ خطأ في التحقق:', e);
  }
}

async function main() {
  try {
    await cleanDatabase();
    await verifyCleanup();
  } catch (e) {
    console.error('❌ خطأ عام:', e);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

main().catch(console.error);
