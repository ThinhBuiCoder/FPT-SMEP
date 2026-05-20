// frontend/src/api/commentApi.js
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

export const getProposalComments = async (proposalId) => {
  const response = await axios.get(`${API_URL}/comments/proposal/${proposalId}`, getAuthHeaders());
  return response.data;
};

export const createProposalComment = async (proposalId, data) => {
  const response = await axios.post(`${API_URL}/comments/proposal/${proposalId}`, data, getAuthHeaders());
  return response.data;
};

export const resolveComment = async (commentId) => {
  const response = await axios.put(`${API_URL}/comments/${commentId}/resolve`, {}, getAuthHeaders());
  return response.data;
};
