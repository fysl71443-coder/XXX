import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to prevent API calls before auth is ready
 * Returns { isReady, isAuthenticated }
 * 
 * Usage:
 * const { isReady, isAuthenticated } = useAuthGuard();
 * 
 * useEffect(() => {
 *   if (!isReady) return; // Don't make API calls yet
 *   if (!isAuthenticated) return; // User not logged in
 *   
 *   // Safe to make API calls here
 *   fetchData();
 * }, [isReady, isAuthenticated]);
 */
export function useAuthGuard() {
  const { loading, user, token, isLoggedIn } = useAuth();
  const isReady = !loading; // Ready when loading is false
  const isAuthenticated = isLoggedIn && !!user && !!token;
  
  return { isReady, isAuthenticated, loading, user, token };
}

/**
 * Hook that prevents component from rendering until auth is ready
 * Returns null if loading, otherwise returns children
 */
export function AuthGuard({ children }) {
  const { loading, isLoggedIn } = useAuth();
  
  if (loading) {
    return null; // Don't render anything while loading
  }
  
  if (!isLoggedIn) {
    return null; // Don't render if not logged in (ProtectedRoute will redirect)
  }
  
  return children;
}
