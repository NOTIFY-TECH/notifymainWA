import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiKeysApi } from '@/services/api-keys-api';
import { ApiKey, CreateApiKeyRequest, RenameApiKeyRequest } from '@/types/api-key';
import { ApiResponse } from '@/types/index';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const apiKeyKeys = {
  all: (tenantId: string) => ['api-keys', tenantId] as const,
  list: (tenantId: string) => ['api-keys', tenantId, 'list'] as const,
};

// ─── useApiKeys ───────────────────────────────────────────────────────────────

export function useApiKeys() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: apiKeyKeys.list(tenantId),
    queryFn: () => apiKeysApi.list(tenantId),
    enabled: rehydrated && !!tenantId,
    select: (data: ApiResponse<ApiKey[]>) => data.data,
  });
}

// ─── useCreateApiKey ──────────────────────────────────────────────────────────

export function useCreateApiKey() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => apiKeysApi.create(tenantId, data),
    onSuccess: () => {
      // Invalidate list so the new key appears — don't patch directly since
      // the creation response includes rawKey which we never want in the list cache.
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(tenantId) });
    },
  });
}

// ─── useRenameApiKey ──────────────────────────────────────────────────────────

export function useRenameApiKey() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ keyId, data }: { keyId: string; data: RenameApiKeyRequest }) =>
      apiKeysApi.rename(tenantId, keyId, data),
    onSuccess: (result, { keyId }) => {
      // Patch the specific key in the list cache — avoids a full refetch
      queryClient.setQueryData<ApiResponse<ApiKey[]>>(apiKeyKeys.list(tenantId), old => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(k => (k.id === keyId ? { ...k, name: result.data.name } : k)),
        };
      });
    },
  });
}

// ─── useRevokeApiKey ──────────────────────────────────────────────────────────

export function useRevokeApiKey() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => apiKeysApi.revoke(tenantId, keyId),
    onSuccess: (_, keyId) => {
      // Remove the revoked key from the list cache immediately
      queryClient.setQueryData<ApiResponse<ApiKey[]>>(apiKeyKeys.list(tenantId), old => {
        if (!old) return old;
        return { ...old, data: old.data.filter(k => k.id !== keyId) };
      });
    },
  });
}
