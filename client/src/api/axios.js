import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Add token to all requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('hkchat_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hkchat_token');
      localStorage.removeItem('hkchat_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
