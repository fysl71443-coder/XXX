/**
 * Static API Analysis
 * Analyzes server.js code to generate comprehensive API endpoint report
 * without requiring live server connection
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(serverPath, 'utf-8');

// Database schema from ensureSchema()
const SCHEMAS = {
  expenses: {
    id: { type: 'integer', nullable: false },
    type: { type: 'text', nullable: true },
    amount: { type: 'numeric', nullable: false, default: 0 },
    account_code: { type: 'text', nullable: true },
    partner_id: { type: 'integer', nullable: true },
    description: { type: 'text', nullable: true },
    status: { type: 'text', nullable: false, default: 'draft' },
    branch: { type: 'text', nullable: true },
    date: { type: 'date', nullable: false, default: 'CURRENT_DATE' },
    payment_method: { type: 'text', nullable: false, default: 'cash' },
    created_at: { type: 'timestamp', nullable: false },
    updated_at: { type: 'timestamp', nullable: false }
  },
  invoices: {
    id: { type: 'integer', nullable: false },
    number: { type: 'text', nullable: true },
    date: { type: 'date', nullable: true },
    customer_id: { type: 'integer', nullable: true },
    lines: { type: 'jsonb', nullable: true },
    subtotal: { type: 'numeric', nullable: false, default: 0 },
    discount_pct: { type: 'numeric', nullable: false, default: 0 },
    discount_amount: { type: 'numeric', nullable: false, default: 0 },
    tax_pct: { type: 'numeric', nullable: false, default: 0 },
    tax_amount: { type: 'numeric', nullable: false, default: 0 },
    total: { type: 'numeric', nullable: false, default: 0 },
    payment_method: { type: 'text', nullable: true },
    status: { type: 'text', nullable: false, default: 'draft' },
    branch: { type: 'text', nullable: true },
    created_at: { type: 'timestamp', nullable: false },
    updated_at: { type: 'timestamp', nullable: false }
  },
  supplier_invoices: {
    id: { type: 'integer', nullable: false },
    number: { type: 'text', nullable: true },
    date: { type: 'date', nullable: true },
    due_date: { type: 'date', nullable: true },
    supplier_id: { type: 'integer', nullable: true },
    subtotal: { type: 'numeric', nullable: false, default: 0 },
    discount_pct: { type: 'numeric', nullable: false, default: 0 },
    discount_amount: { type: 'numeric', nullable: false, default: 0 },
    tax_pct: { type: 'numeric', nullable: false, default: 0 },
    tax_amount: { type: 'numeric', nullable: false, default: 0 },
    total: { type: 'numeric', nullable: false, default: 0 },
    payment_method: { type: 'text', nullable: true },
    status: { type: 'text', nullable: false, default: 'draft' },
    branch: { type: 'text', nullable: true },
    created_at: { type: 'timestamp', nullable: false },
    updated_at: { type: 'timestamp', nullable: false }
  },
  journal_entries: {
    id: { type: 'integer', nullable: false },
    entry_number: { type: 'integer', nullable: true },
    description: { type: 'text', nullable: true },
    date: { type: 'date', nullable: true },
    period: { type: 'text', nullable: true },
    reference_type: { type: 'text', nullable: true },
    reference_id: { type: 'integer', nullable: true },
    status: { type: 'text', nullable: false, default: 'draft' },
    created_at: { type: 'timestamp', nullable: false }
  },
  journal_postings: {
    id: { type: 'integer', nullable: false },
    journal_entry_id: { type: 'integer', nullable: false },
    account_id: { type: 'integer', nullable: true },
    debit: { type: 'numeric', nullable: false, default: 0 },
    credit: { type: 'numeric', nullable: false, default: 0 }
  },
  orders: {
    id: { type: 'integer', nullable: false },
    branch: { type: 'text', nullable: true },
    table_code: { type: 'text', nullable: true },
    lines: { type: 'jsonb', nullable: true },
    status: { type: 'text', nullable: false, default: 'DRAFT' },
    created_at: { type: 'timestamp', nullable: false },
    updated_at: { type: 'timestamp', nullable: false }
  },
  partners: {
    id: { type: 'integer', nullable: false },
    name: { type: 'text', nullable: false },
    type: { type: 'text', nullable: true },
    email: { type: 'text', nullable: true },
    phone: { type: 'text', nullable: true },
    customer_type: { type: 'text', nullable: true },
    account_id: { type: 'integer', nullable: true },
    created_at: { type: 'timestamp', nullable: false },
    updated_at: { type: 'timestamp', nullable: false }
  },
  employees: {
    id: { type: 'integer', nullable: false },
    full_name: { type: 'text', nullable: true },
    employee_number: { type: 'text', nullable: true },
    basic_salary: { type: 'numeric', nullable: true },
    status: { type: 'text', nullable: true },
    created_at: { type: 'timestamp', nullable: false },
    updated_at: { type: 'timestamp', nullable: false }
  }
};

// Extract all routes
function extractRoutes() {
  const routes = [];
  const pattern = /app\.(get|post|put|patch|delete)\(["']([^"']+)["']/gi;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    
    // Skip static files
    if (path.includes('*') || path.includes('static') || path === '/' || 
        path.includes('favicon') || path.includes('manifest') || path.includes('robots')) {
      continue;
    }
    
    routes.push({ method, path });
  }
  
  return routes;
}

// Analyze endpoint implementation
function analyzeEndpoint(route) {
  const result = {
    endpoint: route.path,
    method: route.method,
    requires_auth: false,
    requires_authorization: false,
    authorization_screen: null,
    authorization_action: null,
    middleware: [],
    creates_journal_entry: false,
    validates_accounting_period: false,
    issues: [],
    notes: []
  };

  // Find the route definition in code
  const routePattern = new RegExp(`app\\.${route.method.toLowerCase()}\\(["']${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g');
  const routeMatch = routePattern.exec(content);
  
  if (!routeMatch) {
    result.issues.push({ type: 'not_found', message: 'Route definition not found in code' });
    return result;
  }

  // Get code after route definition
  const startIndex = routeMatch.index;
  const codeAfter = content.substring(startIndex, startIndex + 2000);
  
  // Check for authentication
  if (codeAfter.includes('authenticateToken')) {
    result.requires_auth = true;
    result.middleware.push('authenticateToken');
  }
  
  // Check for authorization
  const authMatch = codeAfter.match(/authorize\(["']([^"']+)["'],\s*["']([^"']+)["']/);
  if (authMatch) {
    result.requires_authorization = true;
    result.authorization_screen = authMatch[1];
    result.authorization_action = authMatch[2];
    result.middleware.push(`authorize(${authMatch[1]}, ${authMatch[2]})`);
  }
  
  // Check for accounting period validation
  if (codeAfter.includes('checkAccountingPeriod')) {
    result.validates_accounting_period = true;
    result.middleware.push('checkAccountingPeriod');
  }
  
  // Check for journal entry creation
  if (codeAfter.includes('createInvoiceJournalEntry') || 
      codeAfter.includes('journal_entries') || 
      codeAfter.includes('INSERT INTO journal_entries')) {
    result.creates_journal_entry = true;
    result.notes.push('Automatically creates journal entries');
  }
  
  // Determine schema
  if (route.path.includes('/expenses')) {
    result.schema = 'expenses';
  } else if (route.path.includes('/invoices') && !route.path.includes('supplier')) {
    result.schema = 'invoices';
  } else if (route.path.includes('/supplier-invoices')) {
    result.schema = 'supplier_invoices';
  } else if (route.path.includes('/journal') && !route.path.includes('postings')) {
    result.schema = 'journal_entries';
  } else if (route.path.includes('/orders')) {
    result.schema = 'orders';
  } else if (route.path.includes('/partners')) {
    result.schema = 'partners';
  } else if (route.path.includes('/employees')) {
    result.schema = 'employees';
  }
  
  // Check for potential issues
  if (result.schema && route.method === 'POST') {
    const schema = SCHEMAS[result.schema];
    if (schema) {
      // Check if required fields are handled
      for (const [field, def] of Object.entries(schema)) {
        if (!def.nullable && !def.default && !codeAfter.includes(field)) {
          result.issues.push({
            type: 'missing_required_field',
            field: field,
            severity: 'medium',
            message: `Required field '${field}' may not be handled in ${route.method} ${route.path}`
          });
        }
      }
    }
  }
  
  // Check for missing journal entry creation for posted transactions
  if (result.schema === 'expenses' && route.method === 'POST' && !result.creates_journal_entry) {
    result.issues.push({
      type: 'missing_journal_entry_logic',
      severity: 'high',
      message: 'POST /expenses should create journal entries for posted expenses'
    });
  }
  
  if (result.schema === 'invoices' && route.method === 'POST' && !result.creates_journal_entry) {
    result.issues.push({
      type: 'missing_journal_entry_logic',
      severity: 'high',
      message: 'POST /invoices should create journal entries for posted invoices'
    });
  }

  return result;
}

// Generate repair SQL
function generateRepairSQL(issues) {
  const sql = [];
  
  for (const issue of issues) {
    if (issue.type === 'missing_required_field' && issue.field) {
      const table = issue.endpoint?.includes('/expenses') ? 'expenses' :
                   issue.endpoint?.includes('/invoices') ? 'invoices' :
                   issue.endpoint?.includes('/supplier-invoices') ? 'supplier_invoices' : null;
      
      if (table) {
        let defaultValue = 'NULL';
        if (issue.field === 'branch') defaultValue = "'china_town'";
        else if (issue.field === 'status') defaultValue = "'draft'";
        else if (issue.field === 'description') defaultValue = "'No description provided'";
        else if (issue.field === 'date') defaultValue = 'CURRENT_DATE';
        else if (issue.field === 'amount' || issue.field === 'total' || issue.field === 'subtotal') defaultValue = '0';
        else if (issue.field === 'payment_method') defaultValue = "'cash'";
        
        sql.push({
          type: 'update_missing_field',
          table: table,
          field: issue.field,
          sql: `UPDATE ${table} SET ${issue.field} = ${defaultValue} WHERE ${issue.field} IS NULL;`
        });
      }
    }
  }
  
  return sql;
}

// Main analysis
function runAnalysis() {
  console.log('=== STATIC API ANALYSIS ===\n');
  
  const routes = extractRoutes();
  console.log(`Found ${routes.length} total routes\n`);
  
  // Filter to API endpoints
  const apiRoutes = routes.filter(r => 
    r.path.startsWith('/api/') || 
    ['/expenses', '/invoices', '/supplier-invoices', '/journal', '/orders', 
     '/partners', '/employees', '/accounts', '/products'].some(p => r.path.startsWith(p))
  );
  
  console.log(`Analyzing ${apiRoutes.length} API endpoints...\n`);
  
  const results = [];
  const allIssues = [];
  
  for (const route of apiRoutes) {
    const analysis = analyzeEndpoint(route);
    results.push(analysis);
    allIssues.push(...analysis.issues.map(i => ({ ...i, endpoint: route.path, method: route.method })));
  }
  
  // Generate summary
  const summary = {
    total_endpoints: results.length,
    authenticated: results.filter(r => r.requires_auth).length,
    authorized: results.filter(r => r.requires_authorization).length,
    with_accounting_period_check: results.filter(r => r.validates_accounting_period).length,
    create_journal_entries: results.filter(r => r.creates_journal_entry).length,
    endpoints_with_issues: results.filter(r => r.issues.length > 0).length,
    total_issues: results.reduce((sum, r) => sum + r.issues.length, 0),
    issue_breakdown: {
      missing_required_field: allIssues.filter(i => i.type === 'missing_required_field').length,
      missing_journal_entry_logic: allIssues.filter(i => i.type === 'missing_journal_entry_logic').length,
      not_found: allIssues.filter(i => i.type === 'not_found').length
    }
  };
  
  const report = {
    analysis_date: new Date().toISOString(),
    analysis_type: 'static_code_analysis',
    summary: summary,
    endpoints: results,
    repair_sql: generateRepairSQL(allIssues)
  };
  
  return report;
}

// Run and save
const report = runAnalysis();
const reportPath = path.join(__dirname, 'static_api_analysis_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('=== ANALYSIS SUMMARY ===');
console.log(`Total Endpoints: ${report.summary.total_endpoints}`);
console.log(`Authenticated: ${report.summary.authenticated}`);
console.log(`Authorized: ${report.summary.authorized}`);
console.log(`With Accounting Period Check: ${report.summary.with_accounting_period_check}`);
console.log(`Create Journal Entries: ${report.summary.create_journal_entries}`);
console.log(`Endpoints with Issues: ${report.summary.endpoints_with_issues}`);
console.log(`Total Issues: ${report.summary.total_issues}`);
console.log(`\n✅ Report saved to: ${reportPath}`);

module.exports = { runAnalysis };
