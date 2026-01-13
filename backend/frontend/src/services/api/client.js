import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? (window.__API__ || (window.location.origin + '/api')) : 'http://localhost:4000/api')

// 1. Create Centralized Axios Instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 2. Request Interceptor: Inject Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 3. Response Interceptor: Smart 401 Handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const hasToken = !!localStorage.getItem('token');

    // 🔴 Rule: Only logout if 401 AND we had a token (meaning token is invalid/expired)
    // Do NOT logout on 403 (Forbidden) or other errors
    if (status === 401 && hasToken) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isMeRequest = error.config?.url?.includes('/auth/me');
      
      if (!isLoginRequest && !isMeRequest) {
        console.warn('[Auto-Logout] 401 Unauthorized with token present. Redirecting to login.');
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('auth_user');
          if (typeof window !== 'undefined') {
            const next = encodeURIComponent(window.location.pathname || '/');
            window.location.href = `/login?next=${next}`;
          }
        } catch (e) {
          console.error('Logout failed', e);
        }
      }
    }
    
    // Explicitly handle 403 to prevent any confusion
    if (status === 403) {
      console.warn('[API] Access Forbidden (403). User has token but lacks permission.');
      // Do NOT logout.
    }

    if (status === 403) {
      try {
        const req = error.response?.data?.required || error.response?.data?.required_permission
        const msg = req ? `لا تملك الصلاحية: ${req}` : 'لا تملك الصلاحية للوصول'
        console.warn('[API] 403:', msg)
      } catch {}
    }

    try { console.error('[API Error]', status, error.response?.data) } catch {}
    if (error.response) {
      error.code = error.response.data?.error || error.response.data?.code || 'request_failed';
      error.status = error.response.status;
      error.message = error.response.data?.details || error.message;
    }
    
    return Promise.reject(error);
  }
);

// Wrapper to maintain backward compatibility with existing calls
// Existing calls: request('/path', { method: 'POST', body: JSON.stringify(data) })
export async function request(path, options = {}) {
  const method = options.method || 'GET';
  let data = options.body;

  function normalizeArabicDigits(str){
    const s = String(str||'');
    const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
    return s.replace(/[٠-٩۰-۹]/g, d => map[d] || d);
  }
  function deepNormalize(val){
    if (val == null) return val;
    if (Array.isArray(val)) return val.map(deepNormalize);
    if (typeof val === 'object') {
      const out = {};
      for (const [k,v] of Object.entries(val)) out[k] = deepNormalize(v);
      return out;
    }
    if (typeof val === 'string') return normalizeArabicDigits(val);
    return val;
  }

  // If body is stringified JSON, parse it back because Axios expects an object
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // If parsing fails, leave it as string
    }
  }
  data = deepNormalize(data);
  const params = deepNormalize(options.params || undefined);

  try {
    if (typeof api?.request !== 'function') {
      if (process.env.NODE_ENV === 'test') {
        return {};
      }
      throw new Error('API client not initialized');
    }
    const qSel = (function(){ try { return localStorage.getItem('selected_quarter') || null } catch { return null } })()
    const mergedParams = (function(){
      if (!qSel) return params
      const out = { ...(params||{}) }
      if (!out.quarter && qSel) out.quarter = qSel
      return out
    })()
    const response = await api.request({
      url: path,
      method,
      data,
      params: mergedParams,
      ...options,
      headers: {
        ...options.headers
      }
    });
    return response.data;
  } catch (error) {
    // The interceptor already processed it, but we need to ensure the format matches
    // what the calling code expects.
    // The calling code expects: err.code, err.status
    // We added these in the interceptor.
    throw error;
  }
}

export default api;
export const ERROR_MESSAGES = {
  locked_posted: {
    ar: 'لا يمكن تعديل أو حذف قيد منشور. استخدم عكس القيد.',
    en: 'Posted journals cannot be modified. Please reverse the entry.'
  }
}
export function mapErrorMessage(code, lang = 'ar') {
  const m = ERROR_MESSAGES[String(code)||'']
  if (!m) return null
  return lang === 'ar' ? m.ar : m.en
}
