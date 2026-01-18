#!/usr/bin/env node
/**
 * اختبار Frontend - التحقق من وجود جميع الملفات والشاشات
 */

import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(__dirname, '..', 'frontend', 'src');
const PAGES_DIR = join(FRONTEND_DIR, 'pages');
const COMPONENTS_DIR = join(FRONTEND_DIR, 'components');

const screens = [
  { name: 'Expenses', file: 'Expenses.jsx', route: '/expenses' },
  { name: 'ExpensesInvoices', file: 'ExpensesInvoices.jsx', route: '/expenses/invoices' },
  { name: 'Journal', file: 'Journal.jsx', route: '/journal' },
  { name: 'Accounts', file: 'Accounts.jsx', route: '/accounts' },
  { name: 'Clients', file: 'Clients.jsx', route: '/clients' },
  { name: 'Products', file: 'Products.jsx', route: '/products' },
  { name: 'Sales', file: 'Sales.jsx', route: '/sales' },
  { name: 'SalesOrders', file: 'SalesOrders.jsx', route: '/sales/orders' },
  { name: 'POSInvoice', file: 'POSInvoice.jsx', route: '/pos/invoice' },
  { name: 'POSTables', file: 'POSTables.jsx', route: '/pos/tables' },
  { name: 'Employees', file: 'Employees.jsx', route: '/employees' },
  { name: 'Suppliers', file: 'Suppliers.jsx', route: '/suppliers' },
  { name: 'Reports', file: 'Reports.jsx', route: '/reports' },
];

async function checkFileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function testFrontend() {
  console.log('🧪 اختبار Frontend - التحقق من وجود جميع الشاشات');
  console.log('============================================================\n');
  
  const results = {
    passed: 0,
    failed: 0,
    missing: []
  };
  
  for (const screen of screens) {
    const filePath = join(PAGES_DIR, screen.file);
    const exists = await checkFileExists(filePath);
    
    if (exists) {
      console.log(`   ✅ ${screen.name} - ${screen.file}`);
      results.passed++;
    } else {
      console.log(`   ❌ ${screen.name} - ${screen.file} (غير موجود)`);
      results.failed++;
      results.missing.push(screen);
    }
  }
  
  // Check components
  console.log('\n📦 التحقق من المكونات الأساسية...');
  const components = [
    'JournalEntryCard.jsx',
    'PageHeader.jsx'
  ];
  
  for (const comp of components) {
    const filePath = join(COMPONENTS_DIR, comp);
    const exists = await checkFileExists(filePath);
    
    if (exists) {
      console.log(`   ✅ ${comp}`);
      results.passed++;
    } else {
      console.log(`   ⚠️ ${comp} (غير موجود)`);
    }
  }
  
  // Check UI components
  const uiDir = join(FRONTEND_DIR, 'ui');
  const uiComponents = ['StatusBadge.jsx', 'ActionButton.jsx'];
  for (const comp of uiComponents) {
    const filePath = join(uiDir, comp);
    const exists = await checkFileExists(filePath);
    
    if (exists) {
      console.log(`   ✅ ui/${comp}`);
      results.passed++;
    } else {
      console.log(`   ⚠️ ui/${comp} (غير موجود)`);
    }
  }
  
  // Summary
  console.log('\n============================================================');
  console.log('📊 ملخص النتائج:');
  console.log('============================================================');
  console.log(`   ✅ موجود: ${results.passed}`);
  console.log(`   ❌ مفقود: ${results.failed}`);
  
  if (results.missing.length > 0) {
    console.log('\n⚠️ الشاشات المفقودة:');
    results.missing.forEach(s => {
      console.log(`   - ${s.name} (${s.file})`);
    });
  }
  
  console.log('\n============================================================');
  
  if (results.failed === 0) {
    console.log('✅✅ جميع الشاشات موجودة!');
    process.exit(0);
  } else {
    console.log('⚠️ بعض الشاشات مفقودة');
    process.exit(1);
  }
}

testFrontend().catch(error => {
  console.error('❌ خطأ عام في الاختبار:', error);
  process.exit(1);
});
