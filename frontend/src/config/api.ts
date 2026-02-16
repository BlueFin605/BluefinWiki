/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints and axios setup
 */

import axios from 'axios';

// API Base URL from environment or default to local
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage (set by AuthContext)
    const token = localStorage.getItem('idToken');
    console.log('🔑 API Request:', config.method?.toUpperCase(), config.url);
    console.log('🔑 Token present:', !!token);
    console.log('🔑 Token value:', token?.substring(0, 50) + '...');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error:', error.response?.status, error.config?.url);
    console.error('❌ Error details:', error.response?.data);
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      console.error('❌ 401 Unauthorized - redirecting to login');
      localStorage.removeItem('idToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
