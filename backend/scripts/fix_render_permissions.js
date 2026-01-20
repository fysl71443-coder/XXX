import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

/**
 * Script to fix permissions on Render production
 * 
 * This script:
 * 1. Checks if user exists and has admin role
 * 2. Updates user role to 'admin' if needed
 * 3. Verifies admin permissions are working
 * 
 * Usage:
 *   DATABASE_URL="your_render_db_url" node backend/scripts/fix_render_permissions.js [email]
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function fixRenderPermissions(email = null) {
  try {
    console.log('=== إصلاح الصلاحيات على Render ===\n');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ خطأ: يجب توفير DATABASE_URL');
      console.log('   Usage: DATABASE_URL="your_db_url" node backend/scripts/fix_render_permissions.js [email]');
      process.exit(1);
    }

    // Get user by email or get first user
    let query, params;
    if (email) {
      query = 'SELECT id, email, role, is_active FROM users WHERE email = $1 LIMIT 1';
      params = [email];
    } else {
      query = 'SELECT id, email, role, is_active FROM users ORDER BY id LIMIT 1';
      params = [];
    }

    const { rows: users } = await pool.query(query, params);

    if (users.length === 0) {
      console.error('❌ لم يتم العثور على مستخدم');
      if (email) {
        console.error(`   Email: ${email}`);
      }
      process.exit(1);
    }

    const user = users[0];
    console.log(`📋 المستخدم الحالي:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role || '(null)'}`);
    console.log(`   Active: ${user.is_active !== false ? 'Yes ✅' : 'No ❌'}\n`);

    // Check if user is admin
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    
    if (isAdmin) {
      console.log('✅ المستخدم لديه صلاحيات admin بالفعل');
      console.log('   لا حاجة لتعديل الصلاحيات\n');
    } else {
      console.log('⚠️  المستخدم ليس admin');
      console.log('   جاري تحديث role إلى "admin"...\n');
      
      await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['admin', user.id]
      );
      
      console.log('✅ تم تحديث role إلى "admin" بنجاح\n');
    }

    // Verify admin status
    const { rows: verify } = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [user.id]
    );

    if (verify.length > 0 && String(verify[0].role || '').toLowerCase() === 'admin') {
      console.log('✅ التحقق: المستخدم الآن admin');
      console.log(`   Email: ${verify[0].email}`);
      console.log(`   Role: ${verify[0].role}\n`);
    } else {
      console.error('❌ فشل التحقق: المستخدم لا يزال ليس admin');
      process.exit(1);
    }

    // List all users for reference
    const { rows: allUsers } = await pool.query(
      'SELECT id, email, role, is_active FROM users ORDER BY id'
    );

    console.log('📋 جميع المستخدمين:');
    allUsers.forEach((u, i) => {
      const adminBadge = String(u.role || '').toLowerCase() === 'admin' ? ' 👑' : '';
      const activeBadge = u.is_active !== false ? '✅' : '❌';
      console.log(`   ${i + 1}. ${u.email} (ID: ${u.id}) - Role: ${u.role || '(null)'}${adminBadge} ${activeBadge}`);
    });

    console.log('\n✅ تم الانتهاء بنجاح!');
    console.log('\n💡 ملاحظات:');
    console.log('   - Admin لديه صلاحيات كاملة (bypass لجميع الصلاحيات)');
    console.log('   - بعد تسجيل الدخول، يجب أن يعمل كل شيء بشكل صحيح');
    console.log('   - إذا استمرت المشكلة، تأكد من أن JWT_SECRET صحيح على Render');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get email from command line args
const email = process.argv[2] || null;
fixRenderPermissions(email);
