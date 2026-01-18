#!/usr/bin/env node
/**
 * سكريبت ذكي لمزامنة قاعدة البيانات PostgreSQL
 * 
 * المميزات:
 * - يتحقق من وجود الجداول والأعمدة
 * - يضيف فقط ما هو مفقود
 * - لا يكرر الجداول أو الأعمدة الموجودة
 * - يضيف المفاتيح الأجنبية الناقصة
 * 
 * الاستخدام:
 *   node backend/scripts/sync.js
 * 
 * أو مع DATABASE_URL:
 *   DATABASE_URL=postgresql://... node backend/scripts/sync.js
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ خطأ: DATABASE_URL غير محدد');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

// تعريف جميع الجداول الأساسية مع أعمدتها
const tables = [
  {
    name: 'accounts',
    columns: [
      { name: 'id', type: 'SERIAL PRIMARY KEY' },
      { name: 'account_number', type: 'TEXT' },
      { name: 'account_code', type: 'TEXT' },
      { name: 'name', type: 'TEXT NOT NULL' },
      { name: 'name_en', type: 'TEXT' },
      { name: 'type', type: 'TEXT NOT NULL DEFAULT \'asset\'' },
      { name: 'nature', type: 'TEXT DEFAULT \'debit\'' },
      { name: 'parent_id', type: 'INTEGER' },
      { name: 'opening_balance', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'allow_manual_entry', type: 'BOOLEAN DEFAULT true' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
    ],
    foreignKeys: [
      { 
        column: 'parent_id', 
        refTable: 'accounts', 
        refColumn: 'id', 
        onDelete: 'SET NULL',
        constraintName: 'accounts_parent_id_fkey'
      }
    ]
  },
  {
    name: 'journal_entries',
    columns: [
      { name: 'id', type: 'SERIAL PRIMARY KEY' },
      { name: 'entry_number', type: 'INTEGER' },
      { name: 'description', type: 'TEXT' },
      { name: 'date', type: 'DATE' },
      { name: 'period', type: 'TEXT' },
      { name: 'reference_type', type: 'TEXT' },
      { name: 'reference_id', type: 'INTEGER' },
      { name: 'status', type: 'TEXT DEFAULT \'draft\'' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
    ]
  },
  {
    name: 'journal_postings',
    columns: [
      { name: 'id', type: 'SERIAL PRIMARY KEY' },
      { name: 'journal_entry_id', type: 'INTEGER NOT NULL' },
      { name: 'account_id', type: 'INTEGER NOT NULL' },
      { name: 'debit', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'credit', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'description', type: 'TEXT' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
    ],
    foreignKeys: [
      { 
        column: 'journal_entry_id', 
        refTable: 'journal_entries', 
        refColumn: 'id', 
        onDelete: 'CASCADE',
        constraintName: 'journal_postings_journal_entry_id_fkey'
      },
      { 
        column: 'account_id', 
        refTable: 'accounts', 
        refColumn: 'id',
        onDelete: 'RESTRICT',
        constraintName: 'journal_postings_account_id_fkey'
      }
    ]
  },
  {
    name: 'expenses',
    columns: [
      { name: 'id', type: 'SERIAL PRIMARY KEY' },
      { name: 'invoice_number', type: 'TEXT' },
      { name: 'type', type: 'TEXT' },
      { name: 'amount', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'total', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'account_code', type: 'TEXT' },
      { name: 'partner_id', type: 'INTEGER' },
      { name: 'description', type: 'TEXT' },
      { name: 'status', type: 'TEXT DEFAULT \'draft\'' },
      { name: 'branch', type: 'TEXT' },
      { name: 'date', type: 'DATE DEFAULT CURRENT_DATE' },
      { name: 'payment_method', type: 'TEXT DEFAULT \'cash\'' },
      { name: 'items', type: 'JSONB' },
      { name: 'journal_entry_id', type: 'INTEGER' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
    ],
    foreignKeys: [
      { 
        column: 'journal_entry_id', 
        refTable: 'journal_entries', 
        refColumn: 'id', 
        onDelete: 'SET NULL',
        constraintName: 'fk_expense_journal'
      }
    ]
  },
  {
    name: 'invoices',
    columns: [
      { name: 'id', type: 'SERIAL PRIMARY KEY' },
      { name: 'number', type: 'TEXT UNIQUE' },
      { name: 'date', type: 'DATE' },
      { name: 'customer_id', type: 'INTEGER' },
      { name: 'lines', type: 'JSONB' },
      { name: 'subtotal', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'discount_pct', type: 'NUMERIC(5,2) DEFAULT 0' },
      { name: 'discount_amount', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'tax_pct', type: 'NUMERIC(5,2) DEFAULT 0' },
      { name: 'tax_amount', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'total', type: 'NUMERIC(18,2) DEFAULT 0' },
      { name: 'payment_method', type: 'TEXT' },
      { name: 'status', type: 'TEXT DEFAULT \'draft\'' },
      { name: 'branch', type: 'TEXT' },
      { name: 'journal_entry_id', type: 'INTEGER' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' }
    ],
    foreignKeys: [
      { 
        column: 'journal_entry_id', 
        refTable: 'journal_entries', 
        refColumn: 'id', 
        onDelete: 'SET NULL',
        constraintName: 'fk_invoice_journal'
      }
    ]
  },
  {
    name: 'audit_log',
    columns: [
      { name: 'id', type: 'SERIAL PRIMARY KEY' },
      { name: 'user_id', type: 'INTEGER' },
      { name: 'user_email', type: 'VARCHAR(255)' },
      { name: 'action', type: 'VARCHAR(100) NOT NULL' },
      { name: 'target', type: 'VARCHAR(255)' },
      { name: 'payload', type: 'JSONB' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' }
    ]
  }
];

/**
 * التحقق من وجود جدول
 */
