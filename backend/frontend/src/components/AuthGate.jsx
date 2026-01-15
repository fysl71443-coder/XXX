/**
 * AuthGate - CRITICAL: Blocks ALL rendering until auth state is determined
 * 
 * This component ensures:
 * 1. No content is shown before auth check completes (except /login)
 * 2. No API calls can happen before auth is ready
 * 3. Single source of truth for auth state
 * 
 * Rules:
 * - /login page is ALWAYS accessible (no auth check needed)
 * - If loading → show loading spinner, render NOTHING else
 * - If no token → redirect to /login immediately
 * - If authenticated → render children
 */

import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export default function AuthGate({ children }) {
  const { loading, user, token, isLoggedIn } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const hasLoggedRef = useRef(false);
  
  // Log auth state changes (only once per state change)
  useEffect(() => {
    if (!hasLoggedRef.current || loading) {
      console.log('[AuthGate] State:', {
        loading,
        isLoggedIn,
        hasUser: !!user,
        hasToken: !!token,
        path: location.pathname,
        isLoginPage
      });
      hasLoggedRef.current = true;
    }
  }, [loading, isLoggedIn, user, token, location.pathname, isLoginPage]);
  
  // 0️⃣ CRITICAL: Login page is ALWAYS accessible
  // Don't block or redirect - just render it
  if (isLoginPage) {
    // If user is already logged in and on login page, redirect to home
    if (!loading && isLoggedIn && user) {
      console.log('[AuthGate] User already logged in, redirecting from /login to /');
      return <Navigate to="/" replace />;
    }
    // Otherwise, render login page (even while loading)
    return children;
  }
  
  // 1️⃣ CRITICAL: Block ALL rendering while loading (except login page)
  // This prevents any component from mounting or making API calls
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">جار التحميل...</div>
          <div className="text-gray-400 text-sm mt-1">التحقق من الجلسة</div>
        </div>
      </div>
    );
  }
  
  // 2️⃣ Auth check complete - no user means not authenticated
  // Redirect to login
  if (!isLoggedIn || !user || !token) {
    console.log('[AuthGate] NOT AUTHENTICATED - Redirecting to login');
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname || '/')}`} replace />;
  }
  
  // 3️⃣ Authenticated - render children
  return children;
}
