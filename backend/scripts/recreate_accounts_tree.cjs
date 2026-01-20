/**
 * Script to delete existing accounts tree and create new one
 * Based on the exact structure provided by the user
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

// Define the new accounts tree structure
const accountsTree = [
  // 0001 • الأصول
  {
    account_code: '0001',
    account_number: '0001',
    name: 'الأصول',
    name_en: 'Assets',
    type: 'asset',
    nature: 'debit',
    parent_id: null,
    children: [
      {
        account_code: '1100',
        account_number: '1100',
        name: 'أصول متداولة',
        name_en: 'Current Assets',
        type: 'asset',
        nature: 'debit',
        children: [
          {
            account_code: '1110',
            account_number: '1110',
            name: 'النقد وما في حكمه',
            name_en: 'Cash and Cash Equivalents',
            type: 'cash',
            nature: 'debit',
            children: [
              {
                account_code: '1111',
                account_number: '1111',
                name: 'الصندوق الرئيسي',
                name_en: 'Main Cash',
                type: 'cash',
                nature: 'debit',
              },
              {
                account_code: '1112',
                account_number: '1112',
                name: 'صندوق فرعي',
                name_en: 'Secondary Cash',
                type: 'cash',
                nature: 'debit',
              }
            ]
          },
          {
            account_code: '1120',
            account_number: '1120',
            name: 'البنوك',
            name_en: 'Banks',
            type: 'bank',
            nature: 'debit',
            children: [
              {
                account_code: '1122',
                account_number: '1122',
                name: 'بنك الأهلي',
                name_en: 'Al Ahli Bank',
                type: 'bank',
                nature: 'debit',
              },
              {
                account_code: '1123',
                account_number: '1123',
                name: 'بنك الراجحي',
                name_en: 'Al Rajhi Bank',
                type: 'bank',
                nature: 'debit',
              },
              {
                account_code: '1124',
                account_number: '1124',
                name: 'بنك الرياض',
                name_en: 'Riyadh Bank',
                type: 'bank',
                nature: 'debit',
              }
            ]
          },
          {
            account_code: '1150',
            account_number: '1150',
            name: 'ضريبة القيمة المضافة - مدخلات',
            name_en: 'VAT Input',
            type: 'asset',
            nature: 'debit',
          },
          {
            account_code: '1160',
            account_number: '1160',
            name: 'السلف',
            name_en: 'Advances',
            type: 'asset',
            nature: 'debit',
            children: [
              {
                account_code: '1161',
                account_number: '1161',
                name: 'سلف موظفين',
                name_en: 'Employee Advances',
                type: 'asset',
                nature: 'debit',
              }
            ]
          },
          {
            account_code: '1170',
            account_number: '1170',
            name: 'المدينون / الذمم المدينة',
            name_en: 'Accounts Receivable',
            type: 'asset',
            nature: 'debit',
            children: [
              {
                account_code: '1171',
                account_number: '1171',
                name: 'العملاء',
                name_en: 'Customers',
                type: 'asset',
                nature: 'debit',
              }
            ]
          }
        ]
      }
    ]
  },
  // 0002 • الالتزامات
  {
    account_code: '0002',
    account_number: '0002',
    name: 'الالتزامات',
    name_en: 'Liabilities',
    type: 'liability',
    nature: 'credit',
    parent_id: null,
    children: [
      {
        account_code: '2100',
        account_number: '2100',
        name: 'الالتزامات المتداولة',
        name_en: 'Current Liabilities',
        type: 'liability',
        nature: 'credit',
        children: [
          {
            account_code: '2110',
            account_number: '2110',
            name: 'الذمم الدائنة',
            name_en: 'Accounts Payable',
            type: 'liability',
            nature: 'credit',
            children: [
              {
                account_code: '2111',
                account_number: '2111',
                name: 'موردون',
                name_en: 'Suppliers',
                type: 'liability',
                nature: 'credit',
              }
            ]
          },
          {
            account_code: '2120',
            account_number: '2120',
            name: 'مستحقات موظفين',
            name_en: 'Employee Payables',
            type: 'liability',
            nature: 'credit',
            children: [
              {
                account_code: '2121',
                account_number: '2121',
                name: 'رواتب مستحقة',
                name_en: 'Salaries Payable',
                type: 'liability',
                nature: 'credit',
              },
              {
                account_code: '2122',
                account_number: '2122',
                name: 'بدلات مستحقة',
                name_en: 'Allowances Payable',
                type: 'liability',
                nature: 'credit',
              },
              {
                account_code: '2123',
                account_number: '2123',
                name: 'حوافز مستحقة',
                name_en: 'Incentives Payable',
                type: 'liability',
                nature: 'credit',
              }
            ]
          },
          {
            account_code: '2130',
            account_number: '2130',
            name: 'مخصصات مدفوعة',
            name_en: 'Deductions Payable',
            type: 'liability',
            nature: 'credit',
            children: [
              {
                account_code: '2131',
                account_number: '2131',
                name: 'تأمينات اجتماعية',
                name_en: 'Social Insurance',
                type: 'liability',
                nature: 'credit',
              },
              {
                account_code: '2132',
                account_number: '2132',
                name: 'رسوم مهن',
                name_en: 'Professional Fees',
                type: 'liability',
                nature: 'credit',
              },
              {
                account_code: '2133',
                account_number: '2133',
                name: 'رسوم مقيم',
                name_en: 'Resident Fees',
                type: 'liability',
                nature: 'credit',
              },
              {
                account_code: '2134',
                account_number: '2134',
                name: 'غرامات مستحقة',
                name_en: 'Penalties Payable',
                type: 'liability',
                nature: 'credit',
              },
              {
                account_code: '2135',
                account_number: '2135',
                name: 'مصلحة الزكاة',
                name_en: 'Zakat Authority',
                type: 'liability',
                nature: 'credit',
              }
            ]
          },
          {
            account_code: '2141',
            account_number: '2141',
            name: 'ضريبة القيمة المضافة - مخرجات',
            name_en: 'VAT Output',
            type: 'liability',
            nature: 'credit',
          }
        ]
      },
      {
        account_code: '2200',
        account_number: '2200',
        name: 'الالتزامات غير المتداولة',
        name_en: 'Non-Current Liabilities',
        type: 'liability',
        nature: 'credit',
        children: [
          {
            account_code: '2210',
            account_number: '2210',
            name: 'قروض طويلة الأجل',
            name_en: 'Long-term Loans',
            type: 'liability',
            nature: 'credit',
          },
          {
            account_code: '2211',
            account_number: '2211',
            name: 'الضريبة المستحقة',
            name_en: 'Tax Payable',
            type: 'liability',
            nature: 'credit',
          }
        ]
      }
    ]
  },
  // 0003 • حقوق الملكية
  {
    account_code: '0003',
    account_number: '0003',
    name: 'حقوق الملكية',
    name_en: 'Equity',
    type: 'equity',
    nature: 'credit',
    parent_id: null,
    children: [
      {
        account_code: '3100',
        account_number: '3100',
        name: 'رأس المال',
        name_en: 'Capital',
        type: 'equity',
        nature: 'credit',
      },
      {
        account_code: '3200',
        account_number: '3200',
        name: 'الأرباح المحتجزة',
        name_en: 'Retained Earnings',
        type: 'equity',
        nature: 'credit',
      },
      {
        account_code: '3300',
        account_number: '3300',
        name: 'جاري المالك',
        name_en: 'Owner Current Account',
        type: 'equity',
        nature: 'debit',
      }
    ]
  },
  // 0004 • الإيرادات
  {
    account_code: '0004',
    account_number: '0004',
    name: 'الإيرادات',
    name_en: 'Revenue',
    type: 'revenue',
    nature: 'credit',
    parent_id: null,
    children: [
      {
        account_code: '4100',
        account_number: '4100',
        name: 'الإيرادات التشغيلية حسب النوع',
        name_en: 'Operating Revenue by Type',
        type: 'revenue',
        nature: 'credit',
        children: [
          {
            account_code: '4111',
            account_number: '4111',
            name: 'مبيعات نقدية - China Town',
            name_en: 'Cash Sales - China Town',
            type: 'revenue',
            nature: 'credit',
          },
          {
            account_code: '4112',
            account_number: '4112',
            name: 'مبيعات آجلة - China Town',
            name_en: 'Credit Sales - China Town',
            type: 'revenue',
            nature: 'credit',
          },
          {
            account_code: '4121',
            account_number: '4121',
            name: 'مبيعات نقدية - Place India',
            name_en: 'Cash Sales - Place India',
            type: 'revenue',
            nature: 'credit',
          },
          {
            account_code: '4122',
            account_number: '4122',
            name: 'مبيعات آجلة - Place India',
            name_en: 'Credit Sales - Place India',
            type: 'revenue',
            nature: 'credit',
          },
          {
            account_code: '4130',
            account_number: '4130',
            name: 'خصم ممنوح للعملاء',
            name_en: 'Discount Given to Customers',
            type: 'revenue',
            nature: 'credit',
          }
        ]
      },
      {
        account_code: '4200',
        account_number: '4200',
        name: 'إيرادات أخرى',
        name_en: 'Other Revenue',
        type: 'revenue',
        nature: 'credit',
        children: [
          {
            account_code: '4210',
            account_number: '4210',
            name: 'إيرادات غير تشغيلية',
            name_en: 'Non-Operating Revenue',
            type: 'revenue',
            nature: 'credit',
          },
          {
            account_code: '4220',
            account_number: '4220',
            name: 'خصم مكتسب من الموردين',
            name_en: 'Discount Received from Suppliers',
            type: 'revenue',
            nature: 'credit',
          }
        ]
      }
    ]
  },
  // 0005 • المصروفات
  {
    account_code: '0005',
    account_number: '0005',
    name: 'المصروفات',
    name_en: 'Expenses',
    type: 'expense',
    nature: 'debit',
    parent_id: null,
    children: [
      {
        account_code: '5100',
        account_number: '5100',
        name: 'مصروفات تشغيلية حسب الفروع',
        name_en: 'Operating Expenses by Branch',
        type: 'expense',
        nature: 'debit',
        children: [
          {
            account_code: '5101',
            account_number: '5101',
            name: 'كهرباء - China Town',
            name_en: 'Electricity - China Town',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5102',
            account_number: '5102',
            name: 'مياه - China Town',
            name_en: 'Water - China Town',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5103',
            account_number: '5103',
            name: 'إيجار - China Town (مدفوع مقدماً)',
            name_en: 'Rent - China Town (Prepaid)',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5104',
            account_number: '5104',
            name: 'كهرباء - Place India',
            name_en: 'Electricity - Place India',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5105',
            account_number: '5105',
            name: 'مياه - Place India',
            name_en: 'Water - Place India',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5106',
            account_number: '5106',
            name: 'إيجار - Place India (مدفوع مقدمًا)',
            name_en: 'Rent - Place India (Prepaid)',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5110',
            account_number: '5110',
            name: 'تكلفة المبيعات',
            name_en: 'Cost of Goods Sold',
            type: 'expense',
            nature: 'debit',
          }
        ]
      },
      {
        account_code: '5200',
        account_number: '5200',
        name: 'مصروفات إدارية وعمومية',
        name_en: 'Administrative and General Expenses',
        type: 'expense',
        nature: 'debit',
        children: [
          {
            account_code: '5201',
            account_number: '5201',
            name: 'رواتب إدارية',
            name_en: 'Administrative Salaries',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5202',
            account_number: '5202',
            name: 'مستلزمات مكتبية',
            name_en: 'Office Supplies',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5203',
            account_number: '5203',
            name: 'خدمات أخرى',
            name_en: 'Other Services',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5204',
            account_number: '5204',
            name: 'حوافز مدفوعة',
            name_en: 'Incentives Paid',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5205',
            account_number: '5205',
            name: 'غرامات مدفوعة',
            name_en: 'Penalties Paid',
            type: 'expense',
            nature: 'debit',
          },
          {
            account_code: '5206',
            account_number: '5206',
            name: 'مصلحة الزكاة',
            name_en: 'Zakat Authority',
            type: 'expense',
            nature: 'debit',
          }
        ]
      }
    ]
  }
];

async function insertAccount(client, account, parentId = null) {
  const { rows } = await client.query(
    `INSERT INTO accounts (
      account_code, account_number, name, name_en, type, nature, parent_id, opening_balance, allow_manual_entry
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [
      account.account_code,
      account.account_number,
      account.name,
      account.name_en || account.name,
      account.type,
      account.nature,
      parentId,
      0, // opening_balance
      true // allow_manual_entry
    ]
  );
  return rows[0].id;
}

async function insertAccountTree(client, accounts, parentId = null) {
  for (const account of accounts) {
    const accountId = await insertAccount(client, account, parentId);
    console.log(`  ✅ Created: [${account.account_code}] ${account.name}`);
    
    if (account.children && account.children.length > 0) {
      await insertAccountTree(client, account.children, accountId);
    }
  }
}

async function recreateAccountsTree() {
  const url = process.env.DATABASE_URL || process.argv[2] || '';
  if (!url) {
    console.error('❌ DATABASE_URL required');
    console.error('Usage: node recreate_accounts_tree.cjs <DATABASE_URL>');
    console.error('   Or set DATABASE_URL environment variable');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Start transaction
    await client.query('BEGIN');

    // First, delete all journal postings that reference accounts
    console.log('🗑️  Deleting journal postings...');
    try {
      const deletePostingsResult = await client.query('DELETE FROM journal_postings');
      console.log(`   Deleted ${deletePostingsResult.rowCount} journal postings`);
    } catch (e) {
      console.log(`   No journal postings to delete (${e.message})`);
    }

    // Then delete journal entries
    console.log('🗑️  Deleting journal entries...');
    try {
      const deleteEntriesResult = await client.query('DELETE FROM journal_entries');
      console.log(`   Deleted ${deleteEntriesResult.rowCount} journal entries`);
    } catch (e) {
      console.log(`   No journal entries to delete (${e.message})`);
    }

    // Delete branch_accounts if exists
    console.log('🗑️  Deleting branch_accounts...');
    try {
      const deleteBranchAccountsResult = await client.query('DELETE FROM branch_accounts');
      console.log(`   Deleted ${deleteBranchAccountsResult.rowCount} branch_accounts`);
    } catch (e) {
      console.log(`   No branch_accounts to delete (${e.message})`);
    }

    // Now delete all existing accounts
    console.log('🗑️  Deleting all existing accounts...');
    const deleteResult = await client.query('DELETE FROM accounts');
    console.log(`   Deleted ${deleteResult.rowCount} accounts\n`);

    // Insert new accounts tree
    console.log('🌳 Creating new accounts tree...\n');
    await insertAccountTree(client, accountsTree);

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Accounts tree created successfully!');

    // Verify the tree
    const { rows: allAccounts } = await client.query('SELECT COUNT(*) as count FROM accounts');
    console.log(`\n📊 Total accounts created: ${allAccounts[0].count}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

recreateAccountsTree().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
