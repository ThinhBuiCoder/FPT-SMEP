import axiosClient from './axiosClient';

export const milestoneApi = {
  getAll: (params) => axiosClient.get('/milestones', { params }),
  getByTeam: (teamId) => axiosClient.get(`/milestones/team/${teamId}`),
  create: (data) => axiosClient.post('/milestones', data),
  update: (id, data) => axiosClient.put(`/milestones/${id}`, data),
  delete: (id) => axiosClient.delete(`/milestones/${id}`),
};
