import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

// ─── Token helpers (in-memory only, never localStorage) ──────────────────────

declare global {
  interface Window {
    __ACCESS_TOKEN__?: string;
  }
}

export const getAccessToken = (): string | undefined =>
  typeof window !== 'undefined' ? window.__ACCESS_TOKEN__ : undefined;

export const setAccessToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    window.__ACCESS_TOKEN__ = token;
  }
};

export const clearAccessToken = (): void => {
  if (typeof window !== 'undefined') {
    delete window.__ACCESS_TOKEN__;
  }
};

// ─── Axios instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 15000,
  // ⚠️  Do NOT set 'Content-Type' here.
  // Axios auto-sets 'application/json' for plain object bodies and
  // 'multipart/form-data; boundary=...' for FormData bodies.
  // Hardcoding it to 'application/json' prevents FormData uploads from
  // setting the correct multipart content-type and boundary, causing
  // multer to receive nothing and throw "No file uploaded".
  withCredentials: true, // sends httpOnly refresh token cookie
});

// ─── Request interceptor — attach access token ───────────────────────────────

api.interceptors.request.use(
  config => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// ─── Response interceptor — handle 401 + token refresh ───────────────────────

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      })
        .then(token => {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          };
          return api(originalRequest);
        })
        .catch(err => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Refresh token is sent automatically via httpOnly cookie
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/refresh`,
        {},
        { withCredentials: true },
      );

      const newToken: string = data.accessToken;
      setAccessToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newToken}`,
      };

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAccessToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
