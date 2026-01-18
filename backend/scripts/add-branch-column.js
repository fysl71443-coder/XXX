#!/usr/bin/env node
/**
 * إضافة عمود branch إلى journal_entries
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function addBranchColumn() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    // إضافة عمود branch إذا لم يكن موجوداً
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='journal_entries' AND column_name='branch') THEN
          ALTER TABLE journal_entries ADD COLUMN branch TEXT;
          RAISE NOTICE 'تم إضافة عمود branch';
        ELSE
          RAISE NOTICE 'عمود branch موجود بالفعل';
        END IF;
      END $$;
    `);
    
    console.log('✅ تم التحقق من عمود branch');
    
    await client.end();
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    await client.end();
    process.exit(1);
  }
}

addBranchColumn();
