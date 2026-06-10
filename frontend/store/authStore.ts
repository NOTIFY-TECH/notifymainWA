import { create } from 'zustand';
import { User, Tenant } from '@/types/auth';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  rehydrated: boolean; // ← true once AuthRehydrator finishes (success or fail)

  setAuth: (user: User, tenant: Tenant) => void;
  setRehydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(set => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  rehydrated: false,

  setAuth: (user, tenant) => set({ user, tenant, isAuthenticated: true }),
  setRehydrated: () => set({ rehydrated: true }),
  logout: () => set({ user: null, tenant: null, isAuthenticated: false, rehydrated: true }),
}));
