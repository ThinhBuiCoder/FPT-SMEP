// frontend/src/api/mentoringApi.js
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

export const mentoringApi = {
  createSession: async (sessionData) => {
    const response = await axios.post(`${API_URL}/mentoring-sessions`, sessionData, getAuthHeaders());
    return response.data;
  },
  getAllSessions: async () => {
    const response = await axios.get(`${API_URL}/mentoring-sessions`, getAuthHeaders());
    return response.data;
  },
  getMyLecturerSessions: async () => {
    const response = await axios.get(`${API_URL}/mentoring-sessions/lecturer`, getAuthHeaders());
    return response.data;
  },
  getSessionsByTeam: async (teamId) => {
    const response = await axios.get(`${API_URL}/mentoring-sessions/team/${teamId}`, getAuthHeaders());
    return response.data;
  },
  getPastSessions: async () => {
    const response = await axios.get(`${API_URL}/mentoring-sessions/past`, getAuthHeaders());
    return response.data;
  },
  updateSession: async (sessionId, sessionData) => {
    const response = await axios.put(`${API_URL}/mentoring-sessions/${sessionId}`, sessionData, getAuthHeaders());
    return response.data;
  },
  cancelSession: async (sessionId) => {
    const response = await axios.patch(`${API_URL}/mentoring-sessions/${sessionId}/cancel`, {}, getAuthHeaders());
    return response.data;
  },
  deleteSession: async (sessionId) => {
    const response = await axios.delete(`${API_URL}/mentoring-sessions/${sessionId}`, getAuthHeaders());
    return response.data;
  },
  addSessionNote: async (sessionId, notes) => {
    const response = await axios.post(`${API_URL}/mentoring-sessions/${sessionId}/notes`, { notes }, getAuthHeaders());
    return response.data;
  },
  addActionItem: async (sessionId, actionItemData) => {
    const response = await axios.post(`${API_URL}/mentoring-sessions/${sessionId}/action-items`, actionItemData, getAuthHeaders());
    return response.data;
  },
  updateActionItem: async (sessionId, itemId, actionItemData) => {
    const response = await axios.patch(`${API_URL}/mentoring-sessions/${sessionId}/action-items/${itemId}`, actionItemData, getAuthHeaders());
    return response.data;
  }
};

export const { 
  createSession, 
  getAllSessions, 
  getMyLecturerSessions, 
  getSessionsByTeam,
  getPastSessions,
  updateSession, 
  cancelSession,
  deleteSession,
  addSessionNote,
  addActionItem,
  updateActionItem
} = mentoringApi;
