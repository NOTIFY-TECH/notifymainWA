import { tenantApi } from '@/services/tenant-api';
import { useAuthStore } from '@/store/authStore';
import { TenantProfile, UpdateTenantProfileRequest, UpdateTenantProfileResult, OwnerAwayResult } from '@/types/tenant';
import { ApiResponse } from '@/types/index';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const tenantKeys = {
  profile: (tenantId: string) => ['tenant', tenantId, 'profile'] as const,
};

// ─── useTenantProfile ─────────────────────────────────────────────────────────

export function useTenantProfile() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: tenantKeys.profile(tenantId),
    queryFn: () => tenantApi.getProfile(tenantId),
    enabled: rehydrated && !!tenantId,
    select: (data: ApiResponse<TenantProfile>) => data.data,
  });
}

// ─── useUpdateTenantProfile ───────────────────────────────────────────────────

export function useUpdateTenantProfile() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTenantProfileRequest) => tenantApi.updateProfile(tenantId, data),
    onSuccess: (result: UpdateTenantProfileResult) => {
      // Patch the profile cache directly — same pattern as useUpdateMemberRole.
      // If an email change is pending, this still reflects pendingEmail +
      // emailVerifyExpiresAt from the backend response so the banner shows
      // immediately without a refetch.
      queryClient.setQueryData<ApiResponse<TenantProfile>>(tenantKeys.profile(tenantId), old => {
        if (!old) return old;
        return { ...old, data: result.data };
      });
    },
  });
}

// ─── useResendVerification ────────────────────────────────────────────────────

export function useResendVerification() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tenantApi.resendVerification(tenantId),
    onSuccess: () => {
      // Expiry timestamp moves forward — refetch so the banner's
      // "expires in X" text stays accurate.
      queryClient.invalidateQueries({ queryKey: tenantKeys.profile(tenantId) });
    },
  });
}

// ─── useOwnerAway / useCancelOwnerAway ─────────────────────────────────────────
// NEW (RBAC hierarchy feature) — both mutations patch only ownerAwayUntil
// into the existing TenantProfile cache entry, since the backend responses
// return just { id, ownerAwayUntil }, not a full profile.

export function useOwnerAway() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tenantApi.ownerAway(tenantId),
    onSuccess: (result: OwnerAwayResult) => {
      queryClient.setQueryData<ApiResponse<TenantProfile>>(tenantKeys.profile(tenantId), old => {
        if (!old) return old;
        return { ...old, data: { ...old.data, ownerAwayUntil: result.data.ownerAwayUntil } };
      });
    },
  });
}

export function useCancelOwnerAway() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tenantApi.cancelOwnerAway(tenantId),
    onSuccess: (result: OwnerAwayResult) => {
      queryClient.setQueryData<ApiResponse<TenantProfile>>(tenantKeys.profile(tenantId), old => {
        if (!old) return old;
        return { ...old, data: { ...old.data, ownerAwayUntil: result.data.ownerAwayUntil } };
      });
    },
  });
}
