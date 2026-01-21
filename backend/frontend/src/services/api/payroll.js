import api from './client';
import { normalizeArray } from '../../utils/normalize';

const payrollApi = {
  // List all payroll runs
  runs: async (params) => {
    const result = await api.get('/payroll/runs', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  
  // Create a new payroll run
  run: (data) => api.post('/payroll/run', data).then(res => res.data),
  
  // Get items for a payroll run
  items: async (id) => {
    const result = await api.get(`/payroll/run/${id}/items`).then(res => res.data);
    return normalizeArray(result);
  },
  
  // Update items for a payroll run
  updateItems: (id, items, opts = {}) => api.put(`/payroll/run/${id}/items`, { items, ...opts }).then(res => res.data),
  
  // Approve a payroll run
  approve: (id) => api.post(`/payroll/run/${id}/approve`).then(res => res.data),
  
  // Revert a run to draft
  draft: (id) => api.post(`/payroll/run/${id}/draft`).then(res => res.data),
  
  // Post a payroll run (create journal entry)
  post: (id, data) => api.post(`/payroll/run/${id}/post`, data).then(res => res.data),
  
  // Delete a payroll run
  removeRun: (id) => api.delete(`/payroll/run/${id}`).then(res => res.data),
  
  // Pay employees from a run
  pay: (runId, data) => api.post('/payroll/pay', { run_id: runId, ...data }).then(res => res.data),
  
  // Get previous dues
  previousDues: async (params) => {
    const result = await api.get('/payroll/previous-dues', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  
  // Create a previous due
  previousDue: (data) => api.post('/payroll/previous-due', data).then(res => res.data),
  
  // Get outstanding (unpaid) items
  outstanding: async (params) => {
    const result = await api.get('/payroll/outstanding', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  
  // Create an incentive (alias for previous-due with specific type)
  incentive: (data) => api.post('/payroll/previous-due', { ...data, description: 'حافز' }).then(res => res.data),
};

export default payrollApi;
