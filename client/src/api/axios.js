import axios from 'axios';

// Determine base URL dynamically for local network support
const getBaseURL = () => {
  const { hostname, port, protocol } = window.location;
  // Production: client served by Express on port 5000 (or 80/443 via nginx)
  // In production, port is 5000 or empty (behind nginx proxy)
  if (port === '5000' || port === '' || port === '80' || port === '443') {
    return '/api'; // Same origin - served by Express
  }
  // Dev mode: Vite dev server on port 5173, use proxy
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('ngrok')) {
    return '/api'; // Use vite proxy
  }
  return `${protocol}//${hostname}:5000/api`; // Direct to server on network IP
};

const API = axios.create({
  baseURL: getBaseURL(),
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
