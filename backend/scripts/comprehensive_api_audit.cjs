/**
 * Comprehensive API Endpoint Audit
 * Tests all endpoints and validates against database schema
 */

const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:10000';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Set this for authenticated tests

// Database schemas
const SCHEMAS = {
  expenses: ['id', 'type', 'amount', 'account_code', 'partner_id', 'description', 'status', 'branch', 'date', 'payment_method', 'created_at', 'updated_at'],
  invoices: ['id', 'number', 'date', 'customer_id', 'lines', 'subtotal', 'discount_pct', 'discount_amount', 'tax_pct', 'tax_amount', 'total', 'payment_method', 'status', 'branch', 'created_at', 'updated_at'],
  supplier_invoices: ['id', 'number', 'date', 'due_date', 'supplier_id', 'subtotal', 'discount_pct', 'discount_amount', 'tax_pct', 'tax_amount', 'total', 'payment_method', 'status', 'branch', 'created_at', 'updated_at'],
  journal_entries: ['id', 'entry_number', 'description', 'date', 'period', 'reference_type', 'reference_id', 'status', 'created_at'],
  journal_postings: ['id', 'journal_entry_id', 'account_id', 'debit', 'credit'],
  orders: ['id', 'branch', 'table_code', 'lines', 'status', 'created_at', 'updated_at'],
  partners: ['id', 'name', 'type', 'email', 'phone', 'customer_type', 'account_id', 'created_at', 'updated_at'],
  employees: ['id', 'full_name', 'employee_number', 'basic_salary', 'status', 'created_at', 'updated_at']
};

// Extract all endpoints from server.js
function extractEndpoints() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  const content = fs.readFileSync(serverPath, 'utf-8');
  
  const routes = [];
  const pattern = /app\.(get|post|put|patch|delete)\(["']([^"']+)["']/gi;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    
    // Skip static files and SPA fallback
    if (path.includes('*') || path.includes('static') || path === '/' || path.includes('favicon') || path.includes('manifest') || path.includes('robots')) {
      continue;
    }
    
    routes.push({ method, path });
  }
  
  return routes;
}

