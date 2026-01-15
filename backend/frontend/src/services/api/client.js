import axios from 'axios';
import { normalizeArray } from '../../utils/normalize';

const API_BASE = process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? (window.__API__ || (window.location.origin + '/api')) : 'http://localhost:4000/api')

/**
 * CRITICAL: Auto-normalize API responses
 * This ensures .map(), .filter(), etc. never crash
 */
export function normalizeResponse(data) {
  // If it looks like a list endpoint response, normalize to array
  if (data === null || data === undefined) return [];
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Common patterns: { items: [] }, { data: [] }, { rows: [] }
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.results)) return data.results;
  }
  // Return as-is for single object responses
  return data;
}

// 1. Create Centralized Axios Instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 2. Request Interceptor: Inject Token
// CRITICAL: Always read token from localStorage at request time (not at instance creation)
// This ensures token is always fresh, even if it was set after axios instance was created
api.interceptors.request.use((config) => {
  // Always read token fresh from localStorage for each request
  const token = localStorage.getItem('token');
  const isPublicEndpoint = config.url?.includes('/auth/login') || 
                           config.url?.includes('/auth/register');
  
  // CRITICAL: Always inject token if it exists, even for /auth/me
  // Token should be available by the time any API call is made (ProtectedRoute ensures this)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Log for debugging (only for important endpoints or in development)
    if (process.env.NODE_ENV === 'development' || 
        config.url?.includes('/permissions') || 
        config.url?.includes('/auth/me')) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url} | token=present (${token.substring(0, 10)}...)`);
    }
  } else {
    // Warn if no token for protected endpoints (this should not happen if ProtectedRoute works correctly)
    if (config.url && !isPublicEndpoint) {
      console.warn(`[API Request] ⚠️ No token for ${config.method?.toUpperCase()} ${config.url} - request will likely fail. Auth may not be ready yet.`);
    }
  }
  return config;
}, (error) => {
  console.error('[API Request] Interceptor error:', error);
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

    // 🔴 CRITICAL: Only logout if 401 AND token is actually invalid
    // Do NOT logout on /auth/me failures - these might be temporary (DB issues, etc.)
    // Authentication failures should only logout if token itself is invalid
    if (status === 401 && hasToken) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isMeRequest = error.config?.url?.includes('/auth/me');
      const isRegisterRequest = error.config?.url?.includes('/auth/register');
      
      // NEVER logout on /auth/me failures - these are handled in AuthContext
      // /auth/me might fail due to DB issues, but token is still valid
      if (isMeRequest) {
        console.warn('[API] /auth/me failed - token may still be valid, letting AuthContext handle it');
        // Don't logout - let AuthContext decide
        return Promise.reject(error);
      }
      
      // Only logout on other 401s (not login/register/me)
      if (!isLoginRequest && !isRegisterRequest) {
        console.warn('[Auto-Logout] 401 Unauthorized on protected endpoint. Token may be invalid. Redirecting to login.');
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
            // CRITICAL: 403 means user is authenticated but lacks permission
            // Do NOT logout - user is still logged in, just doesn't have permission
            // Frontend should handle this gracefully (show error message, not redirect)
            if (status === 403) {
              const required = error.response?.data?.required || error.response?.data?.required_permission || 'unknown';
              console.warn(`[API] Access Forbidden (403). User authenticated but lacks permission: ${required}`);
              // Do NOT logout - user is still authenticated
              // Return error so component can handle it (show message, not redirect)
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
