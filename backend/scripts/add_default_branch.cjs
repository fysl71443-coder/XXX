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
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS default_branch TEXT');
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
    await client.query('UPDATE "users" SET default_branch = COALESCE(default_branch, $1)', ['china_town']);
    console.log('users table updated with default_branch and is_active');
    await client.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
