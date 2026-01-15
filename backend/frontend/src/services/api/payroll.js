import api from './client';
import { normalizeArray } from '../../utils/normalize';

const payrollApi = {
  runs: async (params) => {
    const result = await api.get('/payroll/runs', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  run: (data) => api.post('/payroll/run', data).then(res => res.data),
  items: async (id) => {
    const result = await api.get(`/payroll/run/${id}/items`).then(res => res.data);
    return normalizeArray(result);
  },
  updateItems: (id, items, opts = {}) => api.put(`/payroll/run/${id}/items`, { items, ...opts }).then(res => res.data),
  statements: async (params) => {
    const result = await api.get('/payroll/statements', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  payments: (data) => api.post('/payroll/payments', data).then(res => res.data),
  
  // Methods required by Employees.jsx
  previousDues: async (params) => {
    const result = await api.get('/payroll/previous-dues', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  approve: (id) => api.post(`/payroll/run/${id}/approve`).then(res => res.data),
  draft: (id) => api.post(`/payroll/run/${id}/draft`).then(res => res.data),
  removeRun: (id) => api.delete(`/payroll/run/${id}`).then(res => res.data),
  post: (id, data) => api.post(`/payroll/run/${id}/post`, data).then(res => res.data),
};

export default payrollApi;
