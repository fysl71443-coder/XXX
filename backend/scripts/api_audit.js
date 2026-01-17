/**
 * Comprehensive API Endpoint Audit Script
 * Tests all API endpoints and validates responses against database schema
 */

import { pool } from '../db.js';
import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Should be set for authenticated endpoints

// Database schema definitions
const SCHEMAS = {
  expenses: {
    id: 'integer',
    type: 'text',
    amount: 'numeric',
    account_code: 'text',
    partner_id: 'integer',
    description: 'text',
    status: 'text',
    branch: 'text',
    date: 'date',
    payment_method: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  invoices: {
    id: 'integer',
    number: 'text',
    date: 'date',
    customer_id: 'integer',
    lines: 'jsonb',
    subtotal: 'numeric',
    discount_pct: 'numeric',
    discount_amount: 'numeric',
    tax_pct: 'numeric',
    tax_amount: 'numeric',
    total: 'numeric',
    payment_method: 'text',
    status: 'text',
    branch: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  supplier_invoices: {
    id: 'integer',
    number: 'text',
    date: 'date',
    due_date: 'date',
    supplier_id: 'integer',
    subtotal: 'numeric',
    discount_pct: 'numeric',
    discount_amount: 'numeric',
    tax_pct: 'numeric',
    tax_amount: 'numeric',
    total: 'numeric',
    payment_method: 'text',
    status: 'text',
    branch: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  journal_entries: {
    id: 'integer',
    entry_number: 'integer',
    description: 'text',
    date: 'date',
    period: 'text',
    reference_type: 'text',
    reference_id: 'integer',
    status: 'text',
    created_at: 'timestamp'
  },
  journal_postings: {
    id: 'integer',
    journal_entry_id: 'integer',
    account_id: 'integer',
    debit: 'numeric',
    credit: 'numeric'
  },
  orders: {
    id: 'integer',
    branch: 'text',
    table_code: 'text',
    lines: 'jsonb',
    status: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  partners: {
    id: 'integer',
    name: 'text',
    type: 'text',
    email: 'text',
    phone: 'text',
    customer_type: 'text',
    account_id: 'integer',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  employees: {
    id: 'integer',
    full_name: 'text',
    employee_number: 'text',
    basic_salary: 'numeric',
    status: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  }
};

// All API endpoints to test
const ENDPOINTS = [
  // Expenses
  { method: 'GET', path: '/api/expenses', requiresAuth: true, schema: 'expenses' },
  { method: 'POST', path: '/api/expenses', requiresAuth: true, schema: 'expenses', testData: { type: 'expense', amount: 100, account_code: '5200', branch: 'china_town', date: new Date().toISOString().slice(0, 10), payment_method: 'cash' } },
  { method: 'GET', path: '/expenses', requiresAuth: true, schema: 'expenses' },
  { method: 'POST', path: '/expenses', requiresAuth: true, schema: 'expenses', testData: { type: 'expense', amount: 100, account_code: '5200', branch: 'china_town', date: new Date().toISOString().slice(0, 10), payment_method: 'cash' } },
  
  // Invoices
  { method: 'GET', path: '/api/invoices', requiresAuth: true, schema: 'invoices' },
  { method: 'POST', path: '/api/invoices', requiresAuth: true, schema: 'invoices', testData: { number: 'TEST-001', date: new Date().toISOString().slice(0, 10), subtotal: 100, total: 115, branch: 'china_town', status: 'draft' } },
  { method: 'GET', path: '/invoices', requiresAuth: true, schema: 'invoices' },
  { method: 'POST', path: '/invoices', requiresAuth: true, schema: 'invoices', testData: { number: 'TEST-002', date: new Date().toISOString().slice(0, 10), subtotal: 100, total: 115, branch: 'china_town', status: 'draft' } },
  
  // Supplier Invoices
  { method: 'GET', path: '/api/supplier-invoices', requiresAuth: true, schema: 'supplier_invoices' },
  { method: 'GET', path: '/supplier-invoices', requiresAuth: true, schema: 'supplier_invoices' },
  
  // Journal Entries
  { method: 'GET', path: '/api/journal', requiresAuth: true, schema: 'journal_entries' },
  { method: 'POST', path: '/api/journal', requiresAuth: true, schema: 'journal_entries', testData: { description: 'Test Entry', date: new Date().toISOString().slice(0, 10), postings: [] } },
  { method: 'GET', path: '/journal', requiresAuth: true, schema: 'journal_entries' },
  { method: 'POST', path: '/journal', requiresAuth: true, schema: 'journal_entries', testData: { description: 'Test Entry 2', date: new Date().toISOString().slice(0, 10), postings: [] } },
  
  // Orders (POS)
  { method: 'GET', path: '/api/orders', requiresAuth: true, schema: 'orders' },
  { method: 'GET', path: '/orders', requiresAuth: true, schema: 'orders' },
  
  // Partners
  { method: 'GET', path: '/api/partners', requiresAuth: true, schema: 'partners' },
  { method: 'GET', path: '/partners', requiresAuth: true, schema: 'partners' },
  
  // Employees
  { method: 'GET', path: '/api/employees', requiresAuth: true, schema: 'employees' },
  { method: 'GET', path: '/employees', requiresAuth: true, schema: 'employees' },
  
  // Accounts
  { method: 'GET', path: '/api/accounts', requiresAuth: true },
  { method: 'GET', path: '/accounts', requiresAuth: true },
  
  // Accounting Periods
  { method: 'GET', path: '/api/accounting-periods/2026-01', requiresAuth: true },
  { method: 'GET', path: '/accounting-periods/2026-01', requiresAuth: true },
];

// Helper function to validate field types
function validateType(value, expectedType) {
  if (value === null || value === undefined) return { valid: false, reason: 'null_or_undefined' };
  
  switch (expectedType) {
    case 'integer':
      return { valid: Number.isInteger(Number(value)), reason: 'not_integer' };
    case 'numeric':
      return { valid: !isNaN(Number(value)), reason: 'not_numeric' };
    case 'text':
      return { valid: typeof value === 'string', reason: 'not_text' };
    case 'date':
      return { valid: !isNaN(Date.parse(value)) || value instanceof Date, reason: 'not_date' };
    case 'timestamp':
      return { valid: !isNaN(Date.parse(value)) || value instanceof Date, reason: 'not_timestamp' };
    case 'jsonb':
      return { valid: typeof value === 'object' || Array.isArray(value), reason: 'not_jsonb' };
    default:
      return { valid: true, reason: null };
  }
}

// Test a single endpoint
async function testEndpoint(endpoint) {
  const result = {
    endpoint: endpoint.path,
    method: endpoint.method,
    status: null,
    response_time_ms: null,
    issues: [],
    response_sample: null,
    record_count: null
  };

  try {
    const startTime = Date.now();
    const config = {
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      headers: endpoint.requiresAuth ? { 'Authorization': `Bearer ${TEST_TOKEN}` } : {},
      data: endpoint.testData || undefined,
      validateStatus: () => true // Don't throw on any status
    };

    const response = await axios(config);
    result.status = response.status;
    result.response_time_ms = Date.now() - startTime;

    // Check status code
    if (response.status < 200 || response.status >= 300) {
      result.issues.push({
        type: 'http_error',
        status_code: response.status,
        message: response.statusText || 'Unknown error'
      });
      return result;
    }

    // Validate response structure
    const data = response.data;
    result.response_sample = Array.isArray(data) ? data[0] : (data?.items?.[0] || data || null);
    
    if (Array.isArray(data)) {
      result.record_count = data.length;
    } else if (data?.items && Array.isArray(data.items)) {
      result.record_count = data.items.length;
    } else if (data && typeof data === 'object') {
      result.record_count = 1;
    }

    // If we have a schema and sample data, validate fields
    if (endpoint.schema && result.response_sample && typeof result.response_sample === 'object') {
      const schema = SCHEMAS[endpoint.schema];
      if (schema) {
        // Check for missing required fields
        for (const [field, expectedType] of Object.entries(schema)) {
          if (!(field in result.response_sample)) {
            result.issues.push({
              type: 'missing_field',
              field: field,
              expected_type: expectedType
            });
          } else {
            // Validate type
            const value = result.response_sample[field];
            if (value === null && field !== 'partner_id' && field !== 'customer_id' && field !== 'supplier_id' && field !== 'account_id') {
              // Some fields can be null, but most shouldn't be
              if (!['partner_id', 'customer_id', 'supplier_id', 'account_id', 'description', 'email', 'phone'].includes(field)) {
                result.issues.push({
                  type: 'null_value',
                  field: field,
                  expected_type: expectedType
                });
              }
            } else {
              const typeCheck = validateType(value, expectedType);
              if (!typeCheck.valid) {
                result.issues.push({
                  type: 'type_mismatch',
                  field: field,
                  expected_type: expectedType,
                  actual_value: value,
                  reason: typeCheck.reason
                });
              }
            }
          }
        }

        // Check for extra fields (not in schema)
        for (const field in result.response_sample) {
          if (!(field in schema) && !['items', 'total', 'page', 'pageSize'].includes(field)) {
            result.issues.push({
              type: 'extra_field',
              field: field,
              value: result.response_sample[field]
            });
          }
        }
      }
    }

    // Special validations for specific endpoints
    if (endpoint.path.includes('/expenses') && result.response_sample) {
      // Check if expense has journal entry
      if (result.response_sample.status === 'posted' && result.response_sample.id) {
        const { rows } = await pool.query(
          'SELECT id FROM journal_entries WHERE reference_type = $1 AND reference_id = $2',
          ['expense', result.response_sample.id]
        );
        if (rows.length === 0) {
          result.issues.push({
            type: 'missing_journal_entry',
            reference_type: 'expense',
            reference_id: result.response_sample.id
          });
        }
      }
    }

    if (endpoint.path.includes('/invoices') && result.response_sample) {
      // Check if invoice has journal entry
      if (result.response_sample.status === 'posted' && result.response_sample.id) {
        const { rows } = await pool.query(
          'SELECT id FROM journal_entries WHERE reference_type = $1 AND reference_id = $2',
          ['invoice', result.response_sample.id]
        );
        if (rows.length === 0) {
          result.issues.push({
            type: 'missing_journal_entry',
            reference_type: 'invoice',
            reference_id: result.response_sample.id
          });
        }
      }
    }

  } catch (error) {
    result.status = error.response?.status || 0;
    result.issues.push({
      type: 'request_error',
      message: error.message,
      code: error.code
    });
  }

  return result;
}

// Generate repair SQL for issues
function generateRepairSQL(issues, endpoint) {
  const sqlQueries = [];
  
  for (const issue of issues) {
    if (issue.type === 'missing_field' || issue.type === 'null_value') {
      const table = endpoint.schema || 'unknown';
      if (table !== 'unknown') {
        // Get default value based on field type
        let defaultValue = 'NULL';
        if (issue.expected_type === 'text') {
          if (issue.field === 'branch') defaultValue = "'china_town'";
          else if (issue.field === 'status') defaultValue = "'draft'";
          else if (issue.field === 'description') defaultValue = "'No description provided'";
          else defaultValue = "''";
        } else if (issue.expected_type === 'numeric' || issue.expected_type === 'integer') {
          defaultValue = '0';
        } else if (issue.expected_type === 'date') {
          defaultValue = 'CURRENT_DATE';
        } else if (issue.expected_type === 'timestamp') {
          defaultValue = 'NOW()';
        }
        
        sqlQueries.push({
          type: 'update_missing_field',
          table: table,
          field: issue.field,
          sql: `UPDATE ${table} SET ${issue.field} = ${defaultValue} WHERE ${issue.field} IS NULL OR ${issue.field} = '';`
        });
      }
    } else if (issue.type === 'missing_journal_entry') {
      sqlQueries.push({
        type: 'create_journal_entry',
        reference_type: issue.reference_type,
        reference_id: issue.reference_id,
        sql: `-- TODO: Create journal entry for ${issue.reference_type} ${issue.reference_id}`
      });
    }
  }
  
  return sqlQueries;
}

// Main audit function
async function runAudit() {
  console.log('Starting API Endpoint Audit...\n');
  
  const results = [];
  const repairSQL = [];
  
  for (const endpoint of ENDPOINTS) {
    console.log(`Testing ${endpoint.method} ${endpoint.path}...`);
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.issues.length > 0) {
      console.log(`  ⚠️  Found ${result.issues.length} issues`);
      const sql = generateRepairSQL(result.issues, endpoint);
      if (sql.length > 0) {
        repairSQL.push(...sql);
      }
    } else {
      console.log(`  ✅ OK`);
    }
  }
  
  // Generate summary
  const summary = {
    total_endpoints: results.length,
    successful: results.filter(r => r.status >= 200 && r.status < 300).length,
    failed: results.filter(r => r.status < 200 || r.status >= 300).length,
    endpoints_with_issues: results.filter(r => r.issues.length > 0).length,
    total_issues: results.reduce((sum, r) => sum + r.issues.length, 0)
  };
  
  const report = {
    audit_date: new Date().toISOString(),
    summary: summary,
    endpoints: results,
    repair_sql: repairSQL
  };
  
  return report;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAudit()
    .then(report => {
      console.log('\n=== AUDIT SUMMARY ===');
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Audit failed:', error);
      process.exit(1);
    });
}

export { runAudit, testEndpoint, generateRepairSQL };
