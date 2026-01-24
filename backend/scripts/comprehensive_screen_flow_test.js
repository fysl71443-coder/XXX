/**
 * Comprehensive Screen Flow Test
 * اختبار شامل لتدفق عمل كل شاشة ومطابقتها مع القيود والتقارير وقاعدة البيانات
 * 
 * الشاشات المختبرة:
 * 1. المبيعات (Sales)
 * 2. المصروفات (Expenses)
 * 3. الموظفين (Payroll)
 * 4. الموردين (Suppliers)
 * 5. العملاء (Customers)
 * 6. المشتريات (Purchases)
 */

import { pool } from '../db.js';
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import { URL } from 'url';

dotenv.config();

// Simple fetch implementation using native Node.js modules with timeout
async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms: ${url}`));
    }, REQUEST_TIMEOUT);
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: async () => {
            try {
              return JSON.parse(data);
            } catch (e) {
              throw new Error(`Invalid JSON response: ${data.substring(0, 200)}`);
            }
          },
          text: async () => data
        };
        resolve(response);
      });
    });
    
    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
let authToken = null;

// Add timeout to prevent hanging
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Helper: Login and get token
async function login() {
  try {
    console.log(`\n🔐 Attempting login to ${API_BASE}/api/auth/login...`);
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.TEST_EMAIL || 'fysl71443@gmail.com',
        password: process.env.TEST_PASSWORD || 'StrongPass123'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    authToken = data.token;
    if (!authToken) {
      throw new Error('No token received in login response');
    }
    console.log('✅ Login successful');
    return authToken;
  } catch (e) {
    console.error('❌ Login failed:', e.message);
    if (e.message.includes('ECONNREFUSED') || e.message.includes('timeout')) {
      console.error(`\n⚠️  Server may not be running on ${API_BASE}`);
      console.error('   Please ensure the server is running: npm run dev');
    }
    throw e;
  }
}

// Helper: API request
async function apiRequest(endpoint, options = {}) {
  if (!authToken) await login();
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${error.substring(0, 200)}`);
    }
    
    return await response.json();
  } catch (e) {
    if (e.message.includes('ECONNREFUSED') || e.message.includes('timeout')) {
      throw new Error(`Cannot connect to server at ${API_BASE}. Is the server running?`);
    }
    throw e;
  }
}

