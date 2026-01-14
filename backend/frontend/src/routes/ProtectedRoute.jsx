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
  
  // Wait for initial load - CRITICAL: Don't render anything until auth check is complete
  if (loading) {
    console.log('[ProtectedRoute] Waiting for auth check...', { path: location.pathname })
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">جار التحميل...</div>
      </div>
    )
  }
  
  // Check authentication - CRITICAL: Must have both user and token
  if (!user || !token) {
    console.log('[ProtectedRoute] Authentication failed - redirecting to login', {
      path: location.pathname,
      hasUser: !!user,
      hasToken: !!token,
      tokenFromStorage: !!localStorage.getItem('token')
    })
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
