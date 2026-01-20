#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_log'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 أعمدة جدول audit_log:');
    console.log('─'.repeat(70));
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('─'.repeat(70));
    
    // التحقق من الأعمدة المطلوبة
    const requiredColumns = ['user_id', 'screen_code', 'action_code', 'allowed', 'ip_address', 'user_agent', 'created_at'];
    const existingColumns = result.rows.map(r => r.column_name);
    
    console.log('\n✅ التحقق من الأعمدة المطلوبة:');
    requiredColumns.forEach(col => {
      if (existingColumns.includes(col)) {
        console.log(`  ✅ ${col} - موجود`);
      } else {
        console.log(`  ❌ ${col} - مفقود`);
      }
    });
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

checkColumns();
