/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await axiosClient.get('/auth/me');
          // Interceptor returns response.data = { success, message, data: { user } }
          setUser(res.data?.user || res.user);
        } catch {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await axiosClient.post('/auth/login', { email, password });
    // Interceptor returns { success, message, data: { token, user } }
    const { token, user: userData } = res.data || res;
    localStorage.setItem('token', token);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const res = await axiosClient.post('/auth/register', userData);
    // After register, do NOT set user/token — OTP verification is required first
    return res;
  };

  const verifyOtp = async (email, otp) => {
    const res = await axiosClient.post('/auth/verify-otp', { email, otp });
    const { token, user: userData, isPending } = res.data || res;
    if (token) {
      localStorage.setItem('token', token);
      setUser(userData);
    }
    return { user: userData, isPending };
  };

  const resendOtp = async (email) => {
    const res = await axiosClient.post('/auth/resend-otp', { email });
    return res;
  };

  const loginWithGoogle = async (googleToken) => {
    const res = await axiosClient.post('/auth/google', { googleToken });
    const { token, user: userData } = res.data || res;
    localStorage.setItem('token', token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
      toast.error('Session expired. Please login again.');
    };
    window.addEventListener('session_expired', handleSessionExpired);
    return () => window.removeEventListener('session_expired', handleSessionExpired);
  }, []);

  const updateUser = (updated) => setUser(prev => ({ ...prev, ...updated }));

  return (
    <AuthContext.Provider value={{ user, login, register, verifyOtp, resendOtp, loginWithGoogle, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
