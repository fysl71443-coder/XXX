/**
 * Script to display the accounts tree from the database
 * Shows all accounts in a hierarchical tree structure
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load .env file if it exists
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (e) {
  // Ignore errors loading .env
}

function printTree(accounts, parentId = null, level = 0, prefix = '') {
  const children = accounts.filter(a => a.parent_id === parentId);
  
  children.forEach((account, index) => {
    const isLast = index === children.length - 1;
    const currentPrefix = isLast ? '└── ' : '├── ';
    const nextPrefix = isLast ? '    ' : '│   ';
    
    const accountCode = account.account_code || account.account_number || 'N/A';
    const accountName = account.name || account.name_en || 'Unnamed';
    const accountType = account.type || 'unknown';
    const accountNature = account.nature || 'unknown';
    const openingBalance = parseFloat(account.opening_balance || 0);
    
    console.log(
      `${prefix}${currentPrefix}[${accountCode}] ${accountName} ` +
      `(Type: ${accountType}, Nature: ${accountNature}, Balance: ${openingBalance.toFixed(2)})`
    );
    
    // Recursively print children
    printTree(accounts, account.id, level + 1, prefix + nextPrefix);
  });
}

function printFlatList(accounts) {
  console.log('\n📋 Flat List of All Accounts:\n');
  console.log('ID'.padEnd(6) + 'Code'.padEnd(10) + 'Number'.padEnd(10) + 'Name'.padEnd(40) + 'Type'.padEnd(12) + 'Parent'.padEnd(8) + 'Balance');
  console.log('-'.repeat(100));
  
  accounts.forEach(account => {
    const id = String(account.id || '').padEnd(6);
    const code = String(account.account_code || 'N/A').padEnd(10);
    const number = String(account.account_number || 'N/A').padEnd(10);
    const name = String(account.name || account.name_en || 'Unnamed').substring(0, 38).padEnd(40);
    const type = String(account.type || 'unknown').padEnd(12);
    const parent = String(account.parent_id || '-').padEnd(8);
    const balance = parseFloat(account.opening_balance || 0).toFixed(2);
    
    console.log(`${id}${code}${number}${name}${type}${parent}${balance}`);
  });
}

function groupByType(accounts) {
  const grouped = {};
  accounts.forEach(account => {
    const type = account.type || 'unknown';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(account);
  });
  return grouped;
}

async function showAccountsTree() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) {
    console.error('❌ DATABASE_URL required');
    console.error('Usage: node show_accounts_tree.cjs <DATABASE_URL>');
    console.error('   Or set DATABASE_URL environment variable');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all accounts ordered by account_code or account_number
    const { rows: accounts } = await client.query(`
      SELECT 
        id,
        account_number,
        account_code,
        name,
        name_en,
        type,
        nature,
        parent_id,
        opening_balance,
        allow_manual_entry,
        created_at
      FROM accounts
      ORDER BY 
        COALESCE(account_code, account_number, '9999'),
        account_number NULLS LAST,
        name
    `);

    if (accounts.length === 0) {
      console.log('⚠️  No accounts found in the database');
      return;
    }

    console.log(`📊 Found ${accounts.length} accounts in the database\n`);

    // Show tree structure
    console.log('🌳 Accounts Tree Structure:\n');
    printTree(accounts);

    // Show flat list
    printFlatList(accounts);

    // Show summary by type
    console.log('\n📊 Summary by Type:\n');
    const grouped = groupByType(accounts);
    Object.keys(grouped).sort().forEach(type => {
      const typeAccounts = grouped[type];
      const totalBalance = typeAccounts.reduce((sum, a) => sum + parseFloat(a.opening_balance || 0), 0);
      console.log(`  ${type.padEnd(15)}: ${typeAccounts.length.toString().padStart(4)} accounts, Total Balance: ${totalBalance.toFixed(2)}`);
    });

    // Show accounts without parent (root accounts)
    console.log('\n🌲 Root Accounts (no parent):\n');
    const rootAccounts = accounts.filter(a => !a.parent_id);
    rootAccounts.forEach(account => {
      const code = account.account_code || account.account_number || 'N/A';
      console.log(`  [${code}] ${account.name || account.name_en || 'Unnamed'} (Type: ${account.type || 'unknown'})`);
    });

    // Show accounts with missing parent_id references
    console.log('\n⚠️  Accounts with invalid parent_id:\n');
    const invalidParents = accounts.filter(a => {
      if (!a.parent_id) return false;
      return !accounts.find(p => p.id === a.parent_id);
    });
    if (invalidParents.length > 0) {
      invalidParents.forEach(account => {
        const code = account.account_code || account.account_number || 'N/A';
        console.log(`  [${code}] ${account.name || account.name_en || 'Unnamed'} → Parent ID ${account.parent_id} not found`);
      });
    } else {
      console.log('  ✅ All parent_id references are valid');
    }

    // Show accounts with duplicate codes
    console.log('\n🔍 Duplicate Account Codes:\n');
    const codeMap = new Map();
    accounts.forEach(account => {
      const code = account.account_code || account.account_number;
      if (code) {
        if (!codeMap.has(code)) {
          codeMap.set(code, []);
        }
        codeMap.get(code).push(account);
      }
    });
    let hasDuplicates = false;
    codeMap.forEach((accountsWithCode, code) => {
      if (accountsWithCode.length > 1) {
        hasDuplicates = true;
        console.log(`  Code [${code}] appears ${accountsWithCode.length} times:`);
        accountsWithCode.forEach(account => {
          console.log(`    - ID ${account.id}: ${account.name || account.name_en || 'Unnamed'}`);
        });
      }
    });
    if (!hasDuplicates) {
      console.log('  ✅ No duplicate account codes found');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

showAccountsTree().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
