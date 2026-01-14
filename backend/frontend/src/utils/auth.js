/**
 * Authentication utility functions
 * Centralized admin check for consistency across frontend
 */

/**
 * Check if user is an admin
 * @param {object} user - User object from AuthContext
 * @returns {boolean} - True if user is admin
 */
export function isAdmin(user) {
  if (!user) return false;
  
  // Check all possible admin flags
  if (user.isSuperAdmin === true) return true;
  if (user.isAdmin === true) return true;
  
  // Fallback to role check
  const role = String(user.role || '').toLowerCase();
  return role === 'admin';
}
