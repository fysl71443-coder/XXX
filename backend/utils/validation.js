/**
 * Strict integer parsing utility
 * Prevents NaN errors in SQL queries
 */

/**
 * Parse integer strictly - returns null if invalid
 * @param {any} value - Value to parse
 * @returns {number|null} - Parsed integer or null if invalid
 */
export function parseIntStrict(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Get branch ID from request with strict validation
 * @param {object} req - Express request object
 * @returns {number|null} - Branch ID or null if not found/invalid
 */
export function getBranchId(req) {
  const branchId = 
    parseIntStrict(req.query?.branch_id) ??
    parseIntStrict(req.body?.branch_id) ??
    parseIntStrict(req.user?.branch_id) ??
    null;
  
  return branchId;
}

/**
 * Validate and get required integer parameter
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @returns {number} - Validated integer
 * @throws {Error} - If value is invalid
 */
export function requireInt(value, paramName = 'parameter') {
  const parsed = parseIntStrict(value);
  if (parsed === null) {
    throw new Error(`Invalid ${paramName}: must be a valid integer`);
  }
  return parsed;
}
