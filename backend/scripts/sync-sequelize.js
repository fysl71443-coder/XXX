#!/usr/bin/env node
/**
 * سكريبت مزامنة الجداول باستخدام Sequelize
 * 
 * الاستخدام:
 *   node backend/scripts/sync-sequelize.js
 * 
 * أو مع DATABASE_URL:
 *   DATABASE_URL=postgresql://... node backend/scripts/sync-sequelize.js
 */

import dotenv from 'dotenv';
import sequelize from '../db-sequelize.js';
import { Account, JournalEntry, JournalPosting, Expense, Invoice } from '../models/index.js';

// Load .env
dotenv.config();

async function syncAll() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully!');

    // Sync all models
    // alter: true - يضيف الأعمدة المفقودة دون حذف البيانات
    // force: false - لا يحذف الجداول الموجودة
    console.log('\n🔄 Syncing database tables...');
    
    await Account.sync({ alter: true });
    console.log('   ✅ Account model synced');

    await JournalEntry.sync({ alter: true });
    console.log('   ✅ JournalEntry model synced');

    await JournalPosting.sync({ alter: true });
    console.log('   ✅ JournalPosting model synced');

    await Expense.sync({ alter: true });
    console.log('   ✅ Expense model synced');

    await Invoice.sync({ alter: true });
    console.log('   ✅ Invoice model synced');

    console.log('\n✅✅ All tables synced successfully!');
    
    // Display table info
    console.log('\n📊 Database tables:');
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('accounts', 'journal_entries', 'journal_postings', 'expenses', 'invoices')
      ORDER BY table_name
    `);
    
    results.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

  } catch (error) {
    console.error('\n❌ Error syncing database:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed');
  }
}

syncAll();
