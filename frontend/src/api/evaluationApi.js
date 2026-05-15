import axiosClient from './axiosClient';

export const evaluationApi = {
  create: (data) => axiosClient.post('/evaluations', data),
  getByStartup: (startupIdeaId) => axiosClient.get(`/evaluations/startup/${startupIdeaId}`),
  getByLecturer: (lecturerId) => axiosClient.get(`/evaluations/lecturer/${lecturerId}`),
};
