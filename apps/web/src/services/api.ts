import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ?? error.message ?? 'Request failed';
    const normalized = Array.isArray(message) ? message.join(', ') : message;
    return Promise.reject(new Error(normalized));
  },
);

export default api;
