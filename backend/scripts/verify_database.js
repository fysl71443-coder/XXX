import pg from 'pg';
const { Client } = pg;

// Get DATABASE_URL from environment or use provided connection string
// For Render: Set DATABASE_URL in environment variables
// For local testing: Use the connection string provided
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required!');
  console.error('   Usage: node verify_database.js [DATABASE_URL]');
  console.error('   Or set DATABASE_URL environment variable');
  console.error('');
  console.error('   Example:');
  console.error('   DATABASE_URL="postgresql://..." node verify_database.js');
  process.exit(1);
}

const REQUIRED_TABLES = [
  'users',
  'user_permissions',
  'settings',
  'partners',
  'employees',
  'expenses',
  'supplier_invoices',
  'invoices',
  'orders',
  'payments',
  'Account',
  'JournalEntry',
  'JournalPosting'
];

const REQUIRED_USER_COLUMNS = [
  'id', 'email', 'password', 'role', 'default_branch', 'created_at', 'is_active'
];

async function verifyDatabase() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const report = {
      connection: 'OK',
      adminUser: null,
      tables: {},
      issues: [],
      recommendations: []
    };

    // 1. Check Admin User
    console.log('📋 Checking admin user...');
    try {
      const { rows: adminUsers } = await client.query(
        "SELECT id, email, role, default_branch, created_at, is_active FROM users WHERE role = 'admin' OR role = 'Admin' OR role = 'ADMIN'"
      );
      
      if (adminUsers.length === 0) {
        report.issues.push('❌ No admin user found in database');
        report.recommendations.push('Run: node backend/createAdmin.js to create admin user');
      } else {
        const admin = adminUsers[0];
        report.adminUser = {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          default_branch: admin.default_branch,
          created_at: admin.created_at,
          is_active: admin.is_active
        };
        console.log(`✅ Admin user found: ${admin.email} (ID: ${admin.id}, Role: ${admin.role})`);
        
        // Check if role is exactly 'admin' (lowercase)
        if (admin.role !== 'admin') {
          report.issues.push(`⚠️ Admin role is '${admin.role}' but should be 'admin' (lowercase)`);
          report.recommendations.push(`UPDATE users SET role = 'admin' WHERE id = ${admin.id}`);
        }
      }
    } catch (e) {
      report.issues.push(`❌ Error checking admin user: ${e.message}`);
    }
    console.log('');

    // 2. Check Users Table Structure
    console.log('📋 Checking users table structure...');
    try {
      const { rows: columns } = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const existingColumns = columns.map(c => c.column_name);
      const missingColumns = REQUIRED_USER_COLUMNS.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        report.issues.push(`❌ Missing columns in users table: ${missingColumns.join(', ')}`);
        report.recommendations.push(`Add missing columns: ${missingColumns.join(', ')}`);
      } else {
        console.log('✅ All required columns exist in users table');
      }
      
      report.tables.users = {
        columns: existingColumns,
        missing: missingColumns
      };
    } catch (e) {
      report.issues.push(`❌ Error checking users table: ${e.message}`);
    }
    console.log('');

    // 3. Check All Required Tables
    console.log('📋 Checking required tables...');
    for (const tableName of REQUIRED_TABLES) {
      try {
        const { rows: exists } = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName]);
        
        if (exists[0].exists) {
          const { rows: count } = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          report.tables[tableName] = { exists: true, rowCount: parseInt(count[0].count) };
          console.log(`✅ Table '${tableName}' exists (${count[0].count} rows)`);
        } else {
          report.tables[tableName] = { exists: false, rowCount: 0 };
          report.issues.push(`❌ Table '${tableName}' does not exist`);
          report.recommendations.push(`Create table '${tableName}' using ensureSchema() or migration`);
        }
      } catch (e) {
        report.tables[tableName] = { exists: false, error: e.message };
        report.issues.push(`❌ Error checking table '${tableName}': ${e.message}`);
      }
    }
    console.log('');

    // 4. Check user_permissions Table
    console.log('📋 Checking user_permissions table...');
    try {
      const { rows: permCount } = await client.query('SELECT COUNT(*) as count FROM user_permissions');
      const { rows: adminPerms } = await client.query(
        'SELECT COUNT(*) as count FROM user_permissions WHERE user_id = $1',
        [report.adminUser?.id || 0]
      );
      
      console.log(`✅ user_permissions table: ${permCount[0].count} total permissions`);
      console.log(`   Admin permissions: ${adminPerms[0].count}`);
      
      if (report.adminUser && parseInt(adminPerms[0].count) === 0) {
        console.log('ℹ️  Admin has no explicit permissions (this is OK - admin bypass works)');
      }
    } catch (e) {
      report.issues.push(`❌ Error checking user_permissions: ${e.message}`);
    }
    console.log('');

    // 5. Check Settings Table
    console.log('📋 Checking settings table...');
    try {
      const { rows: settingsCount } = await client.query('SELECT COUNT(*) as count FROM settings');
      console.log(`✅ Settings table: ${settingsCount[0].count} settings`);
    } catch (e) {
      report.issues.push(`❌ Error checking settings: ${e.message}`);
    }
    console.log('');

    // 6. Check Database Connection Pool
    console.log('📋 Checking database connection pool...');
    try {
      const { rows: version } = await client.query('SELECT version()');
      console.log(`✅ Database version: ${version[0].version.split(' ')[0]} ${version[0].version.split(' ')[1]}`);
    } catch (e) {
      report.issues.push(`❌ Error checking database version: ${e.message}`);
    }
    console.log('');

    // 7. Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (report.issues.length === 0) {
      console.log('✅ All checks passed! Database is properly configured.');
    } else {
      console.log(`⚠️  Found ${report.issues.length} issue(s):`);
      report.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    
    // Save report to file
    const fs = await import('fs');
    fs.writeFileSync('database_verification_report.json', JSON.stringify(report, null, 2));
    console.log('📄 Full report saved to: database_verification_report.json');
    
    return report;
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run verification
verifyDatabase()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