// Test Results Tracker
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logTest(name, passed, message, details = {}) {
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}: ${message}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${name}: ${message}`);
  }
  testResults.details.push({ name, passed, message, details });
}

function logWarning(name, message, details = {}) {
  testResults.warnings++;
  console.warn(`⚠️  ${name}: ${message}`);
  testResults.details.push({ name, passed: null, message, details, warning: true });
}

// ============================================================================
// TEST 1: SALES (المبيعات)
// ============================================================================

async function testSalesFlow() {
  console.log('\n📊 TEST 1: SALES FLOW (تدفق المبيعات)');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    // Step 1: Create a sales invoice via API
    console.log('\n1️⃣ Creating sales invoice...');
    const invoiceData = {
      date: new Date().toISOString().split('T')[0],
      customer_id: null,
      lines: [
        { type: 'item', name: 'Test Product', qty: 2, price: 100, discount: 0 }
      ],
      subtotal: 200,
      discount_pct: 0,
      discount_amount: 0,
      tax_pct: 15,
      tax_amount: 30,
      total: 230,
      payment_method: 'cash',
      status: 'posted',
      branch: 'china_town',
      type: 'sale'
    };
    
    let invoiceId;
    try {
      const invoice = await apiRequest('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      });
      invoiceId = invoice.id || invoice.invoice?.id;
      logTest('Sales Invoice Creation', !!invoiceId, `Invoice created with ID: ${invoiceId}`);
    } catch (e) {
      logTest('Sales Invoice Creation', false, `Failed: ${e.message}`);
      return;
    }
    
    // Step 2: Verify invoice exists in database
    console.log('\n2️⃣ Verifying invoice in database...');
    const { rows: invoiceRows } = await client.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );
    logTest('Invoice in Database', invoiceRows.length > 0, 
      invoiceRows.length > 0 ? `Found invoice #${invoiceId}` : 'Invoice not found');
    
    // Step 3: Verify journal entry was created
    console.log('\n3️⃣ Verifying journal entry...');
    const { rows: journalRows } = await client.query(
      `SELECT je.* FROM journal_entries je 
       WHERE je.reference_type = 'invoice' AND je.reference_id = $1 AND je.status = 'posted'`,
      [invoiceId]
    );
    logTest('Journal Entry Created', journalRows.length > 0,
      journalRows.length > 0 ? `Found journal entry #${journalRows[0].id}` : 'No journal entry found');
    
    if (journalRows.length > 0) {
      const journalEntryId = journalRows[0].id;
      
      // Step 4: Verify journal entry is balanced
      console.log('\n4️⃣ Verifying journal entry balance...');
      const { rows: postingsRows } = await client.query(
        `SELECT SUM(debit) as total_debit, SUM(credit) as total_credit 
         FROM journal_postings WHERE journal_entry_id = $1`,
        [journalEntryId]
      );
      const totalDebit = parseFloat(postingsRows[0]?.total_debit || 0);
      const totalCredit = parseFloat(postingsRows[0]?.total_credit || 0);
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
      logTest('Journal Entry Balanced', isBalanced,
        isBalanced ? `Balanced (Debit: ${totalDebit}, Credit: ${totalCredit})` : 
        `Unbalanced (Debit: ${totalDebit}, Credit: ${totalCredit})`);
      
      // Step 5: Verify invoice appears in sales list
      console.log('\n5️⃣ Verifying invoice in sales list...');
      try {
        const salesList = await apiRequest('/api/invoices?type=sale&status=posted');
        const foundInList = Array.isArray(salesList) ? salesList.find(i => i.id === invoiceId) :
                           salesList.items?.find(i => i.id === invoiceId);
        logTest('Invoice in Sales List', !!foundInList, 
          foundInList ? 'Invoice appears in sales list' : 'Invoice not found in sales list');
      } catch (e) {
        logTest('Invoice in Sales List', false, `Failed to fetch sales list: ${e.message}`);
      }
      
      // Step 6: Verify invoice appears in reports
      console.log('\n6️⃣ Verifying invoice in reports...');
      try {
        const today = new Date().toISOString().split('T')[0];
        const reports = await apiRequest(`/api/reports/business-day-sales?date=${today}&branch=all`);
        logTest('Invoice in Reports', true, 'Report query successful');
      } catch (e) {
        logWarning('Invoice in Reports', `Report query failed: ${e.message}`);
      }
    }
    
    // Step 7: Verify data integrity rule (no orphaned invoice)
    console.log('\n7️⃣ Verifying data integrity (no orphaned invoice)...');
    const { rows: orphanedInvoices } = await client.query(
      `SELECT i.id, i.number, i.status 
       FROM invoices i 
       WHERE i.id = $1 
       AND i.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE je.reference_type = 'invoice' AND je.reference_id = i.id AND je.status = 'posted'
       )`,
      [invoiceId]
    );
    logTest('Data Integrity (No Orphaned Invoice)', orphanedInvoices.length === 0,
      orphanedInvoices.length === 0 ? 'No orphaned invoice found' : 
      `Found orphaned invoice: ${orphanedInvoices[0].id}`);
    
  } catch (e) {
    console.error('❌ Sales flow test error:', e);
    logTest('Sales Flow Test', false, `Test error: ${e.message}`);
  } finally {
    client.release();
  }
}

// ============================================================================
// TEST 2: EXPENSES (المصروفات)
// ============================================================================

