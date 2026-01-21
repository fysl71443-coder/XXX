import { Pool } from "pg";
import dotenv from "dotenv";

// Load .env before reading DATABASE_URL
dotenv.config();

// CRITICAL: PostgreSQL ONLY - NO SQLite, NO fallback, NO exceptions
const DATABASE_URL = process.env.DATABASE_URL;

// MANDATORY: Fail immediately if DATABASE_URL is not set
if (!DATABASE_URL) {
  console.error('❌ CRITICAL ERROR: DATABASE_URL is required');
  console.error('❌ PostgreSQL connection string must be provided');
  console.error('❌ Application cannot start without PostgreSQL');
  process.exit(1);
}

// MANDATORY: Verify it's PostgreSQL, not SQLite
if (DATABASE_URL.includes('sqlite') || DATABASE_URL.endsWith('.db') || DATABASE_URL.startsWith('file:')) {
  console.error('❌ CRITICAL ERROR: SQLite is NOT allowed');
  console.error('❌ Only PostgreSQL is permitted');
  console.error('❌ DATABASE_URL must be a PostgreSQL connection string');
  process.exit(1);
}

// MANDATORY: Must be PostgreSQL connection string
if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
  console.error('❌ CRITICAL ERROR: Invalid database connection string');
  console.error('❌ DATABASE_URL must start with postgresql:// or postgres://');
  console.error('❌ Only PostgreSQL is permitted');
  process.exit(1);
}

// Create PostgreSQL pool - NO fallback, NO null, NO exceptions
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// CRITICAL: Wrap pool.query to add detailed error logging
const originalQuery = pool.query.bind(pool);
pool.query = function(text, params) {
  // Check for NaN in params before executing
  if (params && Array.isArray(params)) {
    for (let i = 0; i < params.length; i++) {
      if (typeof params[i] === 'number' && (isNaN(params[i]) || !isFinite(params[i]))) {
        console.error('🔥 SQL ERROR: NaN detected in params!');
        console.error('SQL:', text);
        console.error('PARAMS:', params);
        console.error(`PARAM[${i}] =`, params[i], `(type: ${typeof params[i]})`);
        console.error('Stack trace:', new Error().stack);
        throw new Error(`Invalid parameter at index ${i}: NaN or non-finite number`);
      }
    }
  }
  
  return originalQuery(text, params).catch(err => {
    // Enhanced error logging
    if (err.message && err.message.includes('NaN')) {
      console.error('🔥 SQL ERROR - NaN detected!');
      console.error('SQL:', text);
      console.error('PARAMS:', params);
      console.error('Error:', err.message);
      console.error('Stack trace:', err.stack);
      console.error('Full error:', err);
    }
    throw err;
  });
};

// MANDATORY: Test connection on startup - fail if connection fails
pool.on('error', (err) => {
  console.error('❌ CRITICAL: PostgreSQL connection error:', err);
  console.error('❌ Application cannot continue without database connection');
  process.exit(1);
});

