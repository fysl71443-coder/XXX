#!/usr/bin/env node
/**
 * تحديث القيود الموجودة بنسخ الحقول من expenses و invoices
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function updateExistingEntries() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    // تحديث القيود من expenses
    const expenseResult = await client.query(`
      UPDATE journal_entries
      SET 
          description = CONCAT('مصروف #', e.id, 
            CASE WHEN e.type IS NOT NULL THEN CONCAT(' - ', e.type) ELSE '' END,
            CASE WHEN e.description IS NOT NULL THEN CONCAT(' - ', e.description) ELSE '' END),
          date = e.date,
          reference_type = 'expense',
          reference_id = e.id,
          branch = e.branch
      FROM expenses e
      WHERE journal_entries.id = e.journal_entry_id
        AND journal_entries.reference_type = 'expense'
    `);
    
    console.log(`✅ تم تحديث ${expenseResult.rowCount} قيد من expenses`);
    
    // تحديث القيود من invoices
    const invoiceResult = await client.query(`
      UPDATE journal_entries
      SET 
          description = CONCAT('فاتورة #', i.number),
          date = i.date,
          reference_type = 'invoice',
          reference_id = i.id,
          branch = i.branch
      FROM invoices i
      WHERE journal_entries.id = i.journal_entry_id
        AND journal_entries.reference_type = 'invoice'
    `);
    
    console.log(`✅ تم تحديث ${invoiceResult.rowCount} قيد من invoices`);
    
    // التحقق من النتائج
    const checkResult = await client.query(`
      SELECT 
          je.id,
          je.entry_number,
          je.description,
          je.date,
          je.reference_type,
          je.reference_id,
          je.branch,
          je.status
      FROM journal_entries je
      WHERE je.status = 'posted'
      ORDER BY je.id DESC
      LIMIT 10
    `);
    
    console.log('\n📊 عينة من القيود المحدثة:');
    checkResult.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Type: ${row.reference_type}, Branch: ${row.branch || '—'}, Desc: ${row.description?.substring(0, 50)}...`);
    });
    
    await client.end();
    console.log('\n✅✅ تم التحديث بنجاح!');
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    await client.end();
    process.exit(1);
  }
}

updateExistingEntries();
