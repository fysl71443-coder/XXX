#!/usr/bin/env node
/**
 * سكريبت Seed لإضافة بيانات اختبارية
 * 
 * يضيف:
 * - حسابات محاسبية أساسية
 * - مصروفات تجريبية
 * - فواتير تجريبية
 * - قيود محاسبية
 * 
 * الاستخدام:
 *   node backend/scripts/seed-test-data.js
 */

import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// Seed Accounts
// ============================================

async function seedAccounts() {
  console.log('📊 إضافة الحسابات المحاسبية...');
  
  const accounts = [
    { account_code: '1111', name: 'الصندوق', type: 'asset', nature: 'debit' },
    { account_code: '1121', name: 'البنك', type: 'asset', nature: 'debit' },
    { account_code: '1200', name: 'الذمم المدينة', type: 'asset', nature: 'debit' },
    { account_code: '2100', name: 'الذمم الدائنة', type: 'liability', nature: 'credit' },
    { account_code: '4000', name: 'الإيرادات', type: 'revenue', nature: 'credit' },
    { account_code: '5210', name: 'المصروفات العامة', type: 'expense', nature: 'debit' },
    { account_code: '5300', name: 'مصروفات الرواتب', type: 'expense', nature: 'debit' }
  ];
  
  for (const acc of accounts) {
    try {
      const result = await pool.query(`
        INSERT INTO accounts (account_code, name, type, nature, opening_balance)
        VALUES ($1, $2, $3, $4, 0)
        ON CONFLICT DO NOTHING
        RETURNING id, account_code, name
      `, [acc.account_code, acc.name, acc.type, acc.nature]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${acc.account_code} - ${acc.name}`);
      }
    } catch (error) {
      console.log(`   ⚠️ ${acc.account_code} - ${error.message}`);
    }
  }
}

// ============================================
// Seed Expenses
// ============================================

async function seedExpenses() {
  console.log('\n💰 إضافة مصروفات تجريبية...');
  
  const expenses = [
    {
      type: 'expense',
      amount: 500,
      total: 500,
      account_code: '5210',
      description: 'مصروف كهرباء',
      status: 'draft',
      branch: 'china_town',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'cash'
    },
    {
      type: 'expense',
      amount: 1000,
      total: 1000,
      account_code: '5210',
      description: 'مصروف إيجار',
      status: 'draft',
      branch: 'china_town',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'bank'
    }
  ];
  
  for (const exp of expenses) {
    try {
      const result = await pool.query(`
        INSERT INTO expenses (type, amount, total, account_code, description, status, branch, date, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, description, amount
      `, [exp.type, exp.amount, exp.total, exp.account_code, exp.description, exp.status, exp.branch, exp.date, exp.payment_method]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${result.rows[0].description} - ${result.rows[0].amount} ريال`);
      }
    } catch (error) {
      console.log(`   ⚠️ خطأ: ${error.message}`);
    }
  }
}

// ============================================
// Seed Invoices
// ============================================

async function seedInvoices() {
  console.log('\n📄 إضافة فواتير تجريبية...');
  
  const invoices = [
    {
      number: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      customer_id: null,
      lines: JSON.stringify([
        { product_id: 1, quantity: 2, price: 100, name: 'منتج 1' },
        { product_id: 2, quantity: 1, price: 200, name: 'منتج 2' }
      ]),
      subtotal: 400,
      tax_pct: 15,
      tax_amount: 60,
      total: 460,
      status: 'draft',
      branch: 'china_town'
    }
  ];
  
  for (const inv of invoices) {
    try {
      const result = await pool.query(`
        INSERT INTO invoices (number, date, customer_id, lines, subtotal, tax_pct, tax_amount, total, status, branch)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
        RETURNING id, number, total
      `, [inv.number, inv.date, inv.customer_id, inv.lines, inv.subtotal, inv.tax_pct, inv.tax_amount, inv.total, inv.status, inv.branch]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${result.rows[0].number} - ${result.rows[0].total} ريال`);
      }
    } catch (error) {
      console.log(`   ⚠️ خطأ: ${error.message}`);
    }
  }
}

// ============================================
// Seed Journal Entries
// ============================================

async function seedJournalEntries() {
  console.log('\n📚 إضافة قيود محاسبية تجريبية...');
  
  // Get account IDs
  const cashAccount = await pool.query(`SELECT id FROM accounts WHERE account_code = '1111' LIMIT 1`);
  const expenseAccount = await pool.query(`SELECT id FROM accounts WHERE account_code = '5210' LIMIT 1`);
  
  if (cashAccount.rows.length === 0 || expenseAccount.rows.length === 0) {
    console.log('   ⚠️ لا توجد حسابات - تم تخطي القيود');
    return;
  }
  
  const cashId = cashAccount.rows[0].id;
  const expenseId = expenseAccount.rows[0].id;
  
  try {
    // Create journal entry
    const entryResult = await pool.query(`
      INSERT INTO journal_entries (description, date, reference_type, reference_id, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, entry_number
    `, ['قيد تجريبي', new Date().toISOString().split('T')[0], 'manual', null, 'posted']);
    
    if (entryResult.rows.length > 0) {
      const entryId = entryResult.rows[0].id;
      console.log(`   ✅ قيد #${entryId} تم إنشاؤه`);
      
      // Add postings
      await pool.query(`
        INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
        VALUES ($1, $2, $3, $4)
      `, [entryId, expenseId, 100, 0]);
      
      await pool.query(`
        INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
        VALUES ($1, $2, $3, $4)
      `, [entryId, cashId, 0, 100]);
      
      console.log(`   ✅ تم إضافة سطور القيد`);
    }
  } catch (error) {
    console.log(`   ⚠️ خطأ: ${error.message}`);
  }
}

// ============================================
// Main Seed Function
// ============================================

async function seedAll() {
  console.log('🌱 بدء إضافة البيانات الاختبارية...');
  console.log('='.repeat(60));
  
  try {
    await seedAccounts();
    await seedExpenses();
    await seedInvoices();
    await seedJournalEntries();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅✅ تمت إضافة البيانات الاختبارية بنجاح!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ خطأ في إضافة البيانات:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seed
seedAll();
