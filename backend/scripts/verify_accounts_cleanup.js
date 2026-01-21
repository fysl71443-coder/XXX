import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function verify() {
  try {
    console.log('🔍 التحقق من تنظيف الحسابات...\n');
    
    // التحقق من حسابات E2E Test
    const { rows: testAccounts } = await pool.query(`
      SELECT COUNT(*) as count
      FROM accounts
      WHERE name LIKE '%E2E Test%' OR name_en LIKE '%E2E Test%'
    `);
    
    console.log(`📊 حسابات E2E Test المتبقية: ${testAccounts[0].count}`);
    
    // التحقق من الحسابات الرئيسية (2111 موردون، 1171 العملاء)
    const { rows: mainAccounts } = await pool.query(`
      SELECT id, account_number, account_code, name, name_en, type
      FROM accounts
      WHERE account_number IN ('2111', '1171')
         OR name IN ('موردون', 'العملاء')
      ORDER BY account_number
    `);
    
    console.log(`\n📋 الحسابات الرئيسية:`);
    mainAccounts.forEach(acc => {
      console.log(`   - ${acc.account_number || 'N/A'}: ${acc.name} (ID: ${acc.id})`);
    });
    
    // التحقق من حسابات العملاء والموردين الفرعية
    const { rows: customerAccounts } = await pool.query(`
      SELECT COUNT(*) as count
      FROM accounts a
      WHERE a.parent_id IN (
        SELECT id FROM accounts WHERE account_number = '1171' OR name = 'العملاء'
      )
    `);
    
    const { rows: supplierAccounts } = await pool.query(`
      SELECT COUNT(*) as count
      FROM accounts a
      WHERE a.parent_id IN (
        SELECT id FROM accounts WHERE account_number = '2111' OR name = 'موردون'
      )
    `);
    
    console.log(`\n📊 حسابات العملاء الفرعية: ${customerAccounts[0].count}`);
    console.log(`📊 حسابات الموردين الفرعية: ${supplierAccounts[0].count}`);
    
    // التحقق من وجود شركاء مرتبطين بحسابات
    const { rows: linkedAccounts } = await pool.query(`
      SELECT COUNT(DISTINCT account_id) as count
      FROM partners
      WHERE account_id IS NOT NULL
    `);
    
    console.log(`\n📊 حسابات مرتبطة بشركاء: ${linkedAccounts[0].count}`);
    
    // التحقق من وجود قيود محاسبية مرتبطة بحسابات
    const { rows: accountsWithPostings } = await pool.query(`
      SELECT COUNT(DISTINCT account_id) as count
      FROM journal_postings
    `);
    
    console.log(`📊 حسابات لها قيود محاسبية: ${accountsWithPostings[0].count}`);
    
    // التحقق من التكرارات
    const { rows: duplicatesByNumber } = await pool.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT account_number, COUNT(*) as cnt
        FROM accounts
        WHERE account_number IS NOT NULL AND account_number != ''
        GROUP BY account_number
        HAVING COUNT(*) > 1
      ) subq
    `);
    
    const { rows: duplicatesByName } = await pool.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT name, COUNT(*) as cnt
        FROM accounts
        WHERE name IS NOT NULL AND name != ''
        GROUP BY name
        HAVING COUNT(*) > 1
      ) subq
    `);
    
    console.log(`\n📊 أرقام حسابات مكررة: ${duplicatesByNumber[0].count}`);
    console.log(`📊 أسماء حسابات مكررة: ${duplicatesByName[0].count}`);
    
    console.log('\n✅ انتهى التحقق');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ خطأ:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

verify();
