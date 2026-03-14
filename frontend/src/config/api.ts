/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints and axios setup
 */

import axios from 'axios';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const isLocalApiUrl = configuredApiBaseUrl
  ? /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredApiBaseUrl)
  : false;
const allowLocalApiInProd = import.meta.env.VITE_ALLOW_LOCAL_API_IN_PROD === 'true';

if (import.meta.env.PROD) {
  if (!configuredApiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL for production build.');
  }

  if (isLocalApiUrl && !allowLocalApiInProd) {
    throw new Error(`Invalid VITE_API_BASE_URL for production build: ${configuredApiBaseUrl}`);
  }
}

// API Base URL from environment or development fallback
export const API_BASE_URL = configuredApiBaseUrl || 'http://localhost:3000';

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
    const token = localStorage.getItem('idToken') || localStorage.getItem('accessToken');
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
      console.error('❌ 401 Unauthorized');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
