import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('roomly_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Normalize errors to a readable message for the UI.
export function apiError(err) {
  return err?.response?.data?.error?.message || 'Something went wrong. Please try again.';
}

export default api;
