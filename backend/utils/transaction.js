/**
 * Transaction Wrapper Utility
 * 
 * Simplifies transaction management and ensures proper cleanup
 */

import { pool } from '../db.js';

/**
 * Execute a callback within a database transaction
 * 
 * @param {Function} callback - Async function that receives a database client
 * @returns {Promise<any>} Result from callback
 * @throws {Error} Any error from callback (transaction will be rolled back)
 * 
 * @example
 * const result = await withTransaction(async (client) => {
 *   const { rows } = await client.query('INSERT INTO ...');
 *   await client.query('UPDATE ...');
 *   return rows[0];
 * });
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a callback within a database transaction with retry logic
 * 
 * @param {Function} callback - Async function that receives a database client
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} delayMs - Delay between retries in milliseconds (default: 1000)
 * @returns {Promise<any>} Result from callback
 * @throws {Error} Any error from callback after all retries
 */
export async function withTransactionRetry(callback, maxRetries = 3, delayMs = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(callback);
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors (e.g., validation errors)
      if (error.code === '23505' || // Unique violation
          error.code === '23503' || // Foreign key violation
          error.message?.includes('JOURNAL_CREATION_FAILED') ||
          error.message?.includes('validation_failed')) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.warn(`[TRANSACTION] Retry attempt ${attempt}/${maxRetries} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
}
