import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required!');
  console.error('   Usage: node check_admin.js [DATABASE_URL]');
  console.error('   Or set DATABASE_URL environment variable');
  process.exit(1);
}

async function checkAdmin() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check admin user
    const { rows: admins } = await client.query(`
      SELECT id, email, role, default_branch, created_at, is_active 
      FROM users 
      WHERE LOWER(role) = 'admin'
      ORDER BY id
    `);

    if (admins.length === 0) {
      console.log('❌ No admin user found!');
      console.log('\n💡 To create admin user, run:');
      console.log('   node backend/createAdmin.js');
      process.exit(1);
    }

    console.log(`✅ Found ${admins.length} admin user(s):\n`);
    admins.forEach((admin, i) => {
      console.log(`   ${i + 1}. ID: ${admin.id}`);
      console.log(`      Email: ${admin.email}`);
      console.log(`      Role: ${admin.role} ${admin.role !== 'admin' ? '⚠️ (should be lowercase "admin")' : '✅'}`);
      console.log(`      Default Branch: ${admin.default_branch || 'null'}`);
      console.log(`      Active: ${admin.is_active !== false ? 'Yes ✅' : 'No ❌'}`);
      console.log(`      Created: ${admin.created_at}`);
      console.log('');
    });

    // Check if role needs fixing
    const needsFix = admins.some(a => a.role !== 'admin');
    if (needsFix) {
      console.log('⚠️  Some admin users have incorrect role casing.');
      console.log('💡 To fix, run:');
      admins.forEach(admin => {
        if (admin.role !== 'admin') {
          console.log(`   UPDATE users SET role = 'admin' WHERE id = ${admin.id};`);
        }
      });
    }

    // Check permissions
    const adminIds = admins.map(a => a.id);
    const { rows: permCounts } = await client.query(`
      SELECT user_id, COUNT(*) as count 
      FROM user_permissions 
      WHERE user_id = ANY($1::int[])
      GROUP BY user_id
    `, [adminIds]);

    console.log('📋 Admin Permissions:');
    if (permCounts.length === 0) {
      console.log('   ✅ No explicit permissions (admin bypass works - this is OK)');
    } else {
      permCounts.forEach(pc => {
        const admin = admins.find(a => a.id === pc.user_id);
        console.log(`   Admin ${admin?.email}: ${pc.count} permissions`);
      });
    }

    console.log('\n✅ Admin check complete!');
  } catch (error) {
    console.error('❌ Error checking admin:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAdmin();
