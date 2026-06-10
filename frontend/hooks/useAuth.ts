import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/services/auth-api';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { LoginRequest, RegisterRequest } from '@/types/auth';
import { clearAccessToken, setAccessToken } from '@/services/api';

// ─── useAuth ──────────────────────────────────────────────────────────────────
// Wraps auth actions in TanStack mutations so components get isPending,
// isError, and error states for free.

export const useAuth = () => {
  const router = useRouter();
  const { setAuth, logout: storeLogout, user, tenant, isAuthenticated } = useAuthStore();
  const { success, error: notifyError } = useNotificationStore();

  // ── Login ──────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: ({ tenantId, data }: { tenantId: string; data: LoginRequest }) => authApi.login(tenantId, data),
    onSuccess: response => {
      setAccessToken(response.accessToken);
      setAuth(response.user, response.tenant);
      success('Welcome back', `Logged in as ${response.user.firstName}`);
      router.push('/dashboard'); // ← was window.location.href
    },
    onError: () => {
      notifyError('Login failed', 'Invalid email or password');
    },
  });

  // ── Register ───────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: ({ tenantId, data }: { tenantId: string; data: RegisterRequest }) => authApi.register(tenantId, data),
    onSuccess: response => {
      setAccessToken(response.accessToken);
      setAuth(response.user, response.tenant);
      success('Account created', `Welcome, ${response.user.firstName}!`);
      router.push('/dashboard'); // ← was window.location.href
    },
    onError: () => {
      notifyError('Registration failed', 'Please check your details and try again');
    },
  });

  const signupMutation = useMutation({
    mutationFn: (data: {
      businessName: string;
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => authApi.signup(data),
    onSuccess: response => {
      setAccessToken(response.accessToken);
      setAuth(response.user, response.tenant);
      success('Account created', `Welcome, ${response.user.firstName}!`);
      router.push('/dashboard');
    },
    onError: () => {
      notifyError('Registration failed', 'Please check your details and try again');
    },
  });

  const globalLoginMutation = useMutation({
    mutationFn: (data: LoginRequest) => authApi.globalLogin(data),
    onSuccess: response => {
      setAccessToken(response.accessToken);
      setAuth(response.user, response.tenant);
      success('Welcome back', `Logged in as ${response.user.firstName}`);
      router.push('/dashboard');
    },
    onError: () => {
      notifyError('Login failed', 'Invalid email or password');
    },
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearAccessToken();
      storeLogout();
      router.push('/login');
    }
  }, [storeLogout, router]);

  return {
    // State
    user,
    tenant,
    isAuthenticated,

    // Login
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,

    // Signup
    signup: signupMutation.mutate,
    isSigningUp: signupMutation.isPending,
    globalLogin: globalLoginMutation.mutate,
    isGlobalLoggingIn: globalLoginMutation.isPending,

    // Register FOR internal testing (adding agents/managers to an existing tenant)
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,

    // Logout
    logout,
  };
};
