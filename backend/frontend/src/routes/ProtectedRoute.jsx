import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

export default function ProtectedRoute(){
  const { user, token, loading, permissionsLoaded } = useAuth()
  const location = useLocation()
  
  // Log route protection check
  useEffect(() => {
    console.log('[ProtectedRoute] Route check:', {
      path: location.pathname,
      loading,
      hasUser: !!user,
      hasToken: !!token,
      userEmail: user?.email || 'none',
      userRole: user?.role || 'none',
      permissionsLoaded
    })
  }, [location.pathname, loading, user, token, permissionsLoaded])
  
  // CRITICAL: Wait for initial load - Don't render ANY content until auth check is complete
  // This prevents showing the page before verifying the user's session
  // NO API calls can happen if loading is true because component doesn't render
  if (loading) {
    console.log('[ProtectedRoute] BLOCKING render - waiting for auth check...', { 
      path: location.pathname,
      loading: true,
      timestamp: new Date().toISOString()
    })
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-pulse text-gray-600 text-lg mb-2">جار التحميل...</div>
          <div className="text-gray-400 text-sm">التحقق من الجلسة...</div>
        </div>
      </div>
    )
  }
  
  // CRITICAL: Check authentication - Must have both user and token
  // If either is missing, redirect to login immediately
  // This ensures no protected content is shown to unauthenticated users
  if (!user || !token) {
    const tokenInStorage = !!localStorage.getItem('token');
    console.log('[ProtectedRoute] Authentication failed - redirecting to login', {
      path: location.pathname,
      hasUser: !!user,
      hasToken: !!token,
      tokenInStorage,
      loading: false,
      timestamp: new Date().toISOString()
    })
    // Use replace to prevent back button from going to protected route
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname || '/')}`} replace />
  }
  
  // Admin bypass: Admin users can render immediately without waiting for permissions
  const role = String(user?.role || '').toLowerCase();
  const isAdmin = user?.isSuperAdmin === true || user?.isAdmin === true || role === 'admin';
  
  if (isAdmin) {
    console.log('[ProtectedRoute] Admin user - allowing access immediately', {
      path: location.pathname,
      userEmail: user?.email,
      role
    })
    return <Outlet />
  }
  
  // For non-admin users only, wait for permissions to load
  if (!permissionsLoaded) {
    console.log('[ProtectedRoute] Non-admin user - waiting for permissions', {
      path: location.pathname,
      userEmail: user?.email
    })
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">جار تحميل الصلاحيات...</div>
      </div>
    )
  }
  
  console.log('[ProtectedRoute] Access granted', {
    path: location.pathname,
    userEmail: user?.email,
    role
  })
  
  return <Outlet />
}
