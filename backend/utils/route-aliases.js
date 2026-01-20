/**
 * Route Aliases - توحيد أسماء المسارات
 * 
 * هذا الملف يحتوي على mapping للـ routes القديمة إلى الجديدة
 * لضمان التوافق مع الكود القديم أثناء الانتقال التدريجي
 */

export const ROUTE_ALIASES = {
  // POS Routes
  // Map kebab-case aliases to camelCase canonical routes
  '/api/pos/issue-invoice': '/api/pos/issueInvoice',
  '/api/pos/save-draft': '/api/pos/saveDraft',
  // Also map camelCase to itself (no-op) to ensure lookup works
  '/api/pos/issueInvoice': '/api/pos/issueInvoice',
  '/api/pos/saveDraft': '/api/pos/saveDraft',
  
  // Settings Routes
  '/api/settings/settings_company': '/api/settings/company',
};

/**
 * Normalize route path - converts old routes to new ones
 * @param {string} path - Original path
 * @returns {string} - Normalized path
 */
export function normalizeRoute(path) {
  return ROUTE_ALIASES[path] || path;
}

/**
 * Check if a path has an alias
 * @param {string} path - Path to check
 * @returns {boolean} - True if alias exists
 */
export function hasAlias(path) {
  return path in ROUTE_ALIASES;
}
