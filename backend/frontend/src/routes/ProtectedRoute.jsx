import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute - SIMPLE authentication gate
 * 
 * CRITICAL RULES:
 * 1. ONLY checks: loading, isAuthenticated
 * 2. NO permission checks (can, canScreen, etc.)
 * 3. NO error handling (try/catch)
 * 4. NO role checks
 * 5. NO admin logic
 * 
 * Permissions are handled by individual pages, NOT here.
 */
export default function ProtectedRoute(){
  const { loading, isLoggedIn } = useAuth()
  const location = useLocation()
  
  // 1️⃣ ONLY check: Is auth loading?
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-gray-600">جار التحميل...</div>
        </div>
      </div>
    )
  }
  
  // 2️⃣ ONLY check: Is user authenticated?
  if (!isLoggedIn) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname || '/')}`} replace />
  }
  
  // 3️⃣ Authenticated - render children (NO permission checks here)
  return <Outlet />
}
