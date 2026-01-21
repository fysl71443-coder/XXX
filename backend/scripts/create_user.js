import { pool } from '../db.js';
import bcrypt from 'bcrypt';

async function createUser() {
  try {
    const email = 'fysl71443@gmail.com';
    const password = 'StrongPass123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const { rows: existing } = await pool.query('SELECT id FROM "users" WHERE email = $1 LIMIT 1', [email]);
    
    if (existing && existing.length > 0) {
      // Update existing user
      await pool.query('UPDATE "users" SET password = $1, role = $2 WHERE email = $3', [hashedPassword, 'admin', email]);
      console.log(`✅ Updated user: ${email}`);
    } else {
      // Create new user
      await pool.query('INSERT INTO "users" (email, password, role) VALUES ($1, $2, $3)', [email, hashedPassword, 'admin']);
      console.log(`✅ Created user: ${email}`);
    }
    
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Role: admin`);
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

createUser();
