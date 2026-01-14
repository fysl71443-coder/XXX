import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute(){
  const { user, token, loading, permissionsLoaded } = useAuth()
  const location = useLocation()
  
  // Wait for initial load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">جار التحميل...</div>
      </div>
    )
  }
  
  // Check authentication
  if (!user || !token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname || '/')}`} replace />
  }
  
  // Admin bypass: Admin users can render immediately without waiting for permissions
  const role = String(user?.role || '').toLowerCase();
  const isAdmin = user?.isSuperAdmin === true || user?.isAdmin === true || role === 'admin';
  
  // For non-admin users only, wait for permissions to load
  if (!isAdmin && !permissionsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">جار تحميل الصلاحيات...</div>
      </div>
    )
  }
  
  return <Outlet />
}
