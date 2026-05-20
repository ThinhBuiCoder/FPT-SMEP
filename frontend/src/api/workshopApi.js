import axiosClient from './axiosClient';

export const workshopApi = {
  getAll: () => axiosClient.get('/workshops'),
  create: (data) => axiosClient.post('/workshops', data),
  update: (id, data) => axiosClient.put(`/workshops/${id}`, data),
  delete: (id) => axiosClient.delete(`/workshops/${id}`),
};
