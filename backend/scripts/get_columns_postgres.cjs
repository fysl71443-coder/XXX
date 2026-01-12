const { Client } = require('pg');

async function run(table) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
    [table]
  );
  console.log(rows.map(r => `${r.column_name}:${r.data_type}`).join('\n'));
  await client.end();
}

const table = process.argv[2] || 'users';
run(table).catch(e => { console.error(e); process.exit(1); });

