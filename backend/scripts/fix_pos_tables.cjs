/**
 * Script to fix missing pos_tables entries
 * Creates pos_tables entries for all tables that have orders but no pos_tables entry
 */

const { Client } = require('pg');

async function fixPosTables() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) {
    console.error('❌ DATABASE_URL required');
    console.error('Usage: node fix_pos_tables.cjs <DATABASE_URL>');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get all unique branch + table_code combinations from orders
    const ordersQuery = `
      SELECT DISTINCT branch, table_code 
      FROM orders 
      WHERE table_code IS NOT NULL 
        AND table_code != ''
        AND status IN ('DRAFT', 'OPEN')
      ORDER BY branch, table_code
    `;
    
    const { rows: orderRows } = await client.query(ordersQuery);
    console.log(`\n📊 Found ${orderRows.length} unique table combinations in orders table`);

    if (orderRows.length === 0) {
      console.log('✅ No orders found - nothing to fix');
      return;
    }

    // Get existing pos_tables entries
    const existingQuery = `
      SELECT branch, table_code 
      FROM pos_tables 
      ORDER BY branch, table_code
    `;
    
    const { rows: existingRows } = await client.query(existingQuery);
    const existingSet = new Set(
      existingRows.map(r => `${r.branch}|${r.table_code}`)
    );
    console.log(`📊 Found ${existingRows.length} existing pos_tables entries`);

    // Find missing entries
    const missing = orderRows.filter(row => {
      const key = `${row.branch}|${row.table_code}`;
      return !existingSet.has(key);
    });

    console.log(`\n🔍 Found ${missing.length} missing pos_tables entries:`);
    missing.forEach(row => {
      console.log(`   - branch: ${row.branch}, table_code: ${row.table_code}`);
    });

    if (missing.length === 0) {
      console.log('\n✅ All tables have pos_tables entries - nothing to fix');
      return;
    }

    // Insert missing entries
    console.log('\n🔧 Creating missing pos_tables entries...');
    let created = 0;
    let errors = 0;

    for (const row of missing) {
      try {
        // Determine status based on existing orders
        const statusQuery = `
          SELECT COUNT(*) as count
          FROM orders 
          WHERE branch = $1 
            AND table_code = $2 
            AND status IN ('DRAFT', 'OPEN')
        `;
        const { rows: statusRows } = await client.query(statusQuery, [row.branch, row.table_code]);
        const hasActiveOrders = Number(statusRows[0]?.count || 0) > 0;
        const status = hasActiveOrders ? 'BUSY' : 'FREE';

        await client.query(
          `INSERT INTO pos_tables (branch, table_code, status, updated_at) 
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (branch, table_code) DO UPDATE 
           SET status=$3, updated_at=NOW()`,
          [row.branch, row.table_code, status]
        );
        console.log(`   ✅ Created: branch=${row.branch}, table_code=${row.table_code}, status=${status}`);
        created++;
      } catch (err) {
        console.error(`   ❌ Error creating entry for branch=${row.branch}, table_code=${row.table_code}:`, err.message);
        errors++;
      }
    }

    console.log(`\n✅ Fixed ${created} pos_tables entries`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }

    // Also create entries for common tables if they don't exist
    console.log('\n🔧 Creating common tables for china_town and place_india...');
    const commonTables = [
      { branch: 'china_town', table_code: '1' },
      { branch: 'china_town', table_code: '2' },
      { branch: 'china_town', table_code: '3' },
      { branch: 'china_town', table_code: '4' },
      { branch: 'china_town', table_code: '5' },
      { branch: 'china_town', table_code: '6' },
      { branch: 'china_town', table_code: '7' },
      { branch: 'china_town', table_code: '8' },
      { branch: 'china_town', table_code: '9' },
      { branch: 'china_town', table_code: '10' },
      { branch: 'place_india', table_code: '1' },
      { branch: 'place_india', table_code: '2' },
      { branch: 'place_india', table_code: '3' },
      { branch: 'place_india', table_code: '4' },
      { branch: 'place_india', table_code: '5' },
      { branch: 'place_india', table_code: '6' },
      { branch: 'place_india', table_code: '7' },
      { branch: 'place_india', table_code: '8' },
      { branch: 'place_india', table_code: '9' },
      { branch: 'place_india', table_code: '10' },
    ];

    let commonCreated = 0;
    for (const table of commonTables) {
      try {
        await client.query(
          `INSERT INTO pos_tables (branch, table_code, status, updated_at) 
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (branch, table_code) DO NOTHING`,
          [table.branch, table.table_code, 'FREE']
        );
        commonCreated++;
      } catch (err) {
        // Ignore errors for common tables
      }
    }
    console.log(`✅ Ensured ${commonCreated} common tables exist`);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

fixPosTables().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
