/**
 * Utility functions to ensure API calls only happen after auth is ready
 */

/**
 * Check if auth is ready before making API calls
 * Returns true if safe to make API calls, false otherwise
 * 
 * Usage in components:
 * if (!isAuthReady()) return; // Don't make API calls yet
 */
export function isAuthReady() {
  try {
    // Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      return false; // No token = not ready
    }
    
    // If we're in a React component, we should use useAuth hook instead
    // This is a fallback for non-React code
    return true;
  } catch {
    return false;
  }
}

/**
 * Guard function to wrap API calls
 * Only executes callback if auth is ready
 */
export function withAuthGuard(callback) {
  if (!isAuthReady()) {
    console.warn('[AuthGuard] API call blocked - auth not ready yet');
    return Promise.reject(new Error('Auth not ready'));
  }
  return callback();
}
