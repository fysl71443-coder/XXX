/**
 * Script to safely remove old route handlers from server.js
 * These routes have been extracted to routes/controllers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', 'server.js');
const analysisPath = path.join(__dirname, '..', 'old_routes_analysis.json');

// Read files
const content = fs.readFileSync(serverPath, 'utf-8');
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

const lines = content.split('\n');
const extractedRoutes = analysis.extracted;

// Sort by line number (descending) to delete from bottom to top
extractedRoutes.sort((a, b) => b.lineNumber - a.lineNumber);

console.log(`Found ${extractedRoutes.length} routes to remove`);
console.log(`Starting from line ${extractedRoutes[0]?.lineNumber} down to ${extractedRoutes[extractedRoutes.length - 1]?.lineNumber}`);

// For each route, find the start and end of the handler function
// We need to find the app.get/post/put/delete line and the closing brace
let deletedLines = 0;
const linesToDelete = new Set();

for (const route of extractedRoutes) {
  const startLine = route.lineNumber - 1; // Convert to 0-based index
  
  // Find the start of the route handler
  if (startLine >= lines.length) continue;
  
  // Find the end of the handler function
  // Look for the closing brace and semicolon
  let braceCount = 0;
  let foundStart = false;
  let endLine = startLine;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is the route definition line
    if (line.includes(`app.${route.method}`) && line.includes(route.route)) {
      foundStart = true;
    }
    
    if (foundStart) {
      // Count braces
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      // If we've closed all braces and found a semicolon or closing brace, we're done
      if (braceCount === 0 && (line.includes('});') || line.trim() === '});')) {
        endLine = i;
        break;
      }
    }
  }
  
  // Mark lines for deletion
  for (let i = startLine; i <= endLine; i++) {
    linesToDelete.add(i);
  }
  
  deletedLines += (endLine - startLine + 1);
}

console.log(`Marked ${linesToDelete.size} lines for deletion`);

// Create new content without deleted lines
const newLines = lines.filter((_, index) => !linesToDelete.has(index));
const newContent = newLines.join('\n');

// Write backup first
const backupPath = path.join(__dirname, '..', 'server.js.backup');
fs.writeFileSync(backupPath, content);
console.log(`✅ Backup created: ${backupPath}`);

// Write new content
fs.writeFileSync(serverPath, newContent);
console.log(`✅ Removed ${deletedLines} lines from server.js`);
console.log(`✅ New file size: ${newLines.length} lines (was ${lines.length} lines)`);
