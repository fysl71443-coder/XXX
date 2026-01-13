const { Client } = require('pg');

async function upsertPerms(client, rows) {
  for (const r of rows) {
    await client.query(
      'INSERT INTO user_permissions(user_id, screen_code, branch_code, action_code, allowed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, screen_code, branch_code, action_code) DO UPDATE SET allowed = EXCLUDED.allowed',
      [r.user_id, String(r.screen_code).toLowerCase(), String(r.branch_code||''), String(r.action_code).toLowerCase(), !!r.allowed]
    );
  }
}

function permsForUser(userId, branches = ['china_town']) {
  const screens = ['clients','suppliers','employees','expenses','products','sales','purchases','reports','accounting','journal','settings'];
  const actions = ['view','create','edit','delete','settings'];
  const rows = [];
  for (const sc of screens) {
    for (const ac of actions) rows.push({ user_id: userId, screen_code: sc, branch_code: '', action_code: ac, allowed: true });
  }
  for (const br of branches) {
    for (const ac of ['view','create','edit','delete']) rows.push({ user_id: userId, screen_code: 'sales', branch_code: br, action_code: ac, allowed: true });
    for (const ac of ['view','create','edit','delete']) rows.push({ user_id: userId, screen_code: 'purchases', branch_code: br, action_code: ac, allowed: true });
  }
  return rows;
}

async function seedPartners(client) {
  const cashInfo = { walk_in: true };
  await client.query(
    'INSERT INTO partners(name, type, email, phone, customer_type, contact_info) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
    ['عميل نقدي', 'customer', null, null, 'نقدي', cashInfo]
  );
  await client.query(
    'INSERT INTO partners(name, type, email, phone) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
    ['مورد عام', 'supplier', null, null]
  );
}

async function seedEmployees(client) {
  await client.query(
    'INSERT INTO employees(first_name,last_name,employee_number,status,phone,email) VALUES ($1,$2,$3,$4,$5,$6)',
    ['Test','Employee','EMP001','active','0500000000','emp1@example.com']
  );
}

async function seedExpenses(client) {
  await client.query(
    'INSERT INTO expenses(type, amount, account_code, description, status, branch) VALUES ($1,$2,$3,$4,$5,$6)',
    ['expense', 150.00, '6100', 'Office supplies', 'draft', 'china_town']
  );
}

async function run() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) { console.error('DATABASE_URL required'); process.exit(1); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows: users } = await client.query('SELECT id, email, role FROM "users" WHERE role = $1 OR role = $2', ['admin','Admin']);
    const ids = users.map(u => u.id);
    const branches = ['china_town'];
    for (const id of ids) {
      const rows = permsForUser(id, branches);
      await upsertPerms(client, rows);
    }
    await seedPartners(client);
    await seedEmployees(client);
    await seedExpenses(client);
    console.log('Seed completed for users:', ids);
  } finally {
    await client.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
