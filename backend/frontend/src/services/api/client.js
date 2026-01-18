import axios from 'axios';
import { normalizeArray } from '../../utils/normalize';

// In development mode (npm start), use backend server on port 5000
// Frontend Dev Server runs on port 4000, Backend API on port 5000
// In production, use window.location.origin
const API_BASE = process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? (window.__API__ || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : (window.location.origin + '/api'))) : 'http://localhost:5000/api')

// CRITICAL: Log API_BASE in development for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[API] API_BASE configured:', API_BASE);
  console.log('[API] NODE_ENV:', process.env.NODE_ENV);
  console.log('[API] REACT_APP_API_URL:', process.env.REACT_APP_API_URL || '(not set)');
}

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
  },
  // NOTE: withCredentials is for cookies, not needed for Authorization headers
  // CORS is handled by Backend server
  withCredentials: false
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

// 3. Response Interceptor: Smart Error Handling
// CRITICAL: DO NOT AUTO-LOGOUT on ANY error!
// 401/403/500/413 are NOT reasons to logout
// Only AuthContext should decide when to logout
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Log errors for debugging
    console.warn(`[API Error] ${status} on ${url}:`, error.response?.data?.error || error.message);

    // 🔴 CRITICAL: NEVER AUTO-LOGOUT
    // - 401 might be temporary token issue (let AuthContext handle it)
    // - 403 means user IS authenticated but lacks permission (NOT logout)
    // - 413 is payload too large (NOT auth issue)
    // - 500 is server error (NOT auth issue)
    // - Any other error is NOT a reason to logout
    
    if (status === 401) {
      // Log but DO NOT logout - let AuthContext handle authentication
      console.warn('[API] 401 Unauthorized - AuthContext will handle if needed');
      // DO NOT redirect, DO NOT clear token, DO NOT logout
    }
    
    if (status === 403) {
      // User IS authenticated but lacks permission - this is NOT a logout scenario
      const required = error.response?.data?.required || error.response?.data?.required_permission || 'unknown';
      console.warn(`[API] 403 Forbidden - User authenticated but lacks permission: ${required}`);
      // DO NOT logout - user is still authenticated
    }
    
    if (status === 413) {
      // Payload too large - NOT an auth issue
      console.warn('[API] 413 Payload Too Large - reduce request size');
    }

    // Enrich error object for component handling
    if (error.response) {
      error.code = error.response.data?.error || error.response.data?.code || 'request_failed';
      error.status = error.response.status;
      error.message = error.response.data?.details || error.response.data?.message || error.message;
    }
    
    return Promise.reject(error);
  }
);

// Wrapper to maintain backward compatibility with existing calls
// Existing calls: request('/path', { method: 'POST', body: JSON.stringify(data) })
export async function request(path, options = {}) {
  const method = options.method || 'GET';
  let data = options.body || options.data; // Support both 'body' and 'data'

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

  // CRITICAL: If body is stringified JSON, parse it back because Axios expects an object
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // If parsing fails, leave it as string (but log warning in development)
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] Failed to parse body as JSON:', e.message);
      }
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
    
    // CRITICAL: Remove 'body' from options to avoid conflicts - axios uses 'data'
    const { body, ...axiosOptions } = options;
    
    const response = await api.request({
      url: path,
      method,
      data, // Axios uses 'data', not 'body'
      params: mergedParams,
      ...axiosOptions,
      headers: {
        ...axiosOptions.headers
      }
    });
    
    // CRITICAL: Normalize response to ensure arrays are always arrays
    // This prevents "o.map is not a function" errors
    // BUT: For endpoints that return objects (not arrays), don't normalize
    const isObjectResponse = path.includes('/auth/login') || 
                            path.includes('/auth/register') || 
                            path.includes('/auth/me') ||
                            path.includes('/pos/saveDraft') || 
                            path.includes('/saveDraft') ||
                            path.includes('/pos/issueInvoice') ||
                            path.includes('/issueInvoice');
    if (isObjectResponse) {
      // These endpoints return objects (e.g., { token, user, ... }) - return as-is
      return response.data;
    }
    const normalized = normalizeResponse(response.data);
    return normalized;
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
