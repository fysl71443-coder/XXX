#!/usr/bin/env node
/**
 * إصلاح جدول audit_log - إضافة عمود screen_code المفقود
 * 
 * المشكلة:
 * - الكود يحاول إدراج screen_code في audit_log
 * - لكن العمود غير موجود في قاعدة البيانات
 * 
 * الحل:
 * - إضافة العمود screen_code إلى جدول audit_log
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function fixAuditLogTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // 1. التحقق من وجود جدول audit_log
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'audit_log'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📋 جدول audit_log غير موجود - سيتم إنشاؤه...');
      
      await client.query(`
        CREATE TABLE audit_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          screen_code VARCHAR(50),
          action_code TEXT,
          allowed BOOLEAN NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `);

      console.log('✅ تم إنشاء جدول audit_log مع عمود screen_code');
    } else {
      console.log('✅ جدول audit_log موجود');

      // 2. التحقق من وجود عمود screen_code
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'screen_code';
      `);

      if (columnCheck.rows.length === 0) {
        console.log('📋 عمود screen_code غير موجود - سيتم إضافته...');

        // إضافة العمود
        await client.query(`
          ALTER TABLE audit_log
          ADD COLUMN screen_code VARCHAR(50);
        `);

        console.log('✅ تم إضافة عمود screen_code إلى جدول audit_log');
      } else {
        console.log('✅ عمود screen_code موجود بالفعل');
      }

      // 3. التحقق من وجود عمود action_code (للتأكد من اكتمال الجدول)
      const actionCodeCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'action_code';
      `);

      if (actionCodeCheck.rows.length === 0) {
        console.log('📋 عمود action_code غير موجود - سيتم إضافته...');
        await client.query(`
          ALTER TABLE audit_log
          ADD COLUMN action_code TEXT;
        `);
        console.log('✅ تم إضافة عمود action_code إلى جدول audit_log');
      } else {
        console.log('✅ عمود action_code موجود بالفعل');
      }

      // 4. التحقق من وجود عمود allowed
      const allowedCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'allowed';
      `);

      if (allowedCheck.rows.length === 0) {
        console.log('📋 عمود allowed غير موجود - سيتم إضافته...');
        await client.query(`
          ALTER TABLE audit_log
          ADD COLUMN allowed BOOLEAN NOT NULL DEFAULT true;
        `);
        console.log('✅ تم إضافة عمود allowed إلى جدول audit_log');
      } else {
        console.log('✅ عمود allowed موجود بالفعل');
      }

      // 5. التحقق من وجود عمود ip_address
      const ipAddressCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'ip_address';
      `);

      if (ipAddressCheck.rows.length === 0) {
        console.log('📋 عمود ip_address غير موجود - سيتم إضافته...');
        await client.query(`
          ALTER TABLE audit_log
          ADD COLUMN ip_address TEXT;
        `);
        console.log('✅ تم إضافة عمود ip_address إلى جدول audit_log');
      } else {
        console.log('✅ عمود ip_address موجود بالفعل');
      }

      // 6. التحقق من وجود عمود user_agent
      const userAgentCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'user_agent';
      `);

      if (userAgentCheck.rows.length === 0) {
        console.log('📋 عمود user_agent غير موجود - سيتم إضافته...');
        await client.query(`
          ALTER TABLE audit_log
          ADD COLUMN user_agent TEXT;
        `);
        console.log('✅ تم إضافة عمود user_agent إلى جدول audit_log');
      } else {
        console.log('✅ عمود user_agent موجود بالفعل');
      }
    }

    // 7. عرض بنية الجدول النهائية
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_log'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 بنية جدول audit_log:');
    console.log('─'.repeat(60));
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('─'.repeat(60));

    console.log('\n✅✅ تم إصلاح جدول audit_log بنجاح!');
    console.log('✅ لن تظهر رسالة الخطأ "[AUDIT] Could not save to database" بعد الآن');

  } catch (error) {
    console.error('❌ خطأ في إصلاح جدول audit_log:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixAuditLogTable().catch(error => {
  console.error('❌ خطأ عام:', error);
  process.exit(1);
});
