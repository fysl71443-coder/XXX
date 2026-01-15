/**
 * Data Normalization Utilities
 * 
 * CRITICAL: Use these functions to safely handle API responses.
 * Never call .map(), .filter(), .forEach(), .reduce() directly on API data.
 * 
 * API responses can be:
 * - Array: [...]
 * - Object with data: { data: [...] }
 * - Object with items: { items: [...] }
 * - Object with rows: { rows: [...] }
 * - null/undefined
 * - Plain object: {}
 * 
 * These utilities ensure you always get the expected type.
 */

/**
 * Normalize any value to an array.
 * Handles all common API response formats.
 * 
 * @param {any} value - The value to normalize
 * @returns {Array} - Always returns an array (empty if invalid)
 * 
 * @example
 * // All of these return an array:
 * normalizeArray([1, 2, 3])           // [1, 2, 3]
 * normalizeArray({ data: [1, 2] })    // [1, 2]
 * normalizeArray({ items: [1, 2] })   // [1, 2]
 * normalizeArray({ rows: [1, 2] })    // [1, 2]
 * normalizeArray(null)                // []
 * normalizeArray(undefined)           // []
 * normalizeArray({})                  // []
 * normalizeArray("string")            // []
 */
export function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.rows)) return value.rows;
    if (Array.isArray(value.list)) return value.list;
    if (Array.isArray(value.results)) return value.results;
  }
  return [];
}

/**
 * Normalize any value to an object.
 * 
 * @param {any} value - The value to normalize
 * @returns {Object} - Always returns an object (empty if invalid)
 */
export function normalizeObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

/**
 * Safely get a nested property from an object.
 * 
 * @param {Object} obj - The object to get from
 * @param {string} path - Dot-separated path (e.g., 'user.profile.name')
 * @param {any} defaultValue - Default value if path doesn't exist
 * @returns {any} - The value at path or defaultValue
 */
export function safeGet(obj, path, defaultValue = undefined) {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result === null || result === undefined) return defaultValue;
    result = result[key];
  }
  return result !== undefined ? result : defaultValue;
}

/**
 * Safe array map - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - Map function
 * @returns {Array}
 */
export function safeMap(arr, fn) {
  return normalizeArray(arr).map(fn);
}

/**
 * Safe array filter - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - Filter function
 * @returns {Array}
 */
export function safeFilter(arr, fn) {
  return normalizeArray(arr).filter(fn);
}

/**
 * Safe array forEach - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - forEach function
 */
export function safeForEach(arr, fn) {
  normalizeArray(arr).forEach(fn);
}

/**
 * Safe array reduce - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - Reduce function
 * @param {any} initial - Initial value
 * @returns {any}
 */
export function safeReduce(arr, fn, initial) {
  return normalizeArray(arr).reduce(fn, initial);
}

/**
 * Safe array find - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - Find function
 * @returns {any}
 */
export function safeFind(arr, fn) {
  return normalizeArray(arr).find(fn);
}

/**
 * Safe array some - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - Some function
 * @returns {boolean}
 */
export function safeSome(arr, fn) {
  return normalizeArray(arr).some(fn);
}

/**
 * Safe array every - never throws
 * @param {any} arr - Array or array-like value
 * @param {Function} fn - Every function
 * @returns {boolean}
 */
export function safeEvery(arr, fn) {
  return normalizeArray(arr).every(fn);
}

/**
 * Safe array includes - never throws
 * @param {any} arr - Array or array-like value
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export function safeIncludes(arr, value) {
  return normalizeArray(arr).includes(value);
}

/**
 * Safe array length - never throws
 * @param {any} arr - Array or array-like value
 * @returns {number}
 */
export function safeLength(arr) {
  return normalizeArray(arr).length;
}

/**
 * Safe array slice - never throws
 * @param {any} arr - Array or array-like value
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Array}
 */
export function safeSlice(arr, start, end) {
  return normalizeArray(arr).slice(start, end);
}

// Default export for convenience
export default {
  normalizeArray,
  normalizeObject,
  safeGet,
  safeMap,
  safeFilter,
  safeForEach,
  safeReduce,
  safeFind,
  safeSome,
  safeEvery,
  safeIncludes,
  safeLength,
  safeSlice,
};
