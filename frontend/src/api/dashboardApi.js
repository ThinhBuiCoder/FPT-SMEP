import axiosClient from './axiosClient';

export const dashboardApi = {
  getAdmin: () => axiosClient.get('/dashboard/admin'),
  getLecturer: () => axiosClient.get('/dashboard/lecturer'),
  getStudent: () => axiosClient.get('/dashboard/student'),
};
