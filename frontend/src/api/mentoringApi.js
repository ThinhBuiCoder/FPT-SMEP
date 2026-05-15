import axiosClient from './axiosClient';

export const mentoringApi = {
  getAll: (params) => axiosClient.get('/mentoring-sessions', { params }),
  getByTeam: (teamId) => axiosClient.get(`/mentoring-sessions/team/${teamId}`),
  create: (data) => axiosClient.post('/mentoring-sessions', data),
  update: (id, data) => axiosClient.put(`/mentoring-sessions/${id}`, data),
  delete: (id) => axiosClient.delete(`/mentoring-sessions/${id}`),
};
