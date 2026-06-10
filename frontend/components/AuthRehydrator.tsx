'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { setAccessToken } from '@/services/api'; // no longer importing `api` itself
import { AuthResponse } from '@/types/auth';
import axios from 'axios';

// Plain instance — no 401 interceptor, so a failed refresh doesn't loop
const plainAxios = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true,
});

export default function AuthRehydrator() {
  const { rehydrated, setAuth, setRehydrated } = useAuthStore();

  useEffect(() => {
    if (rehydrated) return;

    plainAxios
      .post<AuthResponse>('/auth/refresh')
      .then(res => {
        setAccessToken(res.data.accessToken);
        setAuth(res.data.user, res.data.tenant);
      })
      .catch(() => {
        // No valid cookie — stay unauthenticated
      })
      .finally(() => {
        setRehydrated();
      });
  }, [rehydrated]);

  return null;
}