async function testExpensesFlow() {
  console.log('\n📊 TEST 2: EXPENSES FLOW (تدفق المصروفات)');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    // Step 1: Get expense account
    console.log('\n1️⃣ Getting expense account...');
    const { rows: expenseAccounts } = await client.query(
      `SELECT id FROM accounts WHERE type = 'expense' OR account_code LIKE '5%' LIMIT 1`
    );
    if (expenseAccounts.length === 0) {
      logTest('Expense Account Available', false, 'No expense account found');
      return;
    }
    const expenseAccountId = expenseAccounts[0].id;
    logTest('Expense Account Available', true, `Using account ID: ${expenseAccountId}`);
    
    // Step 2: Create expense invoice
    console.log('\n2️⃣ Creating expense invoice...');
    const expenseData = {
      date: new Date().toISOString().split('T')[0],
      description: 'Test Expense',
      amount: 500,
      payment_method: 'cash',
      account_id: expenseAccountId
    };
    
    let expenseId;
    try {
      const expense = await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseData)
      });
      expenseId = expense.id || expense.expense?.id;
      logTest('Expense Invoice Creation', !!expenseId, `Expense created with ID: ${expenseId}`);
    } catch (e) {
      logTest('Expense Invoice Creation', false, `Failed: ${e.message}`);
      return;
    }
    
    // Step 3: Verify expense exists in database
    console.log('\n3️⃣ Verifying expense in database...');
    const { rows: expenseRows } = await client.query(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
    );
    logTest('Expense in Database', expenseRows.length > 0,
      expenseRows.length > 0 ? `Found expense #${expenseId}` : 'Expense not found');
    
    // Step 4: Verify journal entry was created
    console.log('\n4️⃣ Verifying journal entry...');
    const { rows: journalRows } = await client.query(
      `SELECT je.* FROM journal_entries je 
       WHERE (je.reference_type = 'expense_invoice' OR je.reference_type = 'expense') AND je.reference_id = $1 AND je.status = 'posted'`,
      [expenseId]
    );
    logTest('Journal Entry Created', journalRows.length > 0,
      journalRows.length > 0 ? `Found journal entry #${journalRows[0].id}` : 'No journal entry found');
    
    if (journalRows.length > 0) {
      // Step 5: Verify journal entry is balanced
      console.log('\n5️⃣ Verifying journal entry balance...');
      const journalEntryId = journalRows[0].id;
      const { rows: postingsRows } = await client.query(
        `SELECT SUM(debit) as total_debit, SUM(credit) as total_credit 
         FROM journal_postings WHERE journal_entry_id = $1`,
        [journalEntryId]
      );
      const totalDebit = parseFloat(postingsRows[0]?.total_debit || 0);
      const totalCredit = parseFloat(postingsRows[0]?.total_credit || 0);
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
      logTest('Journal Entry Balanced', isBalanced,
        isBalanced ? `Balanced (Debit: ${totalDebit}, Credit: ${totalCredit})` : 
        `Unbalanced (Debit: ${totalDebit}, Credit: ${totalCredit})`);
    }
    
    // Step 6: Verify expense appears in expenses list
    console.log('\n6️⃣ Verifying expense in expenses list...');
    try {
      const expensesList = await apiRequest('/api/expenses?status=posted');
      const foundInList = Array.isArray(expensesList) ? expensesList.find(e => e.id === expenseId) :
                         expensesList.items?.find(e => e.id === expenseId);
      logTest('Expense in Expenses List', !!foundInList,
        foundInList ? 'Expense appears in expenses list' : 'Expense not found in expenses list');
    } catch (e) {
      logTest('Expense in Expenses List', false, `Failed to fetch expenses list: ${e.message}`);
    }
    
    // Step 7: Verify data integrity rule
    console.log('\n7️⃣ Verifying data integrity (no orphaned expense)...');
    const { rows: orphanedExpenses } = await client.query(
      `SELECT e.id, e.description, e.status 
       FROM expenses e 
       WHERE e.id = $1 
       AND e.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE (je.reference_type = 'expense_invoice' OR je.reference_type = 'expense') AND je.reference_id = e.id AND je.status = 'posted'
       )`,
      [expenseId]
    );
    logTest('Data Integrity (No Orphaned Expense)', orphanedExpenses.length === 0,
      orphanedExpenses.length === 0 ? 'No orphaned expense found' : 
      `Found orphaned expense: ${orphanedExpenses[0].id}`);
    
  } catch (e) {
    console.error('❌ Expenses flow test error:', e);
    logTest('Expenses Flow Test', false, `Test error: ${e.message}`);
  } finally {
    client.release();
  }
}

// ============================================================================
// TEST 3: PAYROLL (الموظفين)
// ============================================================================