// Test single endpoint
async function testEndpoint(endpoint, client) {
  const result = {
    endpoint: endpoint.path,
    method: endpoint.method,
    status: null,
    response_time_ms: null,
    issues: [],
    response_sample: null,
    record_count: null,
    schema_validation: null
  };

  try {
    const startTime = Date.now();
    const config = {
      method: endpoint.method,
      url: `${API_BASE}${endpoint.path}`,
      headers: endpoint.requiresAuth && TEST_TOKEN ? { 'Authorization': `Bearer ${TEST_TOKEN}` } : {},
      data: endpoint.testData || undefined,
      validateStatus: () => true
    };

    const response = await axios(config);
    result.status = response.status;
    result.response_time_ms = Date.now() - startTime;

    if (response.status < 200 || response.status >= 300) {
      result.issues.push({
        type: 'http_error',
        status_code: response.status,
        message: response.statusText || response.data?.error || 'Unknown error'
      });
      return result;
    }

    const data = response.data;
    
    // Handle different response formats
    let records = [];
    if (Array.isArray(data)) {
      records = data;
    } else if (data?.items && Array.isArray(data.items)) {
      records = data.items;
    } else if (data && typeof data === 'object') {
      records = [data];
    }
    
    result.record_count = records.length;
    result.response_sample = records[0] || data || null;

    // Determine schema from endpoint path
    let schemaName = null;
    if (endpoint.path.includes('/expenses')) schemaName = 'expenses';
    else if (endpoint.path.includes('/invoices') && !endpoint.path.includes('supplier')) schemaName = 'invoices';
    else if (endpoint.path.includes('/supplier-invoices')) schemaName = 'supplier_invoices';
    else if (endpoint.path.includes('/journal') && !endpoint.path.includes('postings')) schemaName = 'journal_entries';
    else if (endpoint.path.includes('/orders')) schemaName = 'orders';
    else if (endpoint.path.includes('/partners')) schemaName = 'partners';
    else if (endpoint.path.includes('/employees')) schemaName = 'employees';

    // Validate against schema
    if (schemaName && SCHEMAS[schemaName] && result.response_sample) {
      const schema = SCHEMAS[schemaName];
      const sample = result.response_sample;
      
      result.schema_validation = {
        expected_fields: schema.length,
        found_fields: Object.keys(sample).length,
        missing_fields: [],
        null_fields: [],
        type_mismatches: []
      };

      // Check for missing fields
      for (const field of schema) {
        if (!(field in sample)) {
          result.schema_validation.missing_fields.push(field);
          result.issues.push({
            type: 'missing_field',
            field: field,
            table: schemaName
          });
        } else if (sample[field] === null || sample[field] === undefined) {
          // Some fields can be null (foreign keys, optional fields)
          const nullableFields = ['partner_id', 'customer_id', 'supplier_id', 'account_id', 'description', 'email', 'phone', 'due_date', 'reference_id', 'reference_type'];
          if (!nullableFields.includes(field)) {
            result.schema_validation.null_fields.push(field);
            result.issues.push({
              type: 'null_value',
              field: field,
              table: schemaName
            });
          }
        }
      }
    }

    // Check for journal entries for posted expenses/invoices
    if (schemaName === 'expenses' && result.response_sample?.status === 'posted' && result.response_sample?.id) {
      const { rows } = await client.query(
        'SELECT id FROM journal_entries WHERE reference_type = $1 AND reference_id = $2',
        ['expense', result.response_sample.id]
      );
      if (rows.length === 0) {
        result.issues.push({
          type: 'missing_journal_entry',
          reference_type: 'expense',
          reference_id: result.response_sample.id,
          severity: 'high'
        });
      }
    }

    if (schemaName === 'invoices' && result.response_sample?.status === 'posted' && result.response_sample?.id) {
      const { rows } = await client.query(
        'SELECT id FROM journal_entries WHERE reference_type = $1 AND reference_id = $2',
        ['invoice', result.response_sample.id]
      );
      if (rows.length === 0) {
        result.issues.push({
          type: 'missing_journal_entry',
          reference_type: 'invoice',
          reference_id: result.response_sample.id,
          severity: 'high'
        });
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

// Generate repair SQL
function generateRepairSQL(issues, table) {
  const sql = [];
  
  for (const issue of issues) {
    if (issue.type === 'missing_field' || issue.type === 'null_value') {
      let defaultValue = 'NULL';
      if (issue.field === 'branch') defaultValue = "'china_town'";
      else if (issue.field === 'status') defaultValue = "'draft'";
      else if (issue.field === 'description') defaultValue = "'No description provided'";
      else if (issue.field === 'date') defaultValue = 'CURRENT_DATE';
      else if (issue.field === 'amount' || issue.field === 'total' || issue.field === 'subtotal') defaultValue = '0';
      else if (issue.field === 'payment_method') defaultValue = "'cash'";
      
      sql.push(`UPDATE ${table} SET ${issue.field} = ${defaultValue} WHERE ${issue.field} IS NULL OR ${issue.field} = '';`);
    }
  }
  
  return sql;
}

// Main audit function
async function runAudit() {
  console.log('=== COMPREHENSIVE API AUDIT ===\n');
  console.log(`Database: ${DATABASE_URL.split('@')[1] || 'local'}`);
  console.log(`API Base: ${API_BASE}\n`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✅ Connected to database\n');

  // Extract endpoints
  const allRoutes = extractEndpoints();
  console.log(`Found ${allRoutes.length} routes\n`);

  // Filter to API endpoints only
  const apiEndpoints = allRoutes.filter(r => 
    r.path.startsWith('/api/') || 
    ['/expenses', '/invoices', '/supplier-invoices', '/journal', '/orders', '/partners', '/employees', '/accounts', '/products'].some(p => r.path.startsWith(p))
  );

  console.log(`Testing ${apiEndpoints.length} API endpoints...\n`);

  const results = [];
  const repairSQL = [];

  for (const endpoint of apiEndpoints) {
    process.stdout.write(`Testing ${endpoint.method} ${endpoint.path}... `);
    const result = await testEndpoint(endpoint, client);
    results.push(result);
    
    if (result.issues.length > 0) {
      console.log(`⚠️  ${result.issues.length} issues`);
      const table = result.issues[0]?.table;
      if (table) {
        const sql = generateRepairSQL(result.issues, table);
        if (sql.length > 0) {
          repairSQL.push(...sql);
        }
      }
    } else if (result.status >= 200 && result.status < 300) {
      console.log(`✅ OK (${result.response_time_ms}ms)`);
    } else {
      console.log(`❌ ${result.status}`);
    }
  }

  await client.end();

  // Generate summary
  const summary = {
    total_endpoints: results.length,
    successful: results.filter(r => r.status >= 200 && r.status < 300).length,
    failed: results.filter(r => r.status < 200 || r.status >= 300).length,
    endpoints_with_issues: results.filter(r => r.issues.length > 0).length,
    total_issues: results.reduce((sum, r) => sum + r.issues.length, 0),
    issue_breakdown: {
      missing_fields: results.filter(r => r.issues.some(i => i.type === 'missing_field')).length,
      null_values: results.filter(r => r.issues.some(i => i.type === 'null_value')).length,
      missing_journal_entries: results.filter(r => r.issues.some(i => i.type === 'missing_journal_entry')).length,
      http_errors: results.filter(r => r.issues.some(i => i.type === 'http_error')).length
    }
  };

  const report = {
    audit_date: new Date().toISOString(),
    summary: summary,
    endpoints: results,
    repair_sql: [...new Set(repairSQL)] // Remove duplicates
  };

  // Save report
  const reportPath = path.join(__dirname, 'api_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to: ${reportPath}`);

  return report;
}

// Run if called directly
if (require.main === module) {
  runAudit()
    .then(report => {
      console.log('\n=== AUDIT SUMMARY ===');
      console.log(`Total Endpoints: ${report.summary.total_endpoints}`);
      console.log(`Successful: ${report.summary.successful}`);
      console.log(`Failed: ${report.summary.failed}`);
      console.log(`With Issues: ${report.summary.endpoints_with_issues}`);
      console.log(`Total Issues: ${report.summary.total_issues}`);
      console.log(`\nRepair SQL Queries: ${report.repair_sql.length}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Audit failed:', error);
      process.exit(1);
    });
}

module.exports = { runAudit, testEndpoint };
