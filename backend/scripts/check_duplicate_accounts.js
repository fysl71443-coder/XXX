import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDuplicates() {
  try {
    console.log('🔍 البحث عن حسابات مكررة...\n');
    
    // البحث عن حساب بنك الراجحي تحديداً
    const { rows: rajhiAccounts } = await pool.query(`
      SELECT id, account_number, account_code, name, name_en, type, parent_id, created_at
      FROM accounts
      WHERE name LIKE '%الراجحي%' OR name_en LIKE '%Rajhi%' OR account_number = '1121'
      ORDER BY id
    `);
    
    console.log(`📊 عدد حسابات بنك الراجحي الموجودة: ${rajhiAccounts.length}\n`);
    
    if (rajhiAccounts.length > 0) {
      console.log('📋 تفاصيل الحسابات:');
      console.log('─'.repeat(100));
      rajhiAccounts.forEach((acc, idx) => {
        console.log(`\n${idx + 1}. ID: ${acc.id}`);
        console.log(`   رقم الحساب: ${acc.account_number || 'N/A'}`);
        console.log(`   كود الحساب: ${acc.account_code || 'N/A'}`);
        console.log(`   الاسم: ${acc.name}`);
        console.log(`   الاسم بالإنجليزية: ${acc.name_en || 'N/A'}`);
        console.log(`   النوع: ${acc.type}`);
        console.log(`   الحساب الأب: ${acc.parent_id || 'N/A'}`);
        console.log(`   تاريخ الإنشاء: ${acc.created_at}`);
      });
      console.log('\n' + '─'.repeat(100));
    }
    
    // البحث عن جميع التكرارات بناءً على رقم الحساب
    const { rows: duplicatesByNumber } = await pool.query(`
      SELECT account_number, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM accounts
      WHERE account_number IS NOT NULL AND account_number != ''
      GROUP BY account_number
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (duplicatesByNumber.length > 0) {
      console.log(`\n⚠️  حسابات مكررة بناءً على رقم الحساب (account_number):`);
      console.log('─'.repeat(100));
      duplicatesByNumber.forEach(dup => {
        console.log(`\nرقم الحساب: ${dup.account_number} (موجود ${dup.count} مرة)`);
        console.log(`  IDs: ${dup.ids.join(', ')}`);
      });
    } else {
      console.log('\n✅ لا توجد حسابات مكررة بناءً على رقم الحساب');
    }
    
    // البحث عن تكرارات بناءً على الاسم
    const { rows: duplicatesByName } = await pool.query(`
      SELECT name, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM accounts
      WHERE name IS NOT NULL AND name != ''
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `);
    
    if (duplicatesByName.length > 0) {
      console.log(`\n⚠️  حسابات مكررة بناءً على الاسم (name):`);
      console.log('─'.repeat(100));
      duplicatesByName.forEach(dup => {
        console.log(`\nالاسم: ${dup.name} (موجود ${dup.count} مرة)`);
        console.log(`  IDs: ${dup.ids.join(', ')}`);
      });
    } else {
      console.log('\n✅ لا توجد حسابات مكررة بناءً على الاسم');
    }
    
    // التحقق من استخدام الحسابات في journal_postings
    if (rajhiAccounts.length > 1) {
      console.log(`\n📊 استخدام الحسابات في القيود المحاسبية:`);
      console.log('─'.repeat(100));
      for (const acc of rajhiAccounts) {
        const { rows: postings } = await pool.query(`
          SELECT COUNT(*) as count, SUM(debit) as total_debit, SUM(credit) as total_credit
          FROM journal_postings
          WHERE account_id = $1
        `, [acc.id]);
        
        const p = postings[0];
        console.log(`\nالحساب ID ${acc.id} (${acc.name}):`);
        console.log(`  عدد القيود: ${p.count}`);
        console.log(`  إجمالي المدين: ${p.total_debit || 0}`);
        console.log(`  إجمالي الدائن: ${p.total_credit || 0}`);
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error('❌ خطأ:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

checkDuplicates();
