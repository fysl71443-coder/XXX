const { Client } = require('pg');

async function tableExists(client, name) {
  const { rows } = await client.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS ex",
    [name]
  );
  return !!(rows && rows[0] && rows[0].ex);
}

async function countRows(client, name) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM "${name}"`);
  return rows && rows[0] ? rows[0].c : 0;
}

async function sampleRows(client, name, limit = 10) {
  const { rows } = await client.query(`SELECT * FROM "${name}" ORDER BY 1 DESC LIMIT ${limit}`);
  return rows || [];
}

async function columns(client, name) {
  const { rows } = await client.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
    [name]
  );
  return rows || [];
}

async function main() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) {
    console.error('DATABASE_URL is required (env or arg)');
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const report = { database_url: url, tables: [] };

  const { rows: tbls } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  const tableNames = tbls.map(r => r.table_name);

  for (const name of tableNames) {
    try {
      const cols = await columns(client, name);
      const cnt = await countRows(client, name);
      const samples = cnt > 0 ? await sampleRows(client, name, 10) : [];
      report.tables.push({ name, columns: cols, count: cnt, sample: samples });
    } catch (e) {
      report.tables.push({ name, error: e.message });
    }
  }

  const focus = ['users','user_permissions','partners','employees','expenses','settings'];
  for (const f of focus) {
    try {
      if (!(await tableExists(client, f))) continue;
      const cnt = await countRows(client, f);
      const samples = cnt > 0 ? await sampleRows(client, f, 10) : [];
      report[`_${f}`] = { count: cnt, sample: samples };
    } catch {}
  }

  console.log(JSON.stringify(report, null, 2));
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
