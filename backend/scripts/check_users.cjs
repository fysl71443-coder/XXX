const { Client } = require('pg');

async function run() {
  try {
    const url = process.env.DATABASE_URL || process.argv[2] || '';
    if (!url) {
      console.error('DATABASE_URL is required (env or arg)');
      process.exit(1);
    }
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const { rows } = await client.query('SELECT id, email, role, is_active, default_branch, created_at FROM "users" ORDER BY id DESC');
    console.log(JSON.stringify(rows, null, 2));
    await client.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
