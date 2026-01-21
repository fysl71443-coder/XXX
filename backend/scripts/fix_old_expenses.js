#!/usr/bin/env node
/**
 * إصلاح المصروفات القديمة التي لا تحتوي على journal_entry_id
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function getAccountIdByNumber(accountNumber) {
  if (!accountNumber) return null;
  try {
    // Try accounts table first (PostgreSQL)
    const { rows } = await dbPool.query(
      'SELECT id FROM accounts WHERE account_code = $1 OR account_number = $1 LIMIT 1',
      [accountNumber]
    );
    if (rows && rows[0]) {
      return rows[0].id;
    }
    // Try Account table (Prisma schema)
    const { rows: prismaRows } = await dbPool.query(
      'SELECT id FROM "Account" WHERE account_number = $1 LIMIT 1',
      [accountNumber]
    );
    return prismaRows && prismaRows[0] ? prismaRows[0].id : null;
  } catch (e) {
    console.error(`[FIX] Error getting account ${accountNumber}:`, e.message);
    return null;
  }
}

async function ensureAccountExists(accountCode, accountName, accountType, nature, parentId = null) {
  try {
    // Check if account exists
    let accountId = await getAccountIdByNumber(accountCode);
    if (accountId) {
      return accountId;
    }
    
    // Create account if it doesn't exist
    console.log(`📝 إنشاء الحساب ${accountCode}: ${accountName}`);
    
    // Try to insert into accounts table first (PostgreSQL)
    try {
      const { rows } = await dbPool.query(
        `INSERT INTO accounts(account_code, account_number, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          accountCode,
          accountCode, // account_number same as account_code
          accountName,
          accountName, // name_en same as name
          accountType,
          nature,
          parentId,
          0, // opening_balance
          true // allow_manual_entry
        ]
      );
      
      if (rows && rows[0]) {
        console.log(`✅ تم إنشاء الحساب ${accountCode} بنجاح (ID: ${rows[0].id})`);
        return rows[0].id;
      }
    } catch (insertError) {
      // If account already exists or table doesn't exist, try Account table (Prisma)
      if (insertError.code === '23505' || insertError.message.includes('unique') || insertError.message.includes('duplicate') || insertError.message.includes('does not exist')) {
        console.log(`⚠️ جاري المحاولة في جدول Account...`);
        try {
          const { rows: accountRows } = await dbPool.query(
            `INSERT INTO "Account"(account_number, name, type, nature, parent_id, opening_balance)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (account_number) DO NOTHING
             RETURNING id`,
            [
              accountCode,
              accountName,
              accountType,
              nature,
              parentId,
              0
            ]
          );
          
          if (accountRows && accountRows[0]) {
            console.log(`✅ تم إنشاء الحساب ${accountCode} في جدول Account (ID: ${accountRows[0].id})`);
            return accountRows[0].id;
          }
          
          // If no rows returned, account already exists, get it
          accountId = await getAccountIdByNumber(accountCode);
          if (accountId) {
            return accountId;
          }
        } catch (prismaError) {
          // If still fails, try to get existing account
          accountId = await getAccountIdByNumber(accountCode);
          if (accountId) {
            return accountId;
          }
          console.error(`❌ فشل إنشاء الحساب في كلا الجدولين: ${prismaError.message}`);
        }
      } else {
        throw insertError; // Re-throw if it's a different error
      }
    }
    
    return null;
  } catch (e) {
    console.error(`❌ خطأ في إنشاء الحساب ${accountCode}:`, e.message);
    return null;
  }
}

async function fixOldExpenses() {
  try {
    console.log('🔍 البحث عن مصروفات بدون journal_entry_id...');
    
    // Find expenses that are posted but don't have journal_entry_id
    const { rows: expenses } = await dbPool.query(`
      SELECT id, invoice_number, type, amount, total, account_code, 
             partner_id, description, status, branch, date, payment_method, items
      FROM expenses
      WHERE status = 'posted' 
        AND (journal_entry_id IS NULL OR journal_entry_id = 0)
        AND total > 0
      ORDER BY id
    `);
    
    console.log(`📊 وجد ${expenses.length} مصروف بدون journal entry`);
    
    if (expenses.length === 0) {
      console.log('✅ لا توجد مصروفات تحتاج إصلاح');
      return;
    }
    
    let fixed = 0;
    let failed = 0;
    
    for (const expense of expenses) {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        
        let accountCode = expense.account_code;
        if (!accountCode) {
          // CRITICAL FIX: Use default expense account if missing
          // Try to find a default expense account (5xxx series)
          const { rows: defaultAccountRows } = await dbPool.query(
            `SELECT account_code FROM accounts 
             WHERE (account_code LIKE '5%' OR account_code LIKE '52%' OR account_code LIKE '53%')
             AND type = 'expense'
             ORDER BY account_code
             LIMIT 1`
          );
          
          if (defaultAccountRows && defaultAccountRows[0]) {
            accountCode = defaultAccountRows[0].account_code;
            console.log(`⚠️ Expense #${expense.id}: لا يوجد account_code - استخدام الحساب الافتراضي ${accountCode}`);
            // Update expense with default account code
            await client.query('UPDATE expenses SET account_code = $1 WHERE id = $2', [accountCode, expense.id]);
          } else {
            // Use a hardcoded default
            accountCode = '5210'; // General expenses
            console.log(`⚠️ Expense #${expense.id}: لا يوجد account_code - استخدام الحساب الافتراضي ${accountCode}`);
            await client.query('UPDATE expenses SET account_code = $1 WHERE id = $2', [accountCode, expense.id]);
          }
        }
        
        // Get or create expense account ID
        let expenseAccountId = await getAccountIdByNumber(accountCode);
        if (!expenseAccountId) {
          // Try to get parent account for expenses (5200)
          const parentExpenseId = await getAccountIdByNumber('5200');
          expenseAccountId = await ensureAccountExists(
            accountCode,
            'مصروفات عامة',
            'expense',
            'debit',
            parentExpenseId
          );
        }
        
        // Get or create payment account ID
        let paymentAccountId = null;
        const paymentMethod = String(expense.payment_method || 'cash').toLowerCase();
        if (paymentMethod === 'bank') {
          paymentAccountId = await getAccountIdByNumber('1121');
          if (!paymentAccountId) {
            const parentBankId = await getAccountIdByNumber('1120');
            paymentAccountId = await ensureAccountExists(
              '1121',
              'بنك الراجحي',
              'bank',
              'debit',
              parentBankId
            );
          }
        } else {
          paymentAccountId = await getAccountIdByNumber('1111');
          if (!paymentAccountId) {
            const parentCashId = await getAccountIdByNumber('1110');
            paymentAccountId = await ensureAccountExists(
              '1111',
              'صندوق رئيسي',
              'cash',
              'debit',
              parentCashId
            );
          }
        }
        
        if (!expenseAccountId || !paymentAccountId) {
          console.log(`⚠️ Expense #${expense.id}: لا يمكن إنشاء أو العثور على الحسابات - تم التخطي`);
          await client.query('ROLLBACK');
          failed++;
          continue;
        }
        
        // Parse items if exists
        let items = [];
        if (expense.items) {
          try {
            items = typeof expense.items === 'string' ? JSON.parse(expense.items) : expense.items;
            if (!Array.isArray(items)) items = [];
          } catch (e) {
            items = [];
          }
        }
        
        const total = Number(expense.total || expense.amount || 0);
        
        // Calculate totals for balance validation
        let totalDebit = 0;
        let totalCredit = total;
        
        if (items.length > 0) {
          for (const item of items) {
            totalDebit += Number(item.amount || 0);
          }
        } else {
          totalDebit = total;
        }
        
        // Validate balance
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          console.log(`⚠️ Expense #${expense.id}: القيد غير متوازن (Debit: ${totalDebit}, Credit: ${totalCredit}) - تم التخطي`);
          await client.query('ROLLBACK');
          failed++;
          continue;
        }
        
        // Create journal entry
        const entryDescription = expense.type 
          ? `مصروف #${expense.id} - ${expense.type}` 
          : `مصروف #${expense.id}${expense.description ? ' - ' + expense.description : ''}`;
        
        const { rows: entryRows } = await client.query(
          `INSERT INTO journal_entries(description, date, reference_type, reference_id, status, branch)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, entry_number`,
          [
            entryDescription,
            expense.date || new Date().toISOString().slice(0, 10),
            'expense',
            expense.id,
            'posted',
            expense.branch || 'china_town'
          ]
        );
        
        const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
        
        if (!entryId) {
          console.log(`❌ Expense #${expense.id}: فشل إنشاء journal entry`);
          await client.query('ROLLBACK');
          failed++;
          continue;
        }
        
        // Create postings
        if (items.length > 0) {
          for (const item of items) {
            const itemAmount = Number(item.amount || 0);
            const itemAccountId = await getAccountIdByNumber(item.account_code);
            if (itemAccountId && itemAmount > 0) {
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, itemAccountId, itemAmount, 0]
              );
            }
          }
          await client.query(
            `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
             VALUES ($1, $2, $3, $4)`,
            [entryId, paymentAccountId, 0, total]
          );
        } else {
          await client.query(
            `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
             VALUES ($1, $2, $3, $4)`,
            [entryId, expenseAccountId, total, 0]
          );
          await client.query(
            `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
             VALUES ($1, $2, $3, $4)`,
            [entryId, paymentAccountId, 0, total]
          );
        }
        
        // Link expense to journal entry
        await client.query('UPDATE expenses SET journal_entry_id = $1 WHERE id = $2', [entryId, expense.id]);
        
        await client.query('COMMIT');
        console.log(`✅ Expense #${expense.id}: تم إنشاء journal entry #${entryId}`);
        fixed++;
        
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`❌ Expense #${expense.id}: خطأ - ${e.message}`);
        failed++;
      } finally {
        client.release();
      }
    }
    
    console.log(`\n📊 النتائج:`);
    console.log(`✅ تم إصلاح: ${fixed}`);
    console.log(`❌ فشل: ${failed}`);
    console.log(`📝 إجمالي: ${expenses.length}`);
    
  } catch (e) {
    console.error('❌ خطأ عام:', e);
  } finally {
    await dbPool.end();
  }
}

fixOldExpenses().catch(console.error);
