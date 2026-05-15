import axiosClient from './axiosClient';

export const aiApi = {
  analyze: (startupIdeaId) => axiosClient.post(`/ai/analyze-startup/${startupIdeaId}`),
  getAnalysis: (startupIdeaId) => axiosClient.get(`/ai/startup/${startupIdeaId}`),
};
