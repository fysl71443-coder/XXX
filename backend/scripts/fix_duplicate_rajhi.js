import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixDuplicate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🔍 التحقق من الحسابات المكررة...\n');
    
    // البحث عن حساب بنك الراجحي المكرر
    const { rows: rajhiAccounts } = await client.query(`
      SELECT id, account_number, account_code, name, name_en, type, parent_id
      FROM accounts
      WHERE name LIKE '%الراجحي%' OR name_en LIKE '%Rajhi%' OR account_number = '1121'
      ORDER BY id
    `);
    
    console.log(`📊 عدد حسابات بنك الراجحي: ${rajhiAccounts.length}\n`);
    
    if (rajhiAccounts.length < 2) {
      console.log('✅ لا توجد حسابات مكررة');
      await client.query('ROLLBACK');
      process.exit(0);
    }
    
    // البحث عن الحساب الصحيح (رقم الحساب 1121)
    const correctAccount = rajhiAccounts.find(acc => acc.account_number === '1121');
    const wrongAccounts = rajhiAccounts.filter(acc => acc.account_number !== '1121');
    
    if (!correctAccount) {
      console.log('❌ لم يتم العثور على الحساب الصحيح (1121)');
      await client.query('ROLLBACK');
      process.exit(1);
    }
    
    console.log(`✅ الحساب الصحيح: ID ${correctAccount.id} (رقم الحساب: ${correctAccount.account_number})`);
    console.log(`⚠️  الحسابات الخاطئة: ${wrongAccounts.map(a => `ID ${a.id}`).join(', ')}\n`);
    
    // التحقق من استخدام الحسابات الخاطئة
    for (const wrongAcc of wrongAccounts) {
      const { rows: postings } = await client.query(`
        SELECT COUNT(*) as count
        FROM journal_postings
        WHERE account_id = $1
      `, [wrongAcc.id]);
      
      const count = parseInt(postings[0].count);
      
      if (count > 0) {
        console.log(`⚠️  الحساب ID ${wrongAcc.id} له ${count} قيد محاسبي!`);
        console.log(`   يجب نقل القيود إلى الحساب الصحيح (ID ${correctAccount.id}) قبل الحذف.\n`);
        
        // نقل القيود إلى الحساب الصحيح
        console.log(`🔄 نقل القيود من ID ${wrongAcc.id} إلى ID ${correctAccount.id}...`);
        const { rowCount } = await client.query(`
          UPDATE journal_postings
          SET account_id = $1
          WHERE account_id = $2
        `, [correctAccount.id, wrongAcc.id]);
        
        console.log(`✅ تم نقل ${rowCount} قيد محاسبي\n`);
      }
      
      // حذف الحساب المكرر
      console.log(`🗑️  حذف الحساب المكرر ID ${wrongAcc.id}...`);
      await client.query('DELETE FROM accounts WHERE id = $1', [wrongAcc.id]);
      console.log(`✅ تم حذف الحساب ID ${wrongAcc.id}\n`);
    }
    
    await client.query('COMMIT');
    console.log('✅ تم إصلاح التكرار بنجاح!');
    
    // التحقق النهائي
    const { rows: finalCheck } = await client.query(`
      SELECT id, account_number, name
      FROM accounts
      WHERE account_number = '1121' AND name LIKE '%الراجحي%'
    `);
    
    console.log(`\n📊 التحقق النهائي:`);
    console.log(`   عدد حسابات بنك الراجحي المتبقية: ${finalCheck.length}`);
    if (finalCheck.length === 1) {
      console.log(`   ✅ الحساب الصحيح: ID ${finalCheck[0].id} - ${finalCheck[0].name} (${finalCheck[0].account_number})`);
    }
    
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ خطأ:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

fixDuplicate();
