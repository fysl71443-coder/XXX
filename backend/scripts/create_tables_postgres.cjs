const { Client } = require('pg');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(
    'CREATE TABLE IF NOT EXISTS "Account" (' +
      'id SERIAL PRIMARY KEY,' +
      'account_number TEXT NOT NULL UNIQUE,' +
      'name TEXT NOT NULL,' +
      'type TEXT NOT NULL,' +
      'nature TEXT NOT NULL,' +
      'parent_id INTEGER,' +
      'opening_balance NUMERIC NOT NULL DEFAULT 0,' +
      'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),' +
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),' +
      'CONSTRAINT "Account_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES "Account"(id) ON DELETE SET NULL ON UPDATE CASCADE' +
    ')'
  );
  await client.query(
    'CREATE TABLE IF NOT EXISTS "JournalEntry" (' +
      'id SERIAL PRIMARY KEY,' +
      'entry_number INTEGER NOT NULL UNIQUE,' +
      'description TEXT NOT NULL,' +
      'date TIMESTAMPTZ NOT NULL,' +
      'reference_type TEXT,' +
      'reference_id INTEGER,' +
      'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()' +
    ')'
  );
  await client.query(
    'CREATE TABLE IF NOT EXISTS "JournalPosting" (' +
      'id SERIAL PRIMARY KEY,' +
      'journal_entry_id INTEGER NOT NULL,' +
      'account_id INTEGER NOT NULL,' +
      'debit NUMERIC NOT NULL DEFAULT 0,' +
      'credit NUMERIC NOT NULL DEFAULT 0,' +
      'CONSTRAINT "JournalPosting_journal_entry_id_fkey" FOREIGN KEY (journal_entry_id) REFERENCES "JournalEntry"(id) ON DELETE RESTRICT ON UPDATE CASCADE,' +
      'CONSTRAINT "JournalPosting_account_id_fkey" FOREIGN KEY (account_id) REFERENCES "Account"(id) ON DELETE RESTRICT ON UPDATE CASCADE' +
    ')'
  );
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });

