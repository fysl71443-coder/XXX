import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props){
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }
  static getDerivedStateFromError(error){
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo){
    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)
    console.error('[ErrorBoundary] Stack trace:', error?.stack)
    
    // Store error info in state for display
    this.setState({ errorInfo })
    
    // CRITICAL: Send error to backend WITH token (if available)
    // This prevents auth_header=missing in logs
    // Error logging should NEVER cause redirect or logout
    try {
      if (typeof window !== 'undefined' && window.fetch) {
        const token = localStorage.getItem('token')
        const headers = { 'Content-Type': 'application/json' }
        
        // Include Authorization header if token exists
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        fetch('/api/error-log', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            error: error?.message || 'Unknown error',
            stack: error?.stack || '',
            componentStack: errorInfo?.componentStack || '',
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {}) // Silently ignore - NEVER redirect or logout
      }
    } catch (e) {
      // Silently ignore - error logging should NEVER affect user experience
    }
  }
  render(){
    if (this.state.hasError) {
      const { error, errorInfo } = this.state
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
          <div className="bg-white border rounded shadow p-6 text-center max-w-2xl mx-4">
            <div className="text-xl font-bold mb-2 text-red-600">حدث خطأ في الصفحة</div>
            <div className="text-gray-600 mb-4">
              حدث خطأ تقني. جرب إعادة تحميل الصفحة.
              <br />
              <span className="text-sm text-gray-400">هذا ليس مشكلة في تسجيل الدخول.</span>
            </div>
            {process.env.NODE_ENV === 'development' && error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-right text-sm">
                <div className="font-semibold text-red-700 mb-2">تفاصيل الخطأ (Development فقط):</div>
                <div className="text-red-600 font-mono text-xs break-all">{error.toString()}</div>
                {errorInfo?.componentStack && (
                  <details className="mt-2 text-xs text-gray-600">
                    <summary className="cursor-pointer">Stack Trace</summary>
                    <pre className="mt-2 text-left overflow-auto max-h-40">{errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-center">
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                إعادة تحميل الصفحة
              </button>
              <button 
                onClick={() => window.history.back()} 
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                العودة للخلف
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
