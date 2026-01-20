import { motion } from 'framer-motion'
import { Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { auth as apiAuth } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh, login } = useAuth()
  const params = new URLSearchParams(location.search || '')
  const next = params.get('next') || '/'
  const showSessionExpired = params.get('expired') === 'true'
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  

  const [error, setError] = useState('')
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])
  function toggleLang(){ const nextLang = lang==='ar'?'en':'ar'; setLang(nextLang); try { localStorage.setItem('lang', nextLang) } catch {} }
  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const user = await login(email, password)
      if (remember) try { localStorage.setItem('remember', '1') } catch {}
      navigate(next)
    } catch (err) {
      console.error('[LOGIN] Error details:', err);
      // Network errors
      if (err?.message?.includes('Network Error') || err?.code === 'ERR_NETWORK' || err?.message?.includes('Failed to fetch')) {
        setError(lang==='ar'?'لا يمكن الاتصال بالخادم. تأكد من أن الخادم يعمل على http://localhost:4000':'Cannot connect to server. Make sure server is running on http://localhost:4000')
        return
      }
      // Server errors
      if (err?.status === 500 || err?.code === 'server_error') {
        setError(lang==='ar'?'خطأ في الخادم. يرجى المحاولة لاحقاً':'Server error. Please try again later')
        return
      }
      if (err?.code === 'no_users') {
        try {
          const reg = await apiAuth.register({ name: 'Admin', email, password })
          try { localStorage.setItem('token', reg.token); localStorage.setItem('auth_user', JSON.stringify(reg.user)); } catch {}
          await login(email, password)
          if (remember) try { localStorage.setItem('remember', '1') } catch {}
          navigate(next)
          return
        } catch (e2) { 
          console.error('[LOGIN] Register failed:', e2);
          setError(lang==='ar'?'فشل إنشاء المدير لأول مرة':'Failed to bootstrap the first admin') 
        }
      } else if (err?.code === 'invalid_credentials') {
        setError(lang==='ar'?'بيانات الدخول غير صحيحة':'Invalid email or password')
      } else if (err?.message === 'invalid_credentials') {
        setError(lang==='ar'?'بيانات الدخول غير صحيحة':'Invalid email or password')
      } else if (err?.code === 'not_found') {
        try {
          const boot = await apiAuth.debugBootstrapAdmin({ email, password, name: 'Admin' })
          await login(email, password)
          if (remember) try { localStorage.setItem('remember', '1') } catch {}
          navigate(next)
          return
        } catch (_) { 
          console.error('[LOGIN] Bootstrap failed:', _);
          setError(lang==='ar'?'تعذر تسجيل الدخول':'Unable to sign in') 
        }
      } else if (err?.code === 'blocked' || err?.code === 'too_many_attempts') {
        setError(lang==='ar'?'تم حجب المستخدم بعد تعدد المحاولات. تواصل مع المدير':'User is blocked after too many attempts. Contact admin')
      } else {
        // Show more detailed error message
        const errorMsg = err?.message || err?.details || (lang==='ar'?'تعذر تسجيل الدخول':'Unable to sign in')
        setError(errorMsg)
      }
    }
  }

  const clouds = [
    { id: 1, w: 240, y: 80, duration: 45, delay: 0, opacity: 0.35 },
    { id: 2, w: 300, y: 150, duration: 60, delay: 8, opacity: 0.4 },
    { id: 3, w: 200, y: 220, duration: 50, delay: 14, opacity: 0.3 },
    { id: 4, w: 280, y: 300, duration: 70, delay: 20, opacity: 0.35 },
  ]

  const birds = [
    { id: 'b1', y: 140, scale: 1, duration: 35, delay: 4 },
    { id: 'b2', y: 220, scale: 1.25, duration: 30, delay: 10 },
    { id: 'b3', y: 280, scale: 0.9, duration: 42, delay: 18 },
  ]

  function BirdIcon() {
    return (
      <motion.svg width="56" height="28" viewBox="0 0 56 28" xmlns="http://www.w3.org/2000/svg" className="drop-shadow">
        <motion.g
          initial={{ rotate: -6 }}
          animate={{ rotate: [ -6, 8, -6 ] }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          style={{ transformOrigin: '28px 14px' }}
        >
          <path d="M2 14 Q 14 2 28 14" stroke="white" strokeWidth="2.5" fill="none" />
          <path d="M28 14 Q 42 2 54 14" stroke="white" strokeWidth="2.5" fill="none" />
        </motion.g>
      </motion.svg>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-600 to-indigo-900" />
      <motion.div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-yellow-300/20 blur-3xl" animate={{ opacity: [0.2, 0.35, 0.2] }} transition={{ duration: 8, repeat: Infinity }} />
      {clouds.map(c => (
        <motion.div key={c.id} className="absolute rounded-full bg-white" style={{ top: c.y, width: c.w, height: c.w/2, opacity: c.opacity, filter: 'blur(1px)' }} initial={{ x: '-20%' }} animate={{ x: '120%' }} transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }} />
      ))}
      <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-emerald-700 via-emerald-600/70 to-transparent" />
      {birds.map(b => (
        <motion.div key={b.id} className="absolute" style={{ top: b.y }} initial={{ x: '-10%' }} animate={{ x: '110%', y: [b.y, b.y + 6, b.y] }} transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'linear' }}>
          <div style={{ transform: `scale(${b.scale})` }}>
            <BirdIcon />
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl rounded-2xl">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-left space-y-2">
                <h1 className="text-3xl font-bold text-white">{lang==='ar'?'مرحبًا بعودتك':'Welcome Back'}</h1>
                <p className="text-slate-300 text-sm">{lang==='ar'?'سجّل الدخول إلى حسابك':'Sign in to your account'}</p>
              </div>
              <button type="button" onClick={toggleLang} className="px-3 py-1 rounded-md border border-white/30 text-white/90 hover:text-white">
                {lang==='ar'?'English':'العربية'}
              </button>
            </div>

            {showSessionExpired && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-sm text-amber-100"
              >
                {lang==='ar'?'انتهت جلسة المستخدم. يرجى تسجيل الدخول مرة أخرى':'Your session has expired. Please sign in again'}
              </motion.div>
            )}

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang==='ar'?"البريد الإلكتروني":"Email address"}
                  className="pl-10 w-full rounded-md bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400 py-3"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lang==='ar'?"كلمة المرور":"Password"}
                  className="pl-10 pr-10 w-full rounded-md bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 py-3"
                />
                <button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-sky-400" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {lang==='ar'?"تذكرني":"Remember me"}
                </label>
                <button type="button" className="hover:text-white transition">{lang==='ar'?"هل نسيت كلمة المرور؟":"Forgot password?"}</button>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white rounded-xl py-6 text-base shadow-lg">
                {lang==='ar'?"تسجيل الدخول":"Sign In"}
              </button>
            </form>

            {error ? (<p className="text-center text-xs text-red-300">{error}</p>) : null}
            <p className="text-center text-xs text-slate-400">{lang==='ar'?"© 2025 شركتك. جميع الحقوق محفوظة.":"© 2025 Your Company. All rights reserved."}</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