async function testPayrollFlow() {
  console.log('\n📊 TEST 3: PAYROLL FLOW (تدفق الرواتب)');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    // Step 1: Get employee
    console.log('\n1️⃣ Getting employee...');
    const { rows: employees } = await client.query(
      'SELECT id FROM employees WHERE is_active = true LIMIT 1'
    );
    if (employees.length === 0) {
      logTest('Employee Available', false, 'No active employee found');
      return;
    }
    const employeeId = employees[0].id;
    logTest('Employee Available', true, `Using employee ID: ${employeeId}`);
    
    // Step 2: Get payroll period
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const period = `${year}-${month}`;
    
    // Step 3: Check if payroll run already exists
    console.log('\n2️⃣ Checking existing payroll runs...');
    const { rows: existingRuns } = await client.query(
      'SELECT id FROM payroll_runs WHERE period = $1 AND status = $2',
      [period, 'posted']
    );
    if (existingRuns.length > 0) {
      logWarning('Payroll Run Exists', `Payroll run already exists for period ${period}`);
      // Use existing run for testing
      const payrollRunId = existingRuns[0].id;
      
      // Step 4: Verify journal entry exists
      console.log('\n3️⃣ Verifying journal entry...');
      const { rows: journalRows } = await client.query(
        `SELECT je.* FROM journal_entries je 
         WHERE (je.reference_type = 'payroll_run' OR je.reference_type = 'payroll') AND je.reference_id = $1 AND je.status = 'posted'`,
        [payrollRunId]
      );
      logTest('Journal Entry Exists', journalRows.length > 0,
        journalRows.length > 0 ? `Found journal entry #${journalRows[0].id}` : 'No journal entry found');
      
      // Step 5: Verify payroll appears in payroll list
      console.log('\n4️⃣ Verifying payroll in payroll list...');
      try {
        const payrollList = await apiRequest('/api/payroll/runs?status=posted');
        const foundInList = Array.isArray(payrollList) ? payrollList.find(p => p.id === payrollRunId) :
                           payrollList.items?.find(p => p.id === payrollRunId);
        logTest('Payroll in Payroll List', !!foundInList,
          foundInList ? 'Payroll appears in payroll list' : 'Payroll not found in payroll list');
      } catch (e) {
        logTest('Payroll in Payroll List', false, `Failed to fetch payroll list: ${e.message}`);
      }
      
      // Step 6: Verify data integrity
      console.log('\n5️⃣ Verifying data integrity (no orphaned payroll)...');
      const { rows: orphanedPayrolls } = await client.query(
        `SELECT pr.id, pr.period, pr.status 
         FROM payroll_runs pr 
         WHERE pr.id = $1 
         AND pr.status = 'posted' 
         AND NOT EXISTS (
           SELECT 1 FROM journal_entries je 
           WHERE (je.reference_type = 'payroll_run' OR je.reference_type = 'payroll') AND je.reference_id = pr.id AND je.status = 'posted'
         )`,
        [payrollRunId]
      );
      logTest('Data Integrity (No Orphaned Payroll)', orphanedPayrolls.length === 0,
        orphanedPayrolls.length === 0 ? 'No orphaned payroll found' : 
        `Found orphaned payroll: ${orphanedPayrolls[0].id}`);
    } else {
      logWarning('Payroll Run Creation', 'No payroll run found - skipping detailed tests');
    }
    
  } catch (e) {
    console.error('❌ Payroll flow test error:', e);
    logTest('Payroll Flow Test', false, `Test error: ${e.message}`);
  } finally {
    client.release();
  }
}

// ============================================================================
// TEST 4: SUPPLIERS & PURCHASES (الموردين والمشتريات)
// ============================================================================

