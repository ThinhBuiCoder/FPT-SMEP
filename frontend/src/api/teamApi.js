// src/api/teamApi.js — Module 2 Team Management API
import axiosClient from './axiosClient';

export const teamApi = {
  // ─── Team CRUD ───────────────────────────────────────────────────────────
  getAll:      (params) => axiosClient.get('/teams', { params }),
  getById:     (id, options = {}) => axiosClient.get(`/teams/${id}`, { signal: options.signal }),
  update:      (teamId, data) => axiosClient.put(`/teams/${teamId}`, data),
  delete:      (teamId)       => axiosClient.delete(`/teams/${teamId}`),

  // ─── Assignment ──────────────────────────────────────────────────────────
  assignMentor: (teamId, mentorId) => axiosClient.put(`/teams/${teamId}/assign-mentor`, { mentorId }),

  // ─── Proposal Review (Lecturer/Admin) ────────────────────────────────────
  reviewProposal: (teamId, data) => axiosClient.put(`/teams/${teamId}/review`, data),

  // ─── Chat Group ──────────────────────────────────────────────────────────
  getChatGroup: (teamId) => axiosClient.get(`/teams/${teamId}/chat-group`),
};
