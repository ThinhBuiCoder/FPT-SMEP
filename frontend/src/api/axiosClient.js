// src/api/axiosClient.js
import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
};

const axiosClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for attaching token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for response handling
axiosClient.interceptors.response.use(
  (response) => {
    if (response && response.data) {
      return response.data;
    }
    return response;
  },
  (error) => {
    // Handle global errors here
    if (error.response) {
      const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
      
      if (error.response.status === 401 && !isAuthRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('session_expired'));
      } else if (error.response.status === 403) {
        // Nếu là 403 từ auth (needVerify), KHÔNG redirect — để component tự xử lý
        const isAuthRoute = error.config?.url?.includes('/auth/');
        const isWorkspaceRoute = error.config?.url?.includes('/workspace');
        if (!isAuthRoute && !isWorkspaceRoute) {
          window.location.href = '/403';
        }
      }
    }
    const errData = error.response?.data || {};
    const errMessage = errData.message || error.message || 'Lỗi kết nối server';
    const normalizedErrMessage = errData.error && errMessage === error.message ? errData.error : errMessage;
    const errObj = new Error(normalizedErrMessage);
    errObj.data = errData.data || errData.errors || null;
    errObj.status = error.response?.status;
    return Promise.reject(errObj);
  }
);

export default axiosClient;
