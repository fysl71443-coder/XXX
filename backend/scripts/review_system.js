/**
 * System Review Script
 * Comprehensive review of database schema, data integrity, and API endpoints
 * 
 * Usage: node backend/scripts/review_system.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';
const pool = new Pool({ connectionString: DATABASE_URL });

const report = {
  timestamp: new Date().toISOString(),
  database: {},
  tables: {},
  data: {},
  issues: [],
  recommendations: []
};

async function reviewDatabaseSchema() {
  console.log('\n📊 Reviewing Database Schema...\n');
  
  try {
    // Get all tables
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    report.database.totalTables = tables.length;
    report.database.tables = tables.map(t => t.table_name);
    
    console.log(`Found ${tables.length} tables:`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Review each table
    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`\n🔍 Reviewing table: ${tableName}`);
      
      const tableInfo = {
        name: tableName,
        columns: [],
        constraints: [],
        indexes: [],
        rowCount: 0,
        issues: []
      };
      
      // Get columns
      const { rows: columns } = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      tableInfo.columns = columns;
      
      // Get constraints (PK, FK, UNIQUE)
      const { rows: constraints } = await pool.query(`
        SELECT 
          constraint_name,
          constraint_type
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [tableName]);
      
      tableInfo.constraints = constraints;
      
      // Get row count
      try {
        const { rows: countRows } = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        tableInfo.rowCount = parseInt(countRows[0].count);
      } catch (e) {
        tableInfo.issues.push(`Cannot count rows: ${e.message}`);
      }
      
      // Check for common issues
      if (tableInfo.rowCount === 0 && ['accounts', 'products', 'branches'].includes(tableName)) {
        tableInfo.issues.push('Table is empty - may need seed data');
      }
      
      // Check for missing timestamps
      const hasCreatedAt = columns.some(c => c.column_name === 'created_at');
      const hasUpdatedAt = columns.some(c => c.column_name === 'updated_at');
      if (!hasCreatedAt && !['settings', 'journal_entries'].includes(tableName)) {
        tableInfo.issues.push('Missing created_at column');
      }
      if (!hasUpdatedAt && !['settings', 'journal_entries'].includes(tableName)) {
        tableInfo.issues.push('Missing updated_at column');
      }
      
      report.tables[tableName] = tableInfo;
      
      console.log(`  Columns: ${columns.length}`);
      console.log(`  Constraints: ${constraints.length}`);
      console.log(`  Rows: ${tableInfo.rowCount}`);
      if (tableInfo.issues.length > 0) {
        console.log(`  ⚠️  Issues: ${tableInfo.issues.length}`);
        tableInfo.issues.forEach(issue => console.log(`    - ${issue}`));
      }
    }
    
  } catch (e) {
    console.error('Error reviewing database schema:', e);
    report.issues.push(`Database schema review error: ${e.message}`);
  }
}

async function reviewDataIntegrity() {
  console.log('\n🔍 Reviewing Data Integrity...\n');
  
  try {
    // Check accounts
    const { rows: accounts } = await pool.query('SELECT COUNT(*) as count FROM accounts');
    const accountCount = parseInt(accounts[0].count);
    report.data.accounts = { count: accountCount };
    
    if (accountCount === 0) {
      report.issues.push('No accounts found - chart of accounts may be missing');
      report.recommendations.push('Run seed script to populate accounts');
    } else {
      console.log(`✅ Accounts: ${accountCount}`);
      
      // Check for required accounts
      const { rows: requiredAccounts } = await pool.query(`
        SELECT account_number, name 
        FROM accounts 
        WHERE account_number IN ('1111', '1121', '1141', '2111', '4100', '5100', '5200')
      `);
      
      const requiredNumbers = ['1111', '1121', '1141', '2111', '4100', '5100', '5200'];
      const foundNumbers = requiredAccounts.map(a => a.account_number);
      const missing = requiredNumbers.filter(n => !foundNumbers.includes(n));
      
      if (missing.length > 0) {
        report.issues.push(`Missing required accounts: ${missing.join(', ')}`);
        console.log(`  ⚠️  Missing accounts: ${missing.join(', ')}`);
      } else {
        console.log(`  ✅ All required accounts present`);
      }
    }
    
    // Check products
    const { rows: products } = await pool.query('SELECT COUNT(*) as count FROM products');
    const productCount = parseInt(products[0].count);
    report.data.products = { count: productCount };
    
    if (productCount === 0) {
      report.issues.push('No products found');
      report.recommendations.push('Import products from products-import.json');
    } else {
      console.log(`✅ Products: ${productCount}`);
    }
    
    // Check employees
    const { rows: employees } = await pool.query('SELECT COUNT(*) as count FROM employees');
    const employeeCount = parseInt(employees[0].count);
    report.data.employees = { count: employeeCount };
    console.log(`✅ Employees: ${employeeCount}`);
    
    // Check orders
    const { rows: orders } = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM orders 
      GROUP BY status
    `);
    report.data.orders = orders;
    console.log(`✅ Orders by status:`);
    orders.forEach(o => console.log(`  - ${o.status}: ${o.count}`));
    
    // Check orders with lines
    const { rows: ordersWithLines } = await pool.query(`
      SELECT 
        id,
        branch,
        table_code,
        status,
        CASE 
          WHEN lines IS NULL THEN 0
          WHEN jsonb_typeof(lines) = 'array' THEN jsonb_array_length(lines)
          ELSE 1
        END as lines_count
      FROM orders 
      WHERE status = 'DRAFT'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📦 Recent DRAFT orders:`);
    ordersWithLines.forEach(o => {
      console.log(`  Order ${o.id} (${o.branch}, table ${o.table_code}): ${o.lines_count} lines`);
      if (o.lines_count === 0) {
        report.issues.push(`Order ${o.id} has no lines`);
      }
    });
    
    // Check partners
    const { rows: partners } = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count
      FROM partners 
      GROUP BY type
    `);
    report.data.partners = partners;
    console.log(`\n✅ Partners by type:`);
    partners.forEach(p => console.log(`  - ${p.type}: ${p.count}`));
    
  } catch (e) {
    console.error('Error reviewing data integrity:', e);
    report.issues.push(`Data integrity review error: ${e.message}`);
  }
}

async function reviewRelationships() {
  console.log('\n🔗 Reviewing Table Relationships...\n');
  
  try {
    // Check foreign keys
    const { rows: foreignKeys } = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    console.log(`Found ${foreignKeys.length} foreign key relationships:`);
    foreignKeys.forEach(fk => {
      console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
    report.database.foreignKeys = foreignKeys;
    
    // Check for orphaned records
    console.log(`\n🔍 Checking for orphaned records...`);
    
    // Check orders without valid branch
    const { rows: orphanedOrders } = await pool.query(`
      SELECT COUNT(*) as count
      FROM orders o
      WHERE o.branch IS NULL OR o.branch = ''
    `);
    if (parseInt(orphanedOrders[0].count) > 0) {
      report.issues.push(`${orphanedOrders[0].count} orders without branch`);
      console.log(`  ⚠️  ${orphanedOrders[0].count} orders without branch`);
    }
    
    // Check partners without account_id (if they should have one)
    const { rows: partnersWithoutAccount } = await pool.query(`
      SELECT COUNT(*) as count
      FROM partners
      WHERE type IN ('customer', 'supplier')
      AND account_id IS NULL
    `);
    if (parseInt(partnersWithoutAccount[0].count) > 0) {
      console.log(`  ℹ️  ${partnersWithoutAccount[0].count} partners without account_id (may be created on-demand)`);
    }
    
  } catch (e) {
    console.error('Error reviewing relationships:', e);
    report.issues.push(`Relationship review error: ${e.message}`);
  }
}

async function generateReport() {
  console.log('\n📝 Generating Report...\n');
  
  const reportPath = path.join(__dirname, '..', 'system_review_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`✅ Report saved to: ${reportPath}`);
  
  // Generate summary
  console.log('\n📊 Summary:');
  console.log(`  Tables reviewed: ${Object.keys(report.tables).length}`);
  console.log(`  Issues found: ${report.issues.length}`);
  console.log(`  Recommendations: ${report.recommendations.length}`);
  
  if (report.issues.length > 0) {
    console.log('\n⚠️  Issues:');
    report.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
}

async function main() {
  console.log('🚀 Starting System Review...\n');
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);
  
  try {
    await reviewDatabaseSchema();
    await reviewDataIntegrity();
    await reviewRelationships();
    await generateReport();
    
    console.log('\n✅ System review completed!');
  } catch (e) {
    console.error('\n❌ Review failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { reviewDatabaseSchema, reviewDataIntegrity, reviewRelationships };
