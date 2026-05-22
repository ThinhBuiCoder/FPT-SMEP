// frontend/src/api/evaluationApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

export const evaluationApi = {
  // Legacy Module 1 Methods
  getByStartup: async (startupIdeaId) => {
    const res = await axios.get(`${API_URL}/evaluations/startup/${startupIdeaId}`, getAuthHeaders());
    return res.data;
  },
  create: async (evaluationData) => {
    const response = await axios.post(`${API_URL}/evaluations`, evaluationData, getAuthHeaders());
    return response.data;
  },

  // Module 4 Methods
  getTeamEvaluations: async (teamId) => {
    const response = await axios.get(`${API_URL}/evaluations/team/${teamId}`, getAuthHeaders());
    return response.data;
  },
  createTeamEvaluation: async (teamId, evaluationData) => {
    const response = await axios.post(`${API_URL}/evaluations/team/${teamId}`, evaluationData, getAuthHeaders());
    return response.data;
  },
  updateTeamEvaluation: async (evaluationId, evaluationData) => {
    const response = await axios.put(`${API_URL}/evaluations/team/${evaluationId}`, evaluationData, getAuthHeaders());
    return response.data;
  },
  submitTeamEvaluation: async (evaluationId) => {
    const response = await axios.put(`${API_URL}/evaluations/team/${evaluationId}/submit`, {}, getAuthHeaders());
    return response.data;
  }
};

export const { getByStartup, create, getTeamEvaluations, createTeamEvaluation, updateTeamEvaluation, submitTeamEvaluation } = evaluationApi;
