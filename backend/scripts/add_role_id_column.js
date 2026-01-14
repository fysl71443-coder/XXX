import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required!');
  process.exit(1);
}

async function addRoleIdColumn() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    await client.query('BEGIN');

    // Check if roles table exists
    console.log('📋 Checking if roles table exists...');
    const { rows: rolesExists } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'roles'
      )
    `);

    if (!rolesExists[0].exists) {
      console.log('⚠️  Roles table does not exist. Creating it first...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      // Insert default admin role
      await client.query(`
        INSERT INTO roles (name, description) 
        VALUES ('admin', 'System administrator with full access')
        ON CONFLICT (name) DO NOTHING
      `);
      console.log('✅ Roles table created with admin role');
    }

    // Add role_id column to users table
    console.log('📋 Adding role_id column to users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL
    `);
    console.log('✅ role_id column added');

    // Migrate existing admin users
    console.log('📋 Migrating existing admin users...');
    const { rows: adminRole } = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    
    if (adminRole.length > 0) {
      const { rowCount } = await client.query(`
        UPDATE users 
        SET role_id = $1 
        WHERE role = 'admin' AND role_id IS NULL
      `, [adminRole[0].id]);
      console.log(`✅ Migrated ${rowCount} admin user(s) to role_id`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!');
    
    // Verify
    const { rows: verify } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role_id'
    `);
    
    if (verify.length > 0) {
      console.log('✅ Verification: role_id column exists');
    } else {
      console.log('❌ Verification failed: role_id column not found');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

addRoleIdColumn()
  .then(() => {
    console.log('\n✅ Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
