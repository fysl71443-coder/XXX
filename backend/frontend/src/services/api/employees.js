import api from './client';
import { normalizeArray } from '../../utils/normalize';

export default {
  list: async (params) => {
    const result = await api.get('/employees', { params }).then(res => res.data);
    return normalizeArray(result);
  },
  get: (id) => api.get(`/employees/${id}`).then(res => res.data),
  create: (data) => api.post('/employees', data).then(res => res.data),
  update: (id, data) => api.put(`/employees/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/employees/${id}`).then(res => res.data),
  advance: (id, amount, extra = {}) => api.post(`/employees/${id}/advance`, { amount, ...extra }).then(res => res.data),
  advanceCollect: (id, amount, extra = {}) => api.post(`/employees/${id}/advance/collect`, { amount, ...extra }).then(res => res.data),
};
