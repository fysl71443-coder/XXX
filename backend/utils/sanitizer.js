/**
 * Input Sanitization Utilities
 * 
 * Sanitizes user input to prevent SQL injection and XSS attacks
 */

/**
 * Sanitize a string input
 * 
 * @param {any} input - Input to sanitize
 * @param {number} maxLength - Maximum length (default: 255)
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 255) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') {
    input = String(input);
  }
  return validator.escape(validator.trim(input)).substring(0, maxLength);
}

/**
 * Sanitize a number input
 * 
 * @param {any} input - Input to sanitize
 * @param {number} min - Minimum value (default: 0)
 * @param {number} max - Maximum value (default: Number.MAX_SAFE_INTEGER)
 * @returns {number} Sanitized number
 */
export function sanitizeNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(input);
  if (isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

/**
 * Sanitize a date input
 * 
 * @param {any} input - Input to sanitize
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null
 */
export function sanitizeDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Sanitize an email input
 * 
 * @param {any} input - Input to sanitize
 * @returns {string|null} Sanitized email or null if invalid
 */
export function sanitizeEmail(input) {
  if (!input || typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : null;
}

/**
 * Sanitize a phone number input
 * 
 * @param {any} input - Input to sanitize
 * @returns {string} Sanitized phone number
 */
export function sanitizePhone(input) {
  if (!input) return '';
  const phone = String(input).replace(/[^\d+]/g, '');
  return phone.substring(0, 20); // Max 20 characters
}

/**
 * Sanitize an array of strings
 * 
 * @param {any} input - Input to sanitize
 * @param {number} maxLength - Maximum length per item (default: 255)
 * @returns {string[]} Array of sanitized strings
 */
export function sanitizeStringArray(input, maxLength = 255) {
  if (!Array.isArray(input)) return [];
  return input.map(item => sanitizeString(item, maxLength));
}

/**
 * Sanitize JSON input (for JSONB columns)
 * 
 * @param {any} input - Input to sanitize
 * @returns {any} Sanitized JSON object
 */
export function sanitizeJSON(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch (e) {
      return null;
    }
  }
  // Recursively sanitize string values in object
  if (Array.isArray(input)) {
    return input.map(item => sanitizeJSON(item));
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeString(key, 100);
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value, 1000);
      } else {
        sanitized[sanitizedKey] = sanitizeJSON(value);
      }
    }
    return sanitized;
  }
  return input;
}
