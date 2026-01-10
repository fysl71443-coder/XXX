import api, { request } from './client';
import employees from './employees';
import payroll from './payroll';

export const auth = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  loginStart: (data) => request('/auth/login/start', { method: 'POST', body: JSON.stringify(data) }),
  verifyCode: (data) => request('/auth/login/verify', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  debugBootstrapAdmin: (data) => request('/debug/bootstrap-admin', { method: 'POST', body: JSON.stringify(data) }),
}

export const partners = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/partners${query ? `?${query}` : ''}`)
  },
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
  disable: (id) => request(`/products/${id}/disable`, { method: 'POST' }),
  enable: (id) => request(`/products/${id}/enable`, { method: 'POST' }),
}

export const invoices = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/invoices${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/invoices/${id}`),
  nextNumber: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/invoices/next-number${query ? `?${query}` : ''}`)
  },
  items: (id) => request(`/invoice_items/${id}`),
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
  update: (id, data = {}) => request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
}

export const purchaseOrders = {
  list: async () => ({ items: [] }),
  get: async () => (null),
  create: async () => ({ ok: true, id: null }),
  update: async () => ({ ok: true }),
  remove: async () => ({ ok: true }),
}

export const supplierInvoices = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/supplier-invoices${query ? `?${query}` : ''}`)
  },
  get: (id) => request(`/invoices/${id}`),
  nextNumber: () => request('/supplier-invoices/next-number'),
  create: (data = {}) => request('/supplier-invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/supplier-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  post: (id) => request(`/supplier-invoices/${id}/post`, { method: 'POST' }),
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
  returnToDraft: (id) => request(`/journal/${id}/return-to-draft`, { method: 'POST' }),
  reverse: (id) => request(`/journal/${id}/reverse`, { method: 'POST' }),
  byAccount: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/journal/account/${id}${query ? `?${query}` : ''}`)
  },
  findByRelated: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/journal/by-related/search${query ? `?${query}` : ''}`)
  },
  remove: (id, opts) => {
    const o = typeof opts === 'string' ? { password: opts } : (opts || {})
    const params = new URLSearchParams()
    if (o.password) params.set('password', o.password)
    if (o.reason) params.set('reason', o.reason)
    const qs = params.toString() ? `?${params.toString()}` : ''
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
  purgeUnlinked: () => request('/debug/purge-unlinked', { method: 'POST' }),
}

export const reports = {
  salesVsExpenses: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/sales-vs-expenses${query ? `?${query}` : ''}`)
  },
  salesByBranch: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/sales-by-branch${query ? `?${query}` : ''}`)
  },
  expensesByBranch: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/expenses-by-branch${query ? `?${query}` : ''}`)
  },
  payrollCost: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/payroll-cost${query ? `?${query}` : ''}`)
  },
  inventoryProfit: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/inventory-profit${query ? `?${query}` : ''}`)
  },
  businessDaySales: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/business-day-sales${query ? `?${query}` : ''}`)
  },
  sendBusinessDaySales: (data = {}) => request('/reports/send-business-day-sales', { method: 'POST', body: JSON.stringify(data) }),
  trialBalance: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/trial-balance${query ? `?${query}` : ''}`)
  },
  trialBalanceDrilldown: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/trial-balance/drilldown${query ? `?${query}` : ''}`)
  },
  incomeStatement: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/income-statement${query ? `?${query}` : ''}`)
  },
  ledgerSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/ledger-summary${query ? `?${query}` : ''}`)
  },
  customerLedger: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/reports/customer-ledger${query ? `?${query}` : ''}`)
  },
}

export const ar = {
  summary: () => request('/ar/summary'),
}

export const pos = {
  tablesLayout: {
    get: (branch) => request(`/pos/tables-layout${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
    save: (branch, data) => request(`/pos/tables-layout${branch ? `?branch=${encodeURIComponent(branch)}` : ''}` , { method: 'PUT', body: JSON.stringify(data) }),
  },
  verifyCancel: (branch, password) => request('/pos/verify-cancel', { method: 'POST', body: JSON.stringify({ branch, password }) }),
  saveDraft: (payload) => request('/pos/saveDraft', { method: 'POST', body: JSON.stringify(payload) }),
  issueInvoice: (payload) => request('/pos/issueInvoice', { method: 'POST', body: JSON.stringify(payload) }),
  tableState: (branch) => request(`/pos/table-state${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
}

// duplicate removed: branches already defined above

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
  permissions: (id) => request(`/users/${id}/permissions`),
  savePermissions: (id, list) => request(`/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify(list) }),
  userPermissions: (id) => request(`/users/${id}/user-permissions`),
}

export const roles = {
  list: () => request('/roles'),
  get: (id) => request(`/roles/${id}`),
  create: (data) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  rolePermissions: (id) => request(`/roles/${id}/role-permissions`),
  saveRolePermissions: (id, list) => request(`/roles/${id}/role-permissions`, { method: 'PUT', body: JSON.stringify(list) }),
  branchPermissions: (id) => request(`/roles/${id}/branch-permissions`),
  saveBranchPermissions: (id, list) => request(`/roles/${id}/branch-permissions`, { method: 'PUT', body: JSON.stringify(list) }),
  addBranchPermission: (id, data) => request(`/roles/${id}/branch-permissions`, { method: 'POST', body: JSON.stringify(data) }),
  deleteBranchPermission: (id, branchId) => request(`/roles/${id}/branch-permissions/${branchId}`, { method: 'DELETE' }),
}

export const actions = {
  list: () => request('/actions')
}

export const screens = {
  list: () => request('/screens')
}

export const branches = {
  list: () => request('/branches')
}

export { employees, payroll };

export default api;

export const periods = {
  get: (period) => request(`/accounting-periods/${encodeURIComponent(period)}`),
  open: (period) => request(`/accounting-periods/${encodeURIComponent(period)}/open`, { method: 'POST' }),
  close: (period, admin_password) => request(`/accounting-periods/${encodeURIComponent(period)}/close`, { method: 'POST', body: JSON.stringify({ admin_password }) }),
  summary: (period) => request(`/accounting-periods/${encodeURIComponent(period)}/summary`)
}
