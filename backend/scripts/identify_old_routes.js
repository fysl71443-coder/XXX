/**
 * Script to identify old route handlers in server.js that should be deleted
 * These routes have been extracted to routes/controllers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(serverPath, 'utf-8');

// Routes that have been extracted
const extractedRoutes = [
  '/api/auth/login',
  '/api/auth/me',
  '/auth/login',
  '/auth/me',
  '/api/journal',
  '/journal',
  '/api/orders',
  '/orders',
  '/api/invoices',
  '/invoices',
  '/api/pos/',
  '/pos/',
  '/api/expenses',
  '/expenses',
  '/api/partners',
  '/partners',
  '/api/customers',
  '/customers',
  '/api/products',
  '/products',
  '/api/accounts',
  '/accounts',
  '/api/users',
  '/users',
  '/api/settings',
  '/settings',
  '/api/reports/',
  '/reports/'
];

// Find all route definitions
const routePattern = /app\.(get|post|put|delete)\s*\(\s*["']([^"']+)["']/g;
const routes = [];
let match;

while ((match = routePattern.exec(content)) !== null) {
  const method = match[1];
  const route = match[2];
  const lineNumber = content.substring(0, match.index).split('\n').length;
  
  // Check if this route has been extracted
  const isExtracted = extractedRoutes.some(extracted => {
    if (extracted.endsWith('/')) {
      return route.startsWith(extracted);
    }
    return route === extracted || route.startsWith(extracted + '/');
  });
  
  routes.push({
    method,
    route,
    lineNumber,
    isExtracted,
    matchIndex: match.index
  });
}

console.log('='.repeat(80));
console.log('Old Routes Analysis');
console.log('='.repeat(80));
console.log(`\nTotal routes found: ${routes.length}`);
console.log(`Extracted routes: ${routes.filter(r => r.isExtracted).length}`);
console.log(`Routes to keep: ${routes.filter(r => !r.isExtracted).length}`);

console.log('\n' + '='.repeat(80));
console.log('Extracted Routes (should be deleted):');
console.log('='.repeat(80));
routes.filter(r => r.isExtracted).forEach(r => {
  console.log(`Line ${r.lineNumber}: ${r.method.toUpperCase().padEnd(6)} ${r.route}`);
});

console.log('\n' + '='.repeat(80));
console.log('Routes to Keep:');
console.log('='.repeat(80));
routes.filter(r => !r.isExtracted).forEach(r => {
  console.log(`Line ${r.lineNumber}: ${r.method.toUpperCase().padEnd(6)} ${r.route}`);
});

// Save to file for reference
const output = {
  extracted: routes.filter(r => r.isExtracted).map(r => ({
    method: r.method,
    route: r.route,
    lineNumber: r.lineNumber
  })),
  keep: routes.filter(r => !r.isExtracted).map(r => ({
    method: r.method,
    route: r.route,
    lineNumber: r.lineNumber
  }))
};

fs.writeFileSync(
  path.join(__dirname, '..', 'old_routes_analysis.json'),
  JSON.stringify(output, null, 2)
);

console.log('\n✅ Analysis saved to old_routes_analysis.json');
