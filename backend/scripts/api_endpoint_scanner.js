/**
 * API Endpoint Scanner
 * Scans server.js to extract all API endpoints automatically
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf-8');

// Extract all route definitions
const routePattern = /app\.(get|post|put|patch|delete)\(["']([^"']+)["']/gi;
const routes = [];
let match;

while ((match = routePattern.exec(serverContent)) !== null) {
  const method = match[1].toUpperCase();
  const path = match[2];
  
  // Skip static file routes and SPA fallback
  if (path.includes('*') || path.includes('static') || path === '/') {
    continue;
  }
  
  routes.push({ method, path });
}

// Group by path prefix
const grouped = {};
routes.forEach(route => {
  const prefix = route.path.split('/')[1] || 'root';
  if (!grouped[prefix]) grouped[prefix] = [];
  grouped[prefix].push(route);
});

console.log('=== API ENDPOINTS FOUND ===\n');
console.log(`Total routes: ${routes.length}\n`);

Object.entries(grouped).forEach(([prefix, routes]) => {
  console.log(`\n[${prefix.toUpperCase()}]`);
  routes.forEach(r => {
    console.log(`  ${r.method.padEnd(6)} ${r.path}`);
  });
});

console.log('\n=== ENDPOINT LIST (JSON) ===\n');
console.log(JSON.stringify(routes, null, 2));
