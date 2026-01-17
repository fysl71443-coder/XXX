/**
 * Quick API Audit Runner
 * Connects to Render database and tests all endpoints
 */

require('dotenv').config();
const { runAudit } = require('./comprehensive_api_audit.cjs');

// Set environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://china_town_db_czwv_user:Z3avbH9Vxfdb3CnRVHmF7hDTkhjBuRla@dpg-d5hsjmali9vc73am1v60-a/china_town_db_czwv';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'https://china-town-5z2i.onrender.com';

console.log('Starting API Audit...\n');
console.log('Note: This script requires a valid TEST_TOKEN for authenticated endpoints.');
console.log('Set TEST_TOKEN environment variable or it will skip authenticated tests.\n');

runAudit()
  .then(() => {
    console.log('\n✅ Audit complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Audit failed:', error.message);
    process.exit(1);
  });
