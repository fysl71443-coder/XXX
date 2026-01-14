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
    
    // Try to send error to backend for logging (optional)
    try {
      if (typeof window !== 'undefined' && window.fetch) {
        fetch('/api/error-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error?.message || 'Unknown error',
            stack: error?.stack || '',
            componentStack: errorInfo?.componentStack || '',
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {}) // Ignore if logging fails
      }
    } catch (e) {
      // Ignore logging errors
    }
  }
  render(){
    if (this.state.hasError) {
      const { error, errorInfo } = this.state
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
          <div className="bg-white border rounded shadow p-6 text-center max-w-2xl mx-4">
            <div className="text-xl font-bold mb-2 text-red-600">حدث خطأ غير متوقع</div>
            <div className="text-gray-600 mb-4">أعد تحميل الصفحة أو سجل الدخول مرة أخرى</div>
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
              <a 
                href="/login" 
                className="px-4 py-2 bg-primary-600 text-white rounded inline-block hover:bg-primary-700"
              >
                تسجيل الدخول
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
