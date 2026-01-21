import { pool } from '../db.js';
import bcrypt from 'bcrypt';

async function testLogin() {
  try {
    const email = 'fysl71443@gmail.com';
    const password = 'StrongPass123';
    
    // Get user from database
    const { rows } = await pool.query(
      'SELECT id, email, password, role FROM "users" WHERE email = $1 LIMIT 1',
      [email]
    );
    
    if (!rows || rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    const user = rows[0];
    console.log('✅ User found:', { id: user.id, email: user.email, role: user.role });
    console.log('Password hash length:', user.password?.length || 0);
    
    // Test password comparison
    const match = await bcrypt.compare(password, user.password || '');
    console.log('Password match:', match ? '✅ YES' : '❌ NO');
    
    if (!match) {
      console.log('\n⚠️ Password mismatch! Updating password...');
      const newHash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE "users" SET password = $1 WHERE email = $2', [newHash, email]);
      console.log('✅ Password updated. Try logging in again.');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

testLogin();
