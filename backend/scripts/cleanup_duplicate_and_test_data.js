import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🧹 بدء تنظيف البيانات المكررة والتجريبية...\n');
    
    // ============================================
    // 1. حذف حسابات E2E Test (العملاء والموردين)
    // ============================================
    console.log('📋 الخطوة 1: البحث عن حسابات E2E Test...');
    
    const { rows: testAccounts } = await client.query(`
      SELECT id, account_number, account_code, name, name_en, type, parent_id
      FROM accounts
      WHERE name LIKE '%E2E Test%' 
         OR name_en LIKE '%E2E Test%'
         OR name LIKE '%Test Customer%'
         OR name LIKE '%Test Supplier%'
         OR account_number LIKE '062%'
         OR account_number LIKE '063%'
         OR account_number LIKE '064%'
         OR account_number LIKE '065%'
      ORDER BY id
    `);
    
    console.log(`   وجد ${testAccounts.length} حساب تجريبي\n`);
    
    if (testAccounts.length > 0) {
      console.log('   تفاصيل الحسابات التجريبية:');
      for (const acc of testAccounts) {
        // التحقق من وجود قيود محاسبية
        const { rows: postings } = await client.query(`
          SELECT COUNT(*) as count
          FROM journal_postings
          WHERE account_id = $1
        `, [acc.id]);
        
        const postingCount = parseInt(postings[0].count);
        
        // التحقق من وجود partner مرتبط
        const { rows: partners } = await client.query(`
          SELECT COUNT(*) as count
          FROM partners
          WHERE account_id = $1
        `, [acc.id]);
        
        const partnerCount = parseInt(partners[0].count);
        
        console.log(`   - ID ${acc.id}: ${acc.name} (${acc.account_number})`);
        console.log(`     قيود محاسبية: ${postingCount}, شركاء مرتبطين: ${partnerCount}`);
        
        if (postingCount > 0) {
          console.log(`     ⚠️  لا يمكن الحذف - له قيود محاسبية`);
        } else if (partnerCount > 0) {
          console.log(`     ⚠️  لا يمكن الحذف - له شركاء مرتبطين`);
        } else {
          // حذف الحساب
          await client.query('DELETE FROM accounts WHERE id = $1', [acc.id]);
          console.log(`     ✅ تم الحذف`);
        }
      }
      console.log('');
    }
    
    // ============================================
    // 2. حذف حسابات العملاء والموردين غير المرتبطين
    // ============================================
    console.log('📋 الخطوة 2: البحث عن حسابات عملاء/موردين غير مرتبطين...');
    
    // الحسابات التي تحتوي على "عميل" أو "مورد" أو "customer" أو "supplier"
    const { rows: orphanAccounts } = await client.query(`
      SELECT a.id, a.account_number, a.account_code, a.name, a.type, a.parent_id
      FROM accounts a
      WHERE (
        a.name LIKE '%عميل%' OR a.name LIKE '%مورد%' 
        OR a.name_en LIKE '%Customer%' OR a.name_en LIKE '%Supplier%'
        OR a.type = 'customer' OR a.type = 'supplier'
      )
      AND NOT EXISTS (
        SELECT 1 FROM partners p WHERE p.account_id = a.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM journal_postings jp WHERE jp.account_id = a.id
      )
      AND a.account_number NOT IN ('1140', '2110', '2111', '1171') -- الحسابات الرئيسية
      ORDER BY a.id
    `);
    
    console.log(`   وجد ${orphanAccounts.length} حساب غير مرتبط\n`);
    
    if (orphanAccounts.length > 0) {
      for (const acc of orphanAccounts) {
        // التحقق مرة أخرى قبل الحذف
        const { rows: checkPostings } = await client.query(`
          SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1
        `, [acc.id]);
        
        const { rows: checkPartners } = await client.query(`
          SELECT COUNT(*) as count FROM partners WHERE account_id = $1
        `, [acc.id]);
        
        if (parseInt(checkPostings[0].count) === 0 && parseInt(checkPartners[0].count) === 0) {
          await client.query('DELETE FROM accounts WHERE id = $1', [acc.id]);
          console.log(`   ✅ حذف حساب غير مرتبط: ID ${acc.id} - ${acc.name} (${acc.account_number})`);
        }
      }
      console.log('');
    }
    
    // ============================================
    // 3. حذف الحسابات المكررة بناءً على رقم الحساب
    // ============================================
    console.log('📋 الخطوة 3: البحث عن حسابات مكررة بناءً على رقم الحساب...');
    
    const { rows: duplicatesByNumber } = await client.query(`
      SELECT account_number, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM accounts
      WHERE account_number IS NOT NULL AND account_number != ''
      GROUP BY account_number
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log(`   وجد ${duplicatesByNumber.length} رقم حساب مكرر\n`);
    
    for (const dup of duplicatesByNumber) {
      const ids = dup.ids;
      console.log(`   رقم الحساب ${dup.account_number} (موجود ${dup.count} مرة): IDs ${ids.join(', ')}`);
      
      // الاحتفاظ بأول حساب (الأقدم) وحذف الباقي
      const keepId = ids[0];
      const deleteIds = ids.slice(1);
      
      for (const deleteId of deleteIds) {
        // التحقق من وجود قيود محاسبية
        const { rows: postings } = await client.query(`
          SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1
        `, [deleteId]);
        
        const { rows: partners } = await client.query(`
          SELECT COUNT(*) as count FROM partners WHERE account_id = $1
        `, [deleteId]);
        
        const postingCount = parseInt(postings[0].count);
        const partnerCount = parseInt(partners[0].count);
        
        if (postingCount > 0) {
          // نقل القيود إلى الحساب المتبقي
          console.log(`     🔄 نقل ${postingCount} قيد محاسبي من ID ${deleteId} إلى ID ${keepId}...`);
          await client.query(`
            UPDATE journal_postings
            SET account_id = $1
            WHERE account_id = $2
          `, [keepId, deleteId]);
        }
        
        if (partnerCount > 0) {
          // نقل الشركاء إلى الحساب المتبقي
          console.log(`     🔄 نقل ${partnerCount} شريك من ID ${deleteId} إلى ID ${keepId}...`);
          await client.query(`
            UPDATE partners
            SET account_id = $1
            WHERE account_id = $2
          `, [keepId, deleteId]);
        }
        
        // حذف الحساب المكرر
        await client.query('DELETE FROM accounts WHERE id = $1', [deleteId]);
        console.log(`     ✅ حذف حساب مكرر: ID ${deleteId}`);
      }
    }
    
    if (duplicatesByNumber.length > 0) {
      console.log('');
    }
    
    // ============================================
    // 4. حذف الحسابات المكررة بناءً على الاسم (مع التحقق من عدم وجود قيود)
    // ============================================
    console.log('📋 الخطوة 4: البحث عن حسابات مكررة بناءً على الاسم...');
    
    const { rows: duplicatesByName } = await client.query(`
      SELECT name, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM accounts
      WHERE name IS NOT NULL AND name != ''
        AND name NOT IN ('مصلحة الزكاة') -- استثناء الحسابات المعروفة
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);
    
    console.log(`   وجد ${duplicatesByName.length} اسم حساب مكرر\n`);
    
    for (const dup of duplicatesByName) {
      const ids = dup.ids;
      console.log(`   الاسم "${dup.name}" (موجود ${dup.count} مرة): IDs ${ids.join(', ')}`);
      
      // اختيار الحساب الذي له قيود محاسبية أو شركاء (الأكثر استخداماً)
      let keepId = null;
      let maxUsage = -1;
      
      for (const id of ids) {
        const { rows: postings } = await client.query(`
          SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1
        `, [id]);
        
        const { rows: partners } = await client.query(`
          SELECT COUNT(*) as count FROM partners WHERE account_id = $1
        `, [id]);
        
        const usage = parseInt(postings[0].count) + parseInt(partners[0].count);
        
        if (usage > maxUsage) {
          maxUsage = usage;
          keepId = id;
        }
      }
      
      // إذا لم يكن هناك استخدام، احتفظ بأول حساب
      if (!keepId) {
        keepId = ids[0];
      }
      
      const deleteIds = ids.filter(id => id !== keepId);
      
      console.log(`     الاحتفاظ بـ ID ${keepId} (الاستخدام: ${maxUsage})`);
      
      for (const deleteId of deleteIds) {
        const { rows: postings } = await client.query(`
          SELECT COUNT(*) as count FROM journal_postings WHERE account_id = $1
        `, [deleteId]);
        
        const { rows: partners } = await client.query(`
          SELECT COUNT(*) as count FROM partners WHERE account_id = $1
        `, [deleteId]);
        
        const postingCount = parseInt(postings[0].count);
        const partnerCount = parseInt(partners[0].count);
        
        if (postingCount > 0 || partnerCount > 0) {
          if (postingCount > 0) {
            console.log(`     🔄 نقل ${postingCount} قيد محاسبي من ID ${deleteId} إلى ID ${keepId}...`);
            await client.query(`
              UPDATE journal_postings
              SET account_id = $1
              WHERE account_id = $2
            `, [keepId, deleteId]);
          }
          
          if (partnerCount > 0) {
            console.log(`     🔄 نقل ${partnerCount} شريك من ID ${deleteId} إلى ID ${keepId}...`);
            await client.query(`
              UPDATE partners
              SET account_id = $1
              WHERE account_id = $2
            `, [keepId, deleteId]);
          }
        }
        
        await client.query('DELETE FROM accounts WHERE id = $1', [deleteId]);
        console.log(`     ✅ حذف حساب مكرر: ID ${deleteId}`);
      }
    }
    
    if (duplicatesByName.length > 0) {
      console.log('');
    }
    
    // ============================================
    // 5. التحقق النهائي
    // ============================================
    console.log('📋 الخطوة 5: التحقق النهائي...\n');
    
    const { rows: finalTestAccounts } = await client.query(`
      SELECT COUNT(*) as count
      FROM accounts
      WHERE name LIKE '%E2E Test%' OR name_en LIKE '%E2E Test%'
    `);
    
    const { rows: finalDuplicates } = await client.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT account_number, COUNT(*) as cnt
        FROM accounts
        WHERE account_number IS NOT NULL AND account_number != ''
        GROUP BY account_number
        HAVING COUNT(*) > 1
      ) subq
    `);
    
    console.log(`   حسابات E2E Test المتبقية: ${finalTestAccounts[0].count}`);
    console.log(`   أرقام حسابات مكررة متبقية: ${finalDuplicates[0].count}`);
    
    await client.query('COMMIT');
    console.log('\n✅ تم تنظيف البيانات بنجاح!');
    
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\n❌ خطأ:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

cleanup();
