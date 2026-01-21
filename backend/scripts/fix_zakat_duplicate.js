import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixZakatDuplicate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🔍 البحث عن تكرار في حساب مصلحة الزكاة...\n');
    
    const { rows: zakatAccounts } = await client.query(`
      SELECT id, account_number, account_code, name, name_en, type, parent_id
      FROM accounts
      WHERE name LIKE '%مصلحة الزكاة%' OR name_en LIKE '%Zakat%'
      ORDER BY id
    `);
    
    console.log(`📊 عدد حسابات مصلحة الزكاة: ${zakatAccounts.length}\n`);
    
    if (zakatAccounts.length < 2) {
      console.log('✅ لا توجد حسابات مكررة');
      await client.query('ROLLBACK');
      process.exit(0);
    }
    
    // التحقق من استخدام كل حساب
    const accountsWithUsage = [];
    for (const acc of zakatAccounts) {
      const { rows: postings } = await client.query(`
        SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1
      `, [acc.id]);
      
      const { rows: partners } = await client.query(`
        SELECT COUNT(*) as count FROM partners WHERE account_id = $1
      `, [acc.id]);
      
      const usage = parseInt(postings[0].count) + parseInt(partners[0].count);
      
      accountsWithUsage.push({
        ...acc,
        postingCount: parseInt(postings[0].count),
        partnerCount: parseInt(partners[0].count),
        totalUsage: usage
      });
      
      console.log(`   ID ${acc.id} (${acc.account_number || 'N/A'}):`);
      console.log(`     قيود محاسبية: ${parseInt(postings[0].count)}`);
      console.log(`     شركاء: ${parseInt(partners[0].count)}`);
      console.log(`     إجمالي الاستخدام: ${usage}\n`);
    }
    
    // اختيار الحساب الأكثر استخداماً للاحتفاظ به
    accountsWithUsage.sort((a, b) => b.totalUsage - a.totalUsage);
    const keepAccount = accountsWithUsage[0];
    const deleteAccounts = accountsWithUsage.slice(1);
    
    console.log(`✅ الاحتفاظ بالحساب: ID ${keepAccount.id} (الاستخدام: ${keepAccount.totalUsage})\n`);
    
    for (const deleteAcc of deleteAccounts) {
      console.log(`🗑️  معالجة الحساب ID ${deleteAcc.id}...`);
      
      // نقل القيود المحاسبية
      if (deleteAcc.postingCount > 0) {
        console.log(`   🔄 نقل ${deleteAcc.postingCount} قيد محاسبي...`);
        await client.query(`
          UPDATE journal_postings
          SET account_id = $1
          WHERE account_id = $2
        `, [keepAccount.id, deleteAcc.id]);
      }
      
      // نقل الشركاء
      if (deleteAcc.partnerCount > 0) {
        console.log(`   🔄 نقل ${deleteAcc.partnerCount} شريك...`);
        await client.query(`
          UPDATE partners
          SET account_id = $1
          WHERE account_id = $2
        `, [keepAccount.id, deleteAcc.id]);
      }
      
      // حذف الحساب المكرر
      await client.query('DELETE FROM accounts WHERE id = $1', [deleteAcc.id]);
      console.log(`   ✅ تم حذف الحساب ID ${deleteAcc.id}\n`);
    }
    
    await client.query('COMMIT');
    console.log('✅ تم إصلاح تكرار مصلحة الزكاة بنجاح!');
    
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

fixZakatDuplicate();
