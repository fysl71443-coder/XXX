import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api'

// 1. Create Centralized Axios Instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 2. Request Interceptor: Inject Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
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
    const originalRequest = error.config;
    
    // Check if it's a 401 error
    if (error.response && error.response.status === 401) {
      const isLoginRequest = originalRequest.url.includes('/auth/login');
      const errorCode = error.response.data?.code;

      // Only logout if it's NOT a login request AND the token is actually expired/invalid
      if (!isLoginRequest) {
        if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN' || errorCode === 'MISSING_TOKEN') {
          try {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            // Redirect to login
            if (typeof window !== 'undefined') {
              const next = encodeURIComponent(window.location.pathname || '/');
              window.location.href = `/login?next=${next}`;
            }
          } catch (e) {
            console.error('Logout failed', e);
          }
        }
        // If it's a 401 but NOT token related (e.g. strict permission check returning 401 instead of 403),
        // or if we just want to show the error to the user without logging out.
        // We do NOTHING here (no logout), just reject the promise.
      }
    }

    // Propagate the error so the UI can handle it (show toast, etc.)
    // Normalize error object to match what the app expects if needed, 
    // but axios error object is standard.
    // The existing app expects err.code and err.status in some places.
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
async function request(path, options = {}) {
  const method = options.method || 'GET';
  let data = options.body;

  // If body is stringified JSON, parse it back because Axios expects an object
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // If parsing fails, leave it as string
    }
  }

  try {
    const response = await api({
      url: path,
      method,
      data,
      // Pass other options if necessary, e.g. params
      ...options,
      // Override headers if provided in options (but keep Authorization from interceptor)
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

// Export the same API structure
export const auth = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  loginStart: (data) => request('/auth/login/start', { method: 'POST', body: JSON.stringify(data) }),
  verifyCode: (data) => request('/auth/login/verify', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
}

export const partners = {
  list: () => request('/partners'),
  create: (data) => request('/partners', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/partners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/partners/${id}`, { method: 'DELETE' }),
}

export const products = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/products${query ? `?${query}` : ''}`)
  },
  create: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/products/${id}`, { method: 'DELETE' }),
}

export const invoices = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/invoices${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/invoices/${id}`),
  nextNumber: () => request('/invoices/next-number'),
  create: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
}

export const payments = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/payments${query ? `?${query}` : ''}`)
  },
  create: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
}

export const accounts = {
  tree: () => request('/accounts'),
  create: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/accounts/${id}${query ? `?${query}` : ''}`, { method: 'DELETE' })
  },
  seedDefault: () => request('/accounts/seed-default', { method: 'POST' }),
}

export const orders = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/orders${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/orders/${id}`),
  create: (data = {}) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
}

export const purchaseOrders = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/purchase-orders${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/purchase-orders/${id}`),
  create: (data = {}) => request('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/purchase-orders/${id}`, { method: 'DELETE' }),
}

export const supplierInvoices = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/supplier-invoices${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/supplier-invoices/${id}`),
  nextNumber: () => request('/supplier-invoices/next-number'),
  create: (data = {}) => request('/supplier-invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/supplier-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/supplier-invoices/${id}`, { method: 'DELETE' }),
}

export const journal = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/journal${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/journal/${id}`),
  create: (data) => request('/journal', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/journal/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  postEntry: (id) => request(`/journal/${id}/post`, { method: 'POST' }),
  reverse: (id) => request(`/journal/${id}/reverse`, { method: 'POST' }),
  byAccount: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/journal/account/${id}${query ? `?${query}` : ''}`)
  },
  remove: (id, password) => {
    const qs = password ? `?password=${encodeURIComponent(password)}` : ''
    return request(`/journal/${id}${qs}`, { method: 'DELETE' })
  },
}

export const expenses = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/expenses${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/expenses/${id}`),
  create: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
  post: (id) => request(`/expenses/${id}/post`, { method: 'POST' }),
  reverse: (id) => request(`/expenses/${id}/reverse`, { method: 'POST' }),
}

export const audit = {
  log: (entry) => request('/audit', { method: 'POST', body: JSON.stringify(entry) }).catch(() => null),
}

export const debug = {
  purgeOrphans: () => request('/debug/purge-orphans', { method: 'POST' }),
}

export const reports = {
  salesVsExpenses: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/sales-expenses${query ? `?${query}` : ''}`)
  },
}

export const settings = {
  list: () => request('/settings'),
  get: (key) => request(`/settings/${encodeURIComponent(key)}`),
  save: (key, value) => request(`/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(value) }),
  backup: () => request('/settings/backup', { method: 'POST' }),
  restore: (data) => request('/settings/restore', { method: 'POST', body: JSON.stringify(data) }),
}

export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggle: (id) => request(`/users/${id}/toggle`, { method: 'POST' }),
  resetPassword: (id, password) => request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
}

export const roles = {
  list: () => request('/roles'),
  create: (data) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

// Export api instance if needed elsewhere, but default to current pattern
export default api;
