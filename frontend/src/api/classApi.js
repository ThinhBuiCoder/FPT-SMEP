// src/api/classApi.js — Module 2 Class Management API
import axiosClient from './axiosClient';

export const classApi = {
  // ─── Class CRUD ───────────────────────────────────────────────────────────
  getAll:      (params) => axiosClient.get('/classes', { params }),
  getById:     (id)     => axiosClient.get(`/classes/${id}`),
  bulkCreate:  (data)   => axiosClient.post('/classes/bulk-create', data),
  update:      (id, data) => axiosClient.put(`/classes/${id}`, data),
  delete:      (id)     => axiosClient.delete(`/classes/${id}`),

  // ─── Lecturer Assignment & Schedule ──────────────────────────────────────────
  assignLecture: (id, lectureId) => axiosClient.put(`/classes/${id}/assign-lecture`, { lectureId }),
  assignMentors: (id, mentorIds) => axiosClient.put(`/classes/${id}/assign-mentors`, { mentorIds }),
  updateSchedule: (id, schedule) => axiosClient.put(`/classes/${id}/schedule`, schedule),
  updateTeachingAssignment: (id, data) => axiosClient.put(`/classes/${id}/teaching-assignment`, data),
  backfillChats: (id)            => axiosClient.post(`/classes/${id}/backfill-chats`),

  // ─── Students ────────────────────────────────────────────────────────────
  getStudents: (classId, params) => axiosClient.get(`/classes/${classId}/students`, { params }),
  importStudents: (classId, formData) =>
    axiosClient.post(`/classes/${classId}/import-students`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  exportClassExcel: (classId) => 
    axiosClient.get(`/classes/${classId}/export-excel`, { responseType: 'blob' }),

  // ─── Teams ───────────────────────────────────────────────────────────────
  getTeams:      (classId)       => axiosClient.get(`/classes/${classId}/teams`),
  generateTeam:  (classId, data) => axiosClient.post(`/classes/${classId}/teams/generate`, data),

  // ─── Student/User side ───────────────────────────────────────────────────
  getMyClasses:     () => axiosClient.get('/classes/my-classes'),
  getMyTeam:        () => axiosClient.get('/classes/my-team'),
  getMyClassDetail: (classId) => axiosClient.get(`/classes/my-class-detail/${classId}`),
};
