/**
 * Authentication utility functions
 * Centralized admin check for consistency across backend
 */

/**
 * Check if user is an admin
 * @param {object} user - User object from req.user
 * @returns {boolean} - True if user is admin
 */
export function isAdminUser(user) {
  if (!user) return false;
  
  // Check isAdmin flag first (set by authenticateToken middleware)
  if (user.isAdmin === true) return true;
  
  // Fallback to role check
  const role = String(user.role || '').toLowerCase();
  return role === 'admin';
}
