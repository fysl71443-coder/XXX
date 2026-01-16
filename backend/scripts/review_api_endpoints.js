/**
 * API Endpoints Review Script
 * Tests all API endpoints to ensure they work correctly
 * 
 * Usage: node backend/scripts/review_api_endpoints.js [baseUrl]
 * Example: node backend/scripts/review_api_endpoints.js http://localhost:5000
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.API_BASE_URL || process.argv[2] || 'http://localhost:5000';
const API_TOKEN = process.env.API_TOKEN || ''; // Set this if you have a token

const report = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  endpoints: {},
  total: 0,
  passed: 0,
  failed: 0,
  issues: []
};

// Endpoints to test
const endpoints = [
  // Accounts
  { method: 'GET', path: '/api/accounts', requiresAuth: true, description: 'List accounts' },
  { method: 'GET', path: '/api/accounts/tree', requiresAuth: true, description: 'Get accounts tree' },
  
  // Products
  { method: 'GET', path: '/api/products', requiresAuth: true, description: 'List products' },
  
  // Employees
  { method: 'GET', path: '/api/employees', requiresAuth: true, description: 'List employees' },
  
  // Orders
  { method: 'GET', path: '/api/orders', requiresAuth: true, description: 'List orders' },
  { method: 'GET', path: '/api/orders?branch=place_india&status=DRAFT', requiresAuth: true, description: 'List draft orders for place_india' },
  
  // Partners
  { method: 'GET', path: '/api/partners', requiresAuth: true, description: 'List partners' },
  { method: 'GET', path: '/api/partners?type=customer', requiresAuth: true, description: 'List customers' },
  { method: 'GET', path: '/api/partners?type=supplier', requiresAuth: true, description: 'List suppliers' },
  
  // Branches
  { method: 'GET', path: '/api/branches', requiresAuth: true, description: 'List branches' },
  
  // Settings
  { method: 'GET', path: '/api/settings/company', requiresAuth: true, description: 'Get company settings' },
];

function makeRequest(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (API_TOKEN) {
      options.headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          parsedData = data;
        }
        
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsedData,
          raw: data
        });
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const key = `${endpoint.method} ${endpoint.path}`;
  
  console.log(`Testing: ${key}...`);
  
  const result = {
    endpoint: key,
    description: endpoint.description,
    method: endpoint.method,
    path: endpoint.path,
    status: null,
    success: false,
    error: null,
    responseTime: null,
    dataType: null,
    dataLength: null
  };
  
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(endpoint.method, url);
    result.status = response.status;
    result.responseTime = Date.now() - startTime;
    result.dataType = Array.isArray(response.data) ? 'array' : typeof response.data;
    result.dataLength = Array.isArray(response.data) ? response.data.length : 
                       (typeof response.data === 'object' && response.data !== null ? Object.keys(response.data).length : 
                       (typeof response.data === 'string' ? response.data.length : 0));
    
    // Check if successful
    if (response.status >= 200 && response.status < 300) {
      result.success = true;
      report.passed++;
      
      // Additional checks
      if (endpoint.path.includes('/orders') && Array.isArray(response.data)) {
        // Check if orders have lines
        const ordersWithLines = response.data.filter(o => {
          if (!o.lines && !o.items) return false;
          const lines = o.lines || o.items || [];
          return Array.isArray(lines) ? lines.length > 0 : false;
        });
        
        if (ordersWithLines.length < response.data.length) {
          result.warning = `${response.data.length - ordersWithLines.length} orders without lines/items`;
        }
      }
      
      console.log(`  ✅ ${response.status} (${result.responseTime}ms) - ${result.dataType}${result.dataLength ? ` (${result.dataLength})` : ''}`);
    } else if (response.status === 401 || response.status === 403) {
      result.success = false;
      result.error = 'Authentication/Authorization failed';
      result.warning = 'May need valid token';
      report.failed++;
      console.log(`  ⚠️  ${response.status} - ${result.error}`);
    } else {
      result.success = false;
      result.error = `HTTP ${response.status}`;
      report.failed++;
      console.log(`  ❌ ${response.status} - ${result.error}`);
    }
    
  } catch (e) {
    result.success = false;
    result.error = e.message;
    result.responseTime = Date.now() - startTime;
    report.failed++;
    console.log(`  ❌ Error: ${e.message}`);
  }
  
  report.endpoints[key] = result;
  report.total++;
  
  return result;
}

async function main() {
  console.log('🚀 Starting API Endpoints Review...\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  
  if (!API_TOKEN) {
    console.log('⚠️  No API_TOKEN provided - some endpoints may fail with 401/403\n');
  }
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Total: ${report.total}`);
  console.log(`  Passed: ${report.passed}`);
  console.log(`  Failed: ${report.failed}`);
  console.log(`  Success Rate: ${((report.passed / report.total) * 100).toFixed(1)}%`);
  
  // Save report
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '..', 'api_review_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to: ${reportPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEndpoint, endpoints };
