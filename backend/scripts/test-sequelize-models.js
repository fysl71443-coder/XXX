#!/usr/bin/env node
/**
 * سكريبت اختبار الموديلات Sequelize
 * 
 * الاستخدام:
 *   node backend/scripts/test-sequelize-models.js
 */

import dotenv from 'dotenv';
import { Op } from 'sequelize';
import { Account, JournalEntry, JournalPosting, Expense, Invoice } from '../models/index.js';
import sequelize from '../db-sequelize.js';

dotenv.config();

async function testModels() {
  try {
    console.log('🔌 الاتصال بقاعدة البيانات...');
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بنجاح!\n');

    // اختبار 1: جلب حسابات
    console.log('📊 اختبار 1: جلب الحسابات...');
    const accounts = await Account.findAll({ limit: 5 });
    console.log(`   ✅ تم جلب ${accounts.length} حساب\n`);

    // اختبار 2: جلب قيود
    console.log('📊 اختبار 2: جلب القيود...');
    const entries = await JournalEntry.findAll({ limit: 5 });
    console.log(`   ✅ تم جلب ${entries.length} قيد\n`);

    // اختبار 3: جلب قيد مع سطوره
    console.log('📊 اختبار 3: جلب قيد مع سطوره...');
    const entryWithPostings = await JournalEntry.findOne({
      include: [{
        model: JournalPosting,
        as: 'postings',
        include: [{
          model: Account,
          as: 'account'
        }]
      }]
    });
    
    if (entryWithPostings) {
      console.log(`   ✅ تم جلب قيد #${entryWithPostings.id} مع ${entryWithPostings.postings?.length || 0} سطر`);
    } else {
      console.log('   ⚠️ لا توجد قيود مع سطور');
    }
    console.log();

    // اختبار 4: جلب مصروفات
    console.log('📊 اختبار 4: جلب المصروفات...');
    const expenses = await Expense.findAll({ limit: 5 });
    console.log(`   ✅ تم جلب ${expenses.length} مصروف\n`);

    // اختبار 5: جلب مصروف مع قيده
    console.log('📊 اختبار 5: جلب مصروف مع قيده...');
    const expenseWithJournal = await Expense.findOne({
      where: { journal_entry_id: { [Op.ne]: null } },
      include: [{
        model: JournalEntry,
        as: 'journalEntry'
      }]
    });
    
    if (expenseWithJournal) {
      console.log(`   ✅ تم جلب مصروف #${expenseWithJournal.id} مع قيد #${expenseWithJournal.journal_entry_id}`);
    } else {
      console.log('   ⚠️ لا توجد مصروفات مربوطة بقيد');
    }
    console.log();

    // اختبار 6: جلب فواتير
    console.log('📊 اختبار 6: جلب الفواتير...');
    const invoices = await Invoice.findAll({ limit: 5 });
    console.log(`   ✅ تم جلب ${invoices.length} فاتورة\n`);

    console.log('✅✅ جميع الاختبارات نجحت!');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 تم إغلاق الاتصال');
  }
}

testModels();
