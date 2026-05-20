import axiosClient from './axiosClient';

export const dashboardApi = {
  getAdmin: () => axiosClient.get('/dashboard/admin'),
  getLecturer: () => axiosClient.get('/dashboard/lecturer'),
  getMentor: () => axiosClient.get('/dashboard/mentor'),
  getStudent: () => axiosClient.get('/dashboard/student'),
};
