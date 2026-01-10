import api from './client';

const payrollApi = {
  runs: (params) => api.get('/payroll/runs', { params }).then(res => res.data),
  run: (data) => api.post('/payroll/run', data).then(res => res.data),
  items: (id) => api.get(`/payroll/run/${id}/items`).then(res => res.data),
  updateItems: (id, items, opts = {}) => api.put(`/payroll/run/${id}/items`, { items, ...opts }).then(res => res.data),
  statements: (params) => api.get('/payroll/statements', { params }).then(res => res.data),
  payments: (data) => api.post('/payroll/payments', data).then(res => res.data),
  
  // Methods required by Employees.jsx
  previousDues: (params) => api.get('/payroll/previous-dues', { params }).then(res => res.data),
  approve: (id) => api.post(`/payroll/run/${id}/approve`).then(res => res.data),
  draft: (id) => api.post(`/payroll/run/${id}/draft`).then(res => res.data),
  removeRun: (id) => api.delete(`/payroll/run/${id}`).then(res => res.data),
  post: (id, data) => api.post(`/payroll/run/${id}/post`, data).then(res => res.data),
};

export default payrollApi;
