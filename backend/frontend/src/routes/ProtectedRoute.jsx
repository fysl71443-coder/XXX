import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute(){
  const { user, token, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-600">جار التحميل...</div></div>
  if (!user || !token) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname || '/')}`} replace />
  return <Outlet />
}
