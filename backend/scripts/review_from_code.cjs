/**
 * System Review from Code Analysis
 * Analyzes server.js to extract database schema and API endpoints
 * 
 * Usage: node backend/scripts/review_from_code.cjs
 */

const fs = require('fs');
const path = require('path');

const report = {
  timestamp: new Date().toISOString(),
  source: 'code_analysis',
  database: {
    tables: [],
    endpoints: []
  },
  apis: {
    get: [],
    post: [],
    put: [],
    delete: []
  },
  issues: [],
  recommendations: []
};

function analyzeServerCode() {
  console.log('📖 Analyzing server.js...\n');
  
  const serverPath = path.join(__dirname, '..', 'server.js');
  if (!fs.existsSync(serverPath)) {
    report.issues.push('server.js not found');
    return;
  }
  
  const content = fs.readFileSync(serverPath, 'utf8');
  
  // Extract table definitions
  const tableMatches = content.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/gi);
  const tables = new Set();
  for (const match of tableMatches) {
    tables.add(match[1]);
  }
  report.database.tables = Array.from(tables).sort();
  
  console.log(`Found ${tables.size} tables:`);
  report.database.tables.forEach(t => console.log(`  - ${t}`));
  
  // Extract API endpoints
  const endpointPatterns = [
    { method: 'GET', regex: /app\.get\(["']([^"']+)["']/g },
    { method: 'POST', regex: /app\.post\(["']([^"']+)["']/g },
    { method: 'PUT', regex: /app\.put\(["']([^"']+)["']/g },
    { method: 'DELETE', regex: /app\.delete\(["']([^"']+)["']/g }
  ];
  
  endpointPatterns.forEach(({ method, regex }) => {
    const endpoints = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1];
      if (!path.startsWith('/static/') && !path.includes('*')) {
        endpoints.push(path);
      }
    }
    report.apis[method.toLowerCase()] = [...new Set(endpoints)].sort();
  });
  
  console.log(`\n📡 Found API endpoints:`);
  console.log(`  GET: ${report.apis.get.length}`);
  console.log(`  POST: ${report.apis.post.length}`);
  console.log(`  PUT: ${report.apis.put.length}`);
  console.log(`  DELETE: ${report.apis.delete.length}`);
  
  // Check for critical endpoints
  const criticalEndpoints = {
    'GET /api/accounts': report.apis.get.includes('/api/accounts'),
    'GET /api/employees': report.apis.get.includes('/api/employees'),
    'GET /api/orders': report.apis.get.includes('/api/orders'),
    'POST /api/pos/saveDraft': report.apis.post.includes('/api/pos/saveDraft'),
    'POST /api/employees': report.apis.post.includes('/api/employees'),
    'GET /api/employees/:id': report.apis.get.some(e => e.includes('/api/employees/') && e.includes(':id'))
  };
  
  console.log(`\n✅ Critical endpoints check:`);
  Object.entries(criticalEndpoints).forEach(([endpoint, exists]) => {
    const status = exists ? '✅' : '❌';
    console.log(`  ${status} ${endpoint}`);
    if (!exists) {
      report.issues.push(`Missing endpoint: ${endpoint}`);
    }
  });
  
  // Check for employees table structure (check both CREATE TABLE and ALTER TABLE)
  const employeesTableMatch = content.match(/CREATE TABLE IF NOT EXISTS employees\s*\(([^)]+)\)/is);
  const employeesAlterMatches = content.matchAll(/ALTER TABLE employees ADD COLUMN IF NOT EXISTS (\w+)/gi);
  const alterColumns = new Set();
  for (const match of employeesAlterMatches) {
    alterColumns.add(match[1]);
  }
  
  let hasFullName = false, hasBasicSalary = false, hasHousingAllowance = false;
  
  if (employeesTableMatch) {
    const tableDef = employeesTableMatch[1];
    hasFullName = tableDef.includes('full_name');
    hasBasicSalary = tableDef.includes('basic_salary');
    hasHousingAllowance = tableDef.includes('housing_allowance');
  }
  
  // Also check ALTER TABLE statements
  if (!hasFullName) hasFullName = alterColumns.has('full_name');
  if (!hasBasicSalary) hasBasicSalary = alterColumns.has('basic_salary');
  if (!hasHousingAllowance) hasHousingAllowance = alterColumns.has('housing_allowance');
  
  console.log(`\n📋 Employees table structure:`);
  console.log(`  full_name: ${hasFullName ? '✅' : '❌'}`);
  console.log(`  basic_salary: ${hasBasicSalary ? '✅' : '❌'}`);
  console.log(`  housing_allowance: ${hasHousingAllowance ? '✅' : '❌'}`);
  
  if (!hasFullName || !hasBasicSalary || !hasHousingAllowance) {
    report.issues.push('Employees table missing required columns');
  }
  
  // Check for orders table structure
  const ordersTableMatch = content.match(/CREATE TABLE IF NOT EXISTS orders\s*\(([^)]+)\)/is);
  if (ordersTableMatch) {
    const tableDef = ordersTableMatch[1];
    const hasLines = tableDef.includes('lines JSONB') || tableDef.includes('lines JSON');
    const hasBranch = tableDef.includes('branch');
    const hasTableCode = tableDef.includes('table_code');
    const hasStatus = tableDef.includes('status');
    
    console.log(`\n📋 Orders table structure:`);
    console.log(`  lines (JSONB): ${hasLines ? '✅' : '❌'}`);
    console.log(`  branch: ${hasBranch ? '✅' : '❌'}`);
    console.log(`  table_code: ${hasTableCode ? '✅' : '❌'}`);
    console.log(`  status: ${hasStatus ? '✅' : '❌'}`);
    
    if (!hasLines || !hasBranch || !hasTableCode || !hasStatus) {
      report.issues.push('Orders table missing required columns');
    }
  }
  
  // Check handleSaveDraft function
  const hasSaveDraft = content.includes('handleSaveDraft') || content.includes('saveDraft');
  const hasTypeMeta = content.includes("type: 'meta'") || content.includes('type: "meta"');
  const hasTypeItem = content.includes("type: 'item'") || content.includes('type: "item"');
  
  console.log(`\n🔧 handleSaveDraft function:`);
  console.log(`  Function exists: ${hasSaveDraft ? '✅' : '❌'}`);
  console.log(`  Creates type: 'meta': ${hasTypeMeta ? '✅' : '❌'}`);
  console.log(`  Creates type: 'item': ${hasTypeItem ? '✅' : '❌'}`);
  
  if (!hasSaveDraft) {
    report.issues.push('handleSaveDraft function not found');
  }
  if (!hasTypeMeta || !hasTypeItem) {
    report.issues.push('handleSaveDraft may not be creating proper lines format');
  }
}

