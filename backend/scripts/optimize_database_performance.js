#!/usr/bin/env node
/**
 * تحسين أداء قاعدة البيانات
 * 
 * يضيف:
 * 1. Indexes على الجداول الأساسية
 * 2. تحسين الاستعلامات
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function optimizeDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    console.log('\n📊 بدء تحسين قاعدة البيانات...\n');

    // 1. Indexes for orders table
    console.log('1️⃣ إضافة Indexes لجدول orders...');
    const orderIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch)',
      'CREATE INDEX IF NOT EXISTS idx_orders_table_code ON orders(table_code)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_branch_table ON orders(branch, table_code)',
      'CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON orders(branch, status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON orders(invoice_id) WHERE invoice_id IS NOT NULL'
    ];

    for (const indexQuery of orderIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`   ✅ ${indexQuery.split('idx_')[1].split(' ON')[0]}`);
      } catch (e) {
        console.log(`   ⚠️ ${indexQuery.split('idx_')[1].split(' ON')[0]}: ${e.message}`);
      }
    }

    // 2. Indexes for invoices table
    console.log('\n2️⃣ إضافة Indexes لجدول invoices...');
    const invoiceIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_partner_id ON invoices(partner_id) WHERE partner_id IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_invoices_journal_entry_id ON invoices(journal_entry_id) WHERE journal_entry_id IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch) WHERE branch IS NOT NULL'
    ];

    for (const indexQuery of invoiceIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`   ✅ ${indexQuery.split('idx_')[1].split(' ON')[0]}`);
      } catch (e) {
        console.log(`   ⚠️ ${indexQuery.split('idx_')[1].split(' ON')[0]}: ${e.message}`);
      }
    }

    // 3. Indexes for journal_entries table
    console.log('\n3️⃣ إضافة Indexes لجدول journal_entries...');
    const journalIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id) WHERE reference_type IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_branch ON journal_entries(branch) WHERE branch IS NOT NULL'
    ];

    for (const indexQuery of journalIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`   ✅ ${indexQuery.split('idx_')[1].split(' ON')[0]}`);
      } catch (e) {
        console.log(`   ⚠️ ${indexQuery.split('idx_')[1].split(' ON')[0]}: ${e.message}`);
      }
    }

    // 4. Indexes for journal_postings table
    console.log('\n4️⃣ إضافة Indexes لجدول journal_postings...');
    const postingIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_journal_postings_entry_id ON journal_postings(journal_entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_postings_account_id ON journal_postings(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_postings_entry_account ON journal_postings(journal_entry_id, account_id)'
    ];

    for (const indexQuery of postingIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`   ✅ ${indexQuery.split('idx_')[1].split(' ON')[0]}`);
      } catch (e) {
        console.log(`   ⚠️ ${indexQuery.split('idx_')[1].split(' ON')[0]}: ${e.message}`);
      }
    }

    // 5. Indexes for products table
    console.log('\n5️⃣ إضافة Indexes لجدول products...');
    const productIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true',
      'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)'
    ];

    for (const indexQuery of productIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`   ✅ ${indexQuery.split('idx_')[1].split(' ON')[0]}`);
      } catch (e) {
        console.log(`   ⚠️ ${indexQuery.split('idx_')[1].split(' ON')[0]}: ${e.message}`);
      }
    }

    // 6. Indexes for expenses table
    console.log('\n6️⃣ إضافة Indexes لجدول expenses...');
    const expenseIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)',
      'CREATE INDEX IF NOT EXISTS idx_expenses_journal_entry_id ON expenses(journal_entry_id) WHERE journal_entry_id IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch) WHERE branch IS NOT NULL'
    ];

    for (const indexQuery of expenseIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`   ✅ ${indexQuery.split('idx_')[1].split(' ON')[0]}`);
      } catch (e) {
        console.log(`   ⚠️ ${indexQuery.split('idx_')[1].split(' ON')[0]}: ${e.message}`);
      }
    }

    // 7. Analyze tables for query planner
    console.log('\n7️⃣ تحليل الجداول لتحسين Query Planner...');
    const tablesToAnalyze = ['orders', 'invoices', 'journal_entries', 'journal_postings', 'products', 'expenses'];
    for (const table of tablesToAnalyze) {
      try {
        await client.query(`ANALYZE ${table}`);
        console.log(`   ✅ تم تحليل جدول ${table}`);
      } catch (e) {
        console.log(`   ⚠️ فشل تحليل ${table}: ${e.message}`);
      }
    }

    console.log('\n✅✅ تم تحسين قاعدة البيانات بنجاح!');
    console.log('✅ سيتم تحسين أداء الاستعلامات بشكل كبير');

  } catch (error) {
    console.error('❌ خطأ في تحسين قاعدة البيانات:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

optimizeDatabase().catch(error => {
  console.error('❌ خطأ عام:', error);
  process.exit(1);
});
