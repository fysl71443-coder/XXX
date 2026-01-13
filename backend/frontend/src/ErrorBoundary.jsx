import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props){
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(){
    return { hasError: true }
  }
  componentDidCatch(){
  }
  render(){
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white border rounded shadow p-6 text-center">
            <div className="text-xl font-bold mb-2">حدث خطأ غير متوقع</div>
            <div className="text-gray-600 mb-4">أعد تحميل الصفحة أو سجل الدخول مرة أخرى</div>
            <a href="/login" className="px-4 py-2 bg-primary-600 text-white rounded inline-block">تسجيل الدخول</a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
