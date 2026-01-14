import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required!');
  process.exit(1);
}

async function createPermissionsSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    await client.query('BEGIN');

    // 1. Create roles table
    console.log('📋 Creating roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Roles table created');

    // 2. Create screens table
    console.log('📋 Creating screens table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS screens (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Screens table created');

    // 3. Create actions table
    console.log('📋 Creating actions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS actions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Actions table created');

    // 4. Create role_permissions table
    console.log('📋 Creating role_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
        action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (role_id, screen_id, action_id)
      )
    `);
    console.log('✅ Role_permissions table created');

    // 5. Update user_permissions to use new structure (optional - for user-specific overrides)
    console.log('📋 Updating user_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions_new (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
        action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        allowed BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, screen_id, action_id)
      )
    `);
    console.log('✅ User_permissions_new table created');

    // 6. Create audit_log table
    console.log('📋 Creating audit_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        screen_code TEXT,
        action_code TEXT,
        allowed BOOLEAN NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)');
    console.log('✅ Audit_log table created');

    // 7. Add role_id to users table if not exists
    console.log('📋 Updating users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL
    `);
    console.log('✅ Users table updated');

    // 8. Seed default roles
    console.log('📋 Seeding default roles...');
    const roles = [
      { name: 'admin', description: 'System administrator with full access' },
      { name: 'manager', description: 'Manager with elevated permissions' },
      { name: 'employee', description: 'Regular employee with limited permissions' }
    ];
    
    for (const role of roles) {
      await client.query(`
        INSERT INTO roles (name, description) 
        VALUES ($1, $2) 
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      `, [role.name, role.description]);
    }
    console.log('✅ Default roles seeded');

    // 9. Seed default screens
    console.log('📋 Seeding default screens...');
    const screens = [
      { name: 'Clients', code: 'clients', description: 'Client management' },
      { name: 'Suppliers', code: 'suppliers', description: 'Supplier management' },
      { name: 'Employees', code: 'employees', description: 'Employee management' },
      { name: 'Expenses', code: 'expenses', description: 'Expense management' },
      { name: 'Products', code: 'products', description: 'Product management' },
      { name: 'Sales', code: 'sales', description: 'Sales and POS' },
      { name: 'Purchases', code: 'purchases', description: 'Purchase management' },
      { name: 'Accounting', code: 'accounting', description: 'Accounting and ledger' },
      { name: 'Journal', code: 'journal', description: 'Journal entries' },
      { name: 'Reports', code: 'reports', description: 'Reports and analytics' },
      { name: 'Settings', code: 'settings', description: 'System settings' }
    ];

    for (const screen of screens) {
      await client.query(`
        INSERT INTO screens (name, code, description) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
      `, [screen.name, screen.code, screen.description]);
    }
    console.log('✅ Default screens seeded');

    // 10. Seed default actions
    console.log('📋 Seeding default actions...');
    const actions = [
      { name: 'View', code: 'view', description: 'View records' },
      { name: 'Create', code: 'create', description: 'Create new records' },
      { name: 'Edit', code: 'edit', description: 'Edit existing records' },
      { name: 'Delete', code: 'delete', description: 'Delete records' },
      { name: 'Export', code: 'export', description: 'Export data' },
      { name: 'Approve', code: 'approve', description: 'Approve transactions' },
      { name: 'Post', code: 'post', description: 'Post journal entries' }
    ];

    for (const action of actions) {
      await client.query(`
        INSERT INTO actions (name, code, description) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
      `, [action.name, action.code, action.description]);
    }
    console.log('✅ Default actions seeded');

    // 11. Migrate existing admin users to new role system
    console.log('📋 Migrating existing admin users...');
    const { rows: adminRole } = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    if (adminRole.length > 0) {
      await client.query(`
        UPDATE users 
        SET role_id = $1 
        WHERE role = 'admin' AND role_id IS NULL
      `, [adminRole[0].id]);
      console.log('✅ Admin users migrated');
    }

    // 12. Grant admin role all permissions
    console.log('📋 Granting admin all permissions...');
    const { rows: allScreens } = await client.query('SELECT id FROM screens');
    const { rows: allActions } = await client.query('SELECT id FROM actions');
    
    if (adminRole.length > 0 && allScreens.length > 0 && allActions.length > 0) {
      for (const screen of allScreens) {
        for (const action of allActions) {
          await client.query(`
            INSERT INTO role_permissions (role_id, screen_id, action_id) 
            VALUES ($1, $2, $3) 
            ON CONFLICT DO NOTHING
          `, [adminRole[0].id, screen.id, action.id]);
        }
      }
      console.log(`✅ Admin granted ${allScreens.length * allActions.length} permissions`);
    }

    await client.query('COMMIT');
    console.log('\n✅ All tables created and seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Roles: ${roles.length}`);
    console.log(`   - Screens: ${screens.length}`);
    console.log(`   - Actions: ${actions.length}`);
    console.log(`   - Admin permissions: ${allScreens.length * allActions.length}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

createPermissionsSchema()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