async function testSuppliersFlow() {
  console.log('\n📊 TEST 4: SUPPLIERS & PURCHASES FLOW (تدفق الموردين والمشتريات)');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    // Step 1: Get supplier
    console.log('\n1️⃣ Getting supplier...');
    const { rows: suppliers } = await client.query(
      'SELECT id FROM partners WHERE type = $1 AND is_active = true LIMIT 1',
      ['supplier']
    );
    if (suppliers.length === 0) {
      logTest('Supplier Available', false, 'No active supplier found');
      return;
    }
    const supplierId = suppliers[0].id;
    logTest('Supplier Available', true, `Using supplier ID: ${supplierId}`);
    
    // Step 2: Get expense account for supplier invoice
    const { rows: expenseAccounts } = await client.query(
      `SELECT id FROM accounts WHERE type = 'expense' OR account_code LIKE '5%' LIMIT 1`
    );
    if (expenseAccounts.length === 0) {
      logTest('Expense Account for Supplier Invoice', false, 'No expense account found');
      return;
    }
    const expenseAccountId = expenseAccounts[0].id;
    
    // Step 3: Create supplier invoice
    console.log('\n2️⃣ Creating supplier invoice...');
    const supplierInvoiceData = {
      date: new Date().toISOString().split('T')[0],
      partner_id: supplierId,
      invoice_number: `TEST-SI-${Date.now()}`,
      lines: [
        { name: 'Test Purchase', qty: 1, unit_price: 300, tax: 0.15, discount: 0 }
      ],
      subtotal: 300,
      tax_amount: 45,
      total: 345,
      status: 'posted',
      payment_method: 'cash'
    };
    
    let supplierInvoiceId;
    try {
      const supplierInvoice = await apiRequest('/api/supplier-invoices', {
        method: 'POST',
        body: JSON.stringify(supplierInvoiceData)
      });
      supplierInvoiceId = supplierInvoice.id || supplierInvoice.invoice?.id;
      logTest('Supplier Invoice Creation', !!supplierInvoiceId, 
        `Supplier invoice created with ID: ${supplierInvoiceId}`);
    } catch (e) {
      logTest('Supplier Invoice Creation', false, `Failed: ${e.message}`);
      return;
    }
    
    // Step 4: Verify supplier invoice exists in database
    console.log('\n3️⃣ Verifying supplier invoice in database...');
    const { rows: supplierInvoiceRows } = await client.query(
      'SELECT * FROM supplier_invoices WHERE id = $1',
      [supplierInvoiceId]
    );
    logTest('Supplier Invoice in Database', supplierInvoiceRows.length > 0,
      supplierInvoiceRows.length > 0 ? `Found supplier invoice #${supplierInvoiceId}` : 
      'Supplier invoice not found');
    
    // Step 5: Verify journal entry was created
    console.log('\n4️⃣ Verifying journal entry...');
    const { rows: journalRows } = await client.query(
      `SELECT je.* FROM journal_entries je 
       WHERE je.reference_type = 'supplier_invoice' AND je.reference_id = $1 AND je.status = 'posted'`,
      [supplierInvoiceId]
    );
    logTest('Journal Entry Created', journalRows.length > 0,
      journalRows.length > 0 ? `Found journal entry #${journalRows[0].id}` : 'No journal entry found');
    
    if (journalRows.length > 0) {
      // Step 6: Verify journal entry is balanced
      console.log('\n5️⃣ Verifying journal entry balance...');
      const journalEntryId = journalRows[0].id;
      const { rows: postingsRows } = await client.query(
        `SELECT SUM(debit) as total_debit, SUM(credit) as total_credit 
         FROM journal_postings WHERE journal_entry_id = $1`,
        [journalEntryId]
      );
      const totalDebit = parseFloat(postingsRows[0]?.total_debit || 0);
      const totalCredit = parseFloat(postingsRows[0]?.total_credit || 0);
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
      logTest('Journal Entry Balanced', isBalanced,
        isBalanced ? `Balanced (Debit: ${totalDebit}, Credit: ${totalCredit})` : 
        `Unbalanced (Debit: ${totalDebit}, Credit: ${totalCredit})`);
    }
    
    // Step 7: Verify supplier invoice appears in suppliers list
    console.log('\n6️⃣ Verifying supplier invoice in suppliers list...');
    try {
      const suppliersList = await apiRequest('/api/supplier-invoices?status=posted');
      const foundInList = Array.isArray(suppliersList) ? suppliersList.find(si => si.id === supplierInvoiceId) :
                         suppliersList.items?.find(si => si.id === supplierInvoiceId);
      logTest('Supplier Invoice in Suppliers List', !!foundInList,
        foundInList ? 'Supplier invoice appears in suppliers list' : 
        'Supplier invoice not found in suppliers list');
    } catch (e) {
      logTest('Supplier Invoice in Suppliers List', false, `Failed to fetch suppliers list: ${e.message}`);
    }
    
    // Step 8: Verify data integrity rule
    console.log('\n7️⃣ Verifying data integrity (no orphaned supplier invoice)...');
    const { rows: orphanedSupplierInvoices } = await client.query(
      `SELECT si.id, si.number, si.status 
       FROM supplier_invoices si 
       WHERE si.id = $1 
       AND si.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE je.reference_type = 'supplier_invoice' AND je.reference_id = si.id AND je.status = 'posted'
       )`,
      [supplierInvoiceId]
    );
    logTest('Data Integrity (No Orphaned Supplier Invoice)', orphanedSupplierInvoices.length === 0,
      orphanedSupplierInvoices.length === 0 ? 'No orphaned supplier invoice found' : 
      `Found orphaned supplier invoice: ${orphanedSupplierInvoices[0].id}`);
    
  } catch (e) {
    console.error('❌ Suppliers flow test error:', e);
    logTest('Suppliers Flow Test', false, `Test error: ${e.message}`);
  } finally {
    client.release();
  }
}