function generateReport() {
  const reportPath = path.join(__dirname, '..', 'code_review_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📝 Report saved to: ${reportPath}`);
  
  console.log('\n📊 Summary:');
  console.log(`  Tables found: ${report.database.tables.length}`);
  console.log(`  GET endpoints: ${report.apis.get.length}`);
  console.log(`  POST endpoints: ${report.apis.post.length}`);
  console.log(`  PUT endpoints: ${report.apis.put.length}`);
  console.log(`  DELETE endpoints: ${report.apis.delete.length}`);
  console.log(`  Issues found: ${report.issues.length}`);
  
  if (report.issues.length > 0) {
    console.log('\n⚠️  Issues:');
    report.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  // List all endpoints
  console.log('\n📡 All GET endpoints:');
  report.apis.get.slice(0, 20).forEach(e => console.log(`  - ${e}`));
  if (report.apis.get.length > 20) {
    console.log(`  ... and ${report.apis.get.length - 20} more`);
  }
  
  console.log('\n📡 All POST endpoints:');
  report.apis.post.slice(0, 20).forEach(e => console.log(`  - ${e}`));
  if (report.apis.post.length > 20) {
    console.log(`  ... and ${report.apis.post.length - 20} more`);
  }
}

function main() {
  console.log('🚀 Starting Code-Based System Review...\n');
  
  analyzeServerCode();
  generateReport();
  
  console.log('\n✅ Code review completed!');
  console.log('\n💡 Note: For database connection, use:');
  console.log('   psql postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv');
  console.log('   Then run queries from: backend/scripts/review_database_queries.sql');
}

if (require.main === module) {
  main();
}

module.exports = { analyzeServerCode, generateReport };
