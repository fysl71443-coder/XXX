/**
 * AuthGate - CRITICAL: Blocks ALL rendering until auth state is determined
 * 
 * This component ensures:
 * 1. No content is shown before auth check completes
 * 2. No API calls can happen before auth is ready
 * 3. Single source of truth for auth state
 * 
 * Rules:
 * - If loading → show loading spinner, render NOTHING else
 * - If no token → redirect to /login immediately
 * - If authenticated → render children
 */

import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export default function AuthGate({ children }) {
  const { loading, user, token } = useAuth();
  const location = useLocation();
  
  // 1️⃣ CRITICAL: Block ALL rendering while loading
  // This prevents any component from mounting or making API calls
  if (loading) {
    console.log('[AuthGate] BLOCKING - Auth check in progress', {
      path: location.pathname,
      timestamp: new Date().toISOString()
    });
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
  // Redirect to login (except if already on login page)
  if (!user || !token) {
    // Don't redirect if already on login page
    if (location.pathname === '/login') {
      return children;
    }
    
    console.log('[AuthGate] NOT AUTHENTICATED - Redirecting to login', {
      path: location.pathname,
      hasUser: !!user,
      hasToken: !!token,
      timestamp: new Date().toISOString()
    });
    
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname || '/')}`} replace />;
  }
  
  // 3️⃣ Authenticated - render children
  console.log('[AuthGate] AUTHENTICATED - Rendering app', {
    path: location.pathname,
    userId: user?.id,
    userEmail: user?.email,
    isAdmin: user?.isAdmin || user?.role === 'admin',
    timestamp: new Date().toISOString()
  });
  
  return children;
}