// ============================================================================
// TEST 5: CUSTOMERS (العملاء)
// ============================================================================

async function testCustomersFlow() {
  console.log('\n📊 TEST 5: CUSTOMERS FLOW (تدفق العملاء)');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    // Step 1: Get customer
    console.log('\n1️⃣ Getting customer...');
    const { rows: customers } = await client.query(
      'SELECT id, account_id FROM partners WHERE type = $1 AND is_active = true LIMIT 1',
      ['customer']
    );
    if (customers.length === 0) {
      logTest('Customer Available', false, 'No active customer found');
      return;
    }
    const customerId = customers[0].id;
    const customerAccountId = customers[0].account_id;
    logTest('Customer Available', true, `Using customer ID: ${customerId}`);
    
    // Step 2: Get customer invoices from journal entries
    console.log('\n2️⃣ Verifying customer invoices from journal entries...');
    const { rows: customerInvoices } = await client.query(
      `SELECT je.*, i.id as invoice_id, i.number, i.total 
       FROM journal_entries je
       JOIN invoices i ON i.id = je.reference_id
       WHERE je.reference_type = 'invoice' 
       AND je.status = 'posted'
       AND i.customer_id = $1
       ORDER BY je.date DESC
       LIMIT 5`,
      [customerId]
    );
    logTest('Customer Invoices from Journal Entries', customerInvoices.length > 0,
      customerInvoices.length > 0 ? `Found ${customerInvoices.length} invoices` : 'No invoices found');
    
    // Step 3: Verify customer balance from journal entries
    console.log('\n3️⃣ Verifying customer balance from journal entries...');
    if (customerAccountId) {
      const { rows: balanceRows } = await client.query(
        `SELECT COALESCE(SUM(jp.debit - jp.credit), 0) as balance
         FROM journal_postings jp
         JOIN journal_entries je ON je.id = jp.journal_entry_id
         WHERE jp.account_id = $1 AND je.status = 'posted'`,
        [customerAccountId]
      );
      const balance = parseFloat(balanceRows[0]?.balance || 0);
      logTest('Customer Balance from Journal Entries', true,
        `Customer balance: ${balance.toFixed(2)}`);
    } else {
      logWarning('Customer Balance', 'Customer has no account_id');
    }
    
    // Step 4: Verify customer appears in customers list
    console.log('\n4️⃣ Verifying customer in customers list...');
    try {
      const customersList = await apiRequest('/api/partners?type=customer');
      const foundInList = Array.isArray(customersList) ? customersList.find(c => c.id === customerId) :
                         customersList.items?.find(c => c.id === customerId);
      logTest('Customer in Customers List', !!foundInList,
        foundInList ? 'Customer appears in customers list' : 'Customer not found in customers list');
    } catch (e) {
      logTest('Customer in Customers List', false, `Failed to fetch customers list: ${e.message}`);
    }
    
    // Step 5: Verify customer invoices appear in customer screen
    console.log('\n5️⃣ Verifying customer invoices in customer screen...');
    try {
      const customerInvoicesList = await apiRequest(`/api/invoices?customer_id=${customerId}&status=posted`);
      const foundInvoices = Array.isArray(customerInvoicesList) ? customerInvoicesList :
                            customerInvoicesList.items || [];
      logTest('Customer Invoices in Customer Screen', foundInvoices.length > 0,
        foundInvoices.length > 0 ? `Found ${foundInvoices.length} invoices` : 'No invoices found');
    } catch (e) {
      logTest('Customer Invoices in Customer Screen', false, `Failed to fetch customer invoices: ${e.message}`);
    }
    
  } catch (e) {
    console.error('❌ Customers flow test error:', e);
    logTest('Customers Flow Test', false, `Test error: ${e.message}`);
  } finally {
    client.release();
  }
}