async function tableExists(tableName) {
  const result = await client.query(
    `SELECT to_regclass($1) as exists`,
    [tableName]
  );
  return result.rows[0].exists !== null;
}

/**
 * التحقق من وجود عمود في جدول
 */
async function columnExists(tableName, columnName) {
  const result = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND column_name = $2
  `, [tableName, columnName]);
  return result.rowCount > 0;
}

/**
 * التحقق من وجود Foreign Key
 */
async function foreignKeyExists(constraintName) {
  const result = await client.query(`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE constraint_name = $1 AND constraint_type = 'FOREIGN KEY'
  `, [constraintName]);
  return result.rowCount > 0;
}

/**
 * إنشاء جدول جديد
 */
async function createTable(table) {
  const cols = table.columns.map(c => `"${c.name}" ${c.type}`).join(', ');
  await client.query(`CREATE TABLE ${table.name} (${cols})`);
  console.log(`   ✔ Table ${table.name} created`);
}

/**
 * إضافة عمود مفقود
 */
async function addMissingColumn(tableName, column, tableDisplayName) {
  // Handle special cases for columns with constraints
  let alterQuery = `ALTER TABLE ${tableName} ADD COLUMN "${column.name}" ${column.type}`;
  
  // Remove PRIMARY KEY from ALTER TABLE (it's only for CREATE TABLE)
  alterQuery = alterQuery.replace('PRIMARY KEY', '');
  
  await client.query(alterQuery);
  console.log(`   ➕ Column ${column.name} added to ${tableDisplayName}`);
}

/**
 * إضافة Foreign Key
 */
async function addForeignKey(table, fk) {
  const constraintName = fk.constraintName || `fk_${table.name}_${fk.column}`;
  
  await client.query(`
    ALTER TABLE ${table.name} 
    ADD CONSTRAINT ${constraintName} 
    FOREIGN KEY (${fk.column}) 
    REFERENCES ${fk.refTable}(${fk.refColumn}) 
    ON DELETE ${fk.onDelete}
  `);
  console.log(`   🔗 Foreign key ${constraintName} added on ${table.name}.${fk.column}`);
}

/**
 * مزامنة جدول واحد
 */
async function syncTable(table) {
  const exists = await tableExists(table.name);
  
  if (!exists) {
    // إنشاء الجدول
    await createTable(table);
    
    // إضافة Foreign Keys بعد إنشاء الجدول
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const constraintName = fk.constraintName || `fk_${table.name}_${fk.column}`;
        if (!(await foreignKeyExists(constraintName))) {
          await addForeignKey(table, fk);
        }
      }
    }
  } else {
    // الجدول موجود - تحقق من الأعمدة الناقصة
    for (const col of table.columns) {
      // تخطي PRIMARY KEY في ALTER TABLE
      if (col.type.includes('PRIMARY KEY')) {
        continue;
      }
      
      if (!(await columnExists(table.name, col.name))) {
        await addMissingColumn(table.name, col, table.name);
      }
    }
    
    // تحقق من Foreign Keys الناقصة
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const constraintName = fk.constraintName || `fk_${table.name}_${fk.column}`;
        if (!(await foreignKeyExists(constraintName))) {
          await addForeignKey(table, fk);
        }
      }
    }
  }
}

/**
 * المزامنة الرئيسية
 */
async function sync() {
  try {
    console.log('🔌 الاتصال بقاعدة البيانات...');
    await client.connect();
    console.log('✅ تم الاتصال بنجاح!\n');
    
    console.log('🔄 بدء مزامنة الجداول...\n');
    
    for (const table of tables) {
      console.log(`📋 معالجة جدول: ${table.name}`);
      await syncTable(table);
    }
    
    console.log('\n✅✅ تمت مزامنة قاعدة البيانات بنجاح!');
    
    // عرض ملخص
    console.log('\n📊 الجداول المتزامنة:');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN (${tables.map(t => `'${t.name}'`).join(', ')})
      ORDER BY table_name
    `);
    
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('\n❌ خطأ في المزامنة:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 تم إغلاق الاتصال');
  }
}

// تشغيل المزامنة
sync();
