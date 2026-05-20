// src/api/chatApi.js — Central Group Chat API
import axiosClient from './axiosClient';

export const chatApi = {
  getChannels: () => axiosClient.get('/chat/groups'),
  getMessages: (chatGroupId) => axiosClient.get(`/chat/groups/${chatGroupId}/messages`),
  uploadFile: (formData) => axiosClient.post('/chat/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};