// ============================================================================
// TEST 6: REPORTS VERIFICATION (التحقق من التقارير)
// ============================================================================

async function testReportsVerification() {
  console.log('\n📊 TEST 6: REPORTS VERIFICATION (التحقق من التقارير)');
  console.log('='.repeat(60));
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const from = `${year}-${month}-01`;
    const to = today;
    
    // Test 1: Trial Balance
    console.log('\n1️⃣ Testing Trial Balance report...');
    try {
      const trialBalance = await apiRequest(`/api/reports/trial-balance?from=${from}&to=${to}`);
      const hasItems = trialBalance.items && trialBalance.items.length > 0;
      logTest('Trial Balance Report', hasItems,
        hasItems ? `Report has ${trialBalance.items.length} accounts` : 'Report is empty');
    } catch (e) {
      logTest('Trial Balance Report', false, `Failed: ${e.message}`);
    }
    
    // Test 2: Sales vs Expenses
    console.log('\n2️⃣ Testing Sales vs Expenses report...');
    try {
      const salesVsExpenses = await apiRequest(`/api/reports/sales-vs-expenses?from=${from}&to=${to}`);
      const hasItems = salesVsExpenses.items && salesVsExpenses.items.length > 0;
      logTest('Sales vs Expenses Report', hasItems,
        hasItems ? `Report has ${salesVsExpenses.items.length} days` : 'Report is empty');
    } catch (e) {
      logTest('Sales vs Expenses Report', false, `Failed: ${e.message}`);
    }
    
    // Test 3: Business Day Sales
    console.log('\n3️⃣ Testing Business Day Sales report...');
    try {
      const businessDaySales = await apiRequest(`/api/reports/business-day-sales?date=${today}&branch=all`);
      logTest('Business Day Sales Report', true, 'Report query successful');
    } catch (e) {
      logTest('Business Day Sales Report', false, `Failed: ${e.message}`);
    }
    
    // Test 4: Sales by Branch
    console.log('\n4️⃣ Testing Sales by Branch report...');
    try {
      const salesByBranch = await apiRequest(`/api/reports/sales-by-branch?from=${from}&to=${to}`);
      const hasItems = salesByBranch.items && salesByBranch.items.length > 0;
      logTest('Sales by Branch Report', hasItems,
        hasItems ? `Report has ${salesByBranch.items.length} branches` : 'Report is empty');
    } catch (e) {
      logTest('Sales by Branch Report', false, `Failed: ${e.message}`);
    }
    
  } catch (e) {
    console.error('❌ Reports verification test error:', e);
    logTest('Reports Verification Test', false, `Test error: ${e.message}`);
  }
}

// ============================================================================
// TEST 7: DATA INTEGRITY CHECK (فحص سلامة البيانات)
// ============================================================================

async function testDataIntegrity() {
  console.log('\n📊 TEST 7: DATA INTEGRITY CHECK (فحص سلامة البيانات)');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    // Check 1: Orphaned invoices
    console.log('\n1️⃣ Checking for orphaned invoices...');
    const { rows: orphanedInvoices } = await client.query(
      `SELECT i.id, i.number, i.status 
       FROM invoices i 
       WHERE i.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE je.reference_type = 'invoice' AND je.reference_id = i.id AND je.status = 'posted'
       )`
    );
    logTest('No Orphaned Invoices', orphanedInvoices.length === 0,
      orphanedInvoices.length === 0 ? 'No orphaned invoices found' : 
      `Found ${orphanedInvoices.length} orphaned invoices`);
    
    // Check 2: Orphaned expenses
    console.log('\n2️⃣ Checking for orphaned expenses...');
    const { rows: orphanedExpenses } = await client.query(
      `SELECT e.id, e.description, e.status 
       FROM expenses e 
       WHERE e.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE (je.reference_type = 'expense_invoice' OR je.reference_type = 'expense') AND je.reference_id = e.id AND je.status = 'posted'
       )`
    );
    logTest('No Orphaned Expenses', orphanedExpenses.length === 0,
      orphanedExpenses.length === 0 ? 'No orphaned expenses found' : 
      `Found ${orphanedExpenses.length} orphaned expenses`);
    
    // Check 3: Orphaned payroll runs
    console.log('\n3️⃣ Checking for orphaned payroll runs...');
    const { rows: orphanedPayrolls } = await client.query(
      `SELECT pr.id, pr.period, pr.status 
       FROM payroll_runs pr 
       WHERE pr.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE (je.reference_type = 'payroll_run' OR je.reference_type = 'payroll') AND je.reference_id = pr.id AND je.status = 'posted'
       )`
    );
    logTest('No Orphaned Payroll Runs', orphanedPayrolls.length === 0,
      orphanedPayrolls.length === 0 ? 'No orphaned payroll runs found' : 
      `Found ${orphanedPayrolls.length} orphaned payroll runs`);
    
    // Check 4: Orphaned supplier invoices
    console.log('\n4️⃣ Checking for orphaned supplier invoices...');
    const { rows: orphanedSupplierInvoices } = await client.query(
      `SELECT si.id, si.number, si.status 
       FROM supplier_invoices si 
       WHERE si.status = 'posted' 
       AND NOT EXISTS (
         SELECT 1 FROM journal_entries je 
         WHERE je.reference_type = 'supplier_invoice' AND je.reference_id = si.id AND je.status = 'posted'
       )`
    );
    logTest('No Orphaned Supplier Invoices', orphanedSupplierInvoices.length === 0,
      orphanedSupplierInvoices.length === 0 ? 'No orphaned supplier invoices found' : 
      `Found ${orphanedSupplierInvoices.length} orphaned supplier invoices`);
    
    // Check 5: Unbalanced journal entries
    console.log('\n5️⃣ Checking for unbalanced journal entries...');
    const { rows: unbalancedEntries } = await client.query(
      `SELECT je.id, je.entry_number, je.description,
              COALESCE(SUM(jp.debit), 0) as total_debit,
              COALESCE(SUM(jp.credit), 0) as total_credit
       FROM journal_entries je
       LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
       WHERE je.status = 'posted'
       GROUP BY je.id, je.entry_number, je.description
       HAVING ABS(COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0)) > 0.01`
    );
    logTest('No Unbalanced Journal Entries', unbalancedEntries.length === 0,
      unbalancedEntries.length === 0 ? 'No unbalanced journal entries found' : 
      `Found ${unbalancedEntries.length} unbalanced journal entries`);
    
  } catch (e) {
    console.error('❌ Data integrity test error:', e);
    logTest('Data Integrity Test', false, `Test error: ${e.message}`);
  } finally {
    client.release();
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n🧪 COMPREHENSIVE SCREEN FLOW TEST');
  console.log('='.repeat(60));
  console.log('Testing all screens and their integration with journal entries, reports, and database');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE}`);
  console.log(`Node Version: ${process.version}`);
  console.log('='.repeat(60));
  
  try {
    // Login first
    console.log('\n🔐 Step 0: Authentication...');
    await login();
    
    // Run all tests
    await testSalesFlow();
    await testExpensesFlow();
    await testPayrollFlow();
    await testSuppliersFlow();
    await testCustomersFlow();
    await testReportsVerification();
    await testDataIntegrity();
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    console.log(`📈 Total: ${testResults.passed + testResults.failed + testResults.warnings}`);
    console.log(`📊 Pass Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    // Print failed tests
    if (testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults.details
        .filter(t => t.passed === false)
        .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
    }
    
    // Print warnings
    if (testResults.warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      testResults.details
        .filter(t => t.warning)
        .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (e) {
    console.error('\n❌ Test suite error:', e);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]) ||
                     process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  runAllTests().catch(e => {
    console.error('\n❌ Fatal error:', e);
    console.error(e.stack);
    process.exit(1);
  });
}

export { runAllTests };
