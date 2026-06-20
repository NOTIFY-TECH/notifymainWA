import { campaignsApi } from '@/services/campaigns-api';
import { useAuthStore } from '@/store/authStore';
import {
  Campaign,
  CampaignDetail,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ListCampaignsParams,
  CampaignProgressEvent,
  RetryFailedResult,
  AddContactsResult,
} from '@/types/campaign';
import { PaginatedResponse, ApiResponse } from '@/types/index';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const campaignKeys = {
  all: (tenantId: string) => ['campaigns', tenantId] as const,
  list: (tenantId: string, filters?: object) => ['campaigns', tenantId, 'list', filters] as const,
  detail: (tenantId: string, id: string) => ['campaigns', tenantId, 'detail', id] as const,
};

// ─── useCampaigns ─────────────────────────────────────────────────────────────

export function useCampaigns(filters?: ListCampaignsParams) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: campaignKeys.list(tenantId, filters),
    queryFn: () => campaignsApi.list(tenantId, filters),
    enabled: !!tenantId,
    select: (data: PaginatedResponse<Campaign>) => data,
  });
}

// ─── useCampaign ──────────────────────────────────────────────────────────────

export function useCampaign(campaignId: string | null) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe } = useWebSocket();

  const query = useQuery({
    queryKey: campaignKeys.detail(tenantId, campaignId ?? ''),
    queryFn: () => campaignsApi.get(tenantId, campaignId!),
    enabled: !!tenantId && !!campaignId,
    select: (data: ApiResponse<CampaignDetail>) => data.data,
  });

  // ── Live progress via campaign:progress WebSocket event ──
  useEffect(() => {
    if (!tenantId || !campaignId) return;

    const handler = (payload: CampaignProgressEvent) => {
      if (payload.campaignId !== campaignId) return;

      queryClient.setQueryData<ApiResponse<CampaignDetail>>(campaignKeys.detail(tenantId, campaignId), old => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            sentCount: payload.sentCount,
            deliveredCount: payload.deliveredCount,
            readCount: payload.readCount,
            failedCount: payload.failedCount,
            status: payload.status,
          },
        };
      });

      // Also patch the list view, if cached
      queryClient.setQueriesData<PaginatedResponse<Campaign>>({ queryKey: ['campaigns', tenantId, 'list'] }, old => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map(c =>
            c.id === payload.campaignId
              ? {
                  ...c,
                  sentCount: payload.sentCount,
                  deliveredCount: payload.deliveredCount,
                  readCount: payload.readCount,
                  failedCount: payload.failedCount,
                  status: payload.status,
                }
              : c,
          ),
        };
      });
    };

    subscribe<CampaignProgressEvent>('campaign:progress', handler);
    return () => unsubscribe<CampaignProgressEvent>('campaign:progress', handler);
  }, [tenantId, campaignId, subscribe, unsubscribe, queryClient]);

  return query;
}

// ─── useCreateCampaign ────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => campaignsApi.create(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useUpdateCampaign ─────────────────────────────────────────────────────────
//
// Patches the detail cache directly with the full updated campaign returned
// by the backend (PATCH returns the whole Campaign row, not just progress
// fields like the other mutations) — simplest possible merge, no need to
// cherry-pick fields since every field on the response is authoritative.

export function useUpdateCampaign(campaignId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCampaignRequest) => campaignsApi.update(tenantId, campaignId, data),
    onSuccess: (result: ApiResponse<Campaign>) => {
      queryClient.setQueryData(
        campaignKeys.detail(tenantId, campaignId),
        (old: ApiResponse<CampaignDetail> | undefined) => {
          if (!old) return old;
          return { ...old, data: { ...old.data, ...result.data } };
        },
      );
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useLaunchCampaign ──────────────────────────────────────────────────────────
//
// Same direct-patch pattern as useUpdateCampaign — the launch response is
// the full updated Campaign row (status now RUNNING/SCHEDULED, startedAt set).

export function useLaunchCampaign(campaignId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => campaignsApi.launch(tenantId, campaignId),
    onSuccess: (result: ApiResponse<Campaign>) => {
      queryClient.setQueryData(
        campaignKeys.detail(tenantId, campaignId),
        (old: ApiResponse<CampaignDetail> | undefined) => {
          if (!old) return old;
          return { ...old, data: { ...old.data, ...result.data } };
        },
      );
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useUploadCampaignRecipients ──────────────────────────────────────────────
//
// Separate mutation from useCreateCampaign — kept distinct because:
// (a) it runs after creation with a known campaignId,
// (b) its onSuccess scope is narrower (only the detail cache needs refreshing,
//     not the full list — totalContacts on the list card will update via the
//     detail invalidation cascading through the shared cache key prefix).
//
// The campaignId is passed at call time (mutateAsync(file)), not at hook
// instantiation, because the ID isn't known until createCampaign resolves.
// We thread it in via a wrapper object to keep mutateAsync's call signature
// explicit and avoid closure-captured state going stale between the two steps.

export function useUploadCampaignRecipients() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, file }: { campaignId: string; file: File }) =>
      campaignsApi.uploadRecipientsCsv(tenantId, campaignId, file),
    onSuccess: (_result, { campaignId }) => {
      queryClient.invalidateQueries({
        queryKey: campaignKeys.detail(tenantId, campaignId),
      });
    },
  });
}

// ─── useCancelCampaign ────────────────────────────────────────────────────────

export function useCancelCampaign(campaignId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => campaignsApi.cancel(tenantId, campaignId),
    onSuccess: (updated: ApiResponse<Campaign>) => {
      queryClient.setQueryData(
        campaignKeys.detail(tenantId, campaignId),
        (old: ApiResponse<CampaignDetail> | undefined) => {
          if (!old) return old;
          return { ...old, data: { ...old.data, status: updated.data.status } };
        },
      );
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useRetryFailedCampaign ───────────────────────────────────────────────────
//
// Patches the detail cache directly with the returned progress fields,
// mirroring useCancelCampaign's pattern, since the backend already computes
// and returns fresh progress in the same response — no need to wait for the
// campaign:progress WebSocket event to update the failedCount/sentCount.

export function useRetryFailedCampaign(campaignId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => campaignsApi.retryFailed(tenantId, campaignId),
    onSuccess: (result: ApiResponse<RetryFailedResult>) => {
      queryClient.setQueryData(
        campaignKeys.detail(tenantId, campaignId),
        (old: ApiResponse<CampaignDetail> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              sentCount: result.data.sentCount,
              deliveredCount: result.data.deliveredCount,
              readCount: result.data.readCount,
              failedCount: result.data.failedCount,
              status: result.data.status,
            },
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useCloneCampaign ─────────────────────────────────────────────────────────
//
// Returns the full mutation result so the caller (ResendCampaignModal) can
// read result.data.id and redirect to the new campaign's detail page.
// Invalidates campaignKeys.all so the list picks up the new DRAFT on next visit.

export function useCloneCampaign(campaignId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => campaignsApi.clone(tenantId, campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useAddCampaignContacts ───────────────────────────────────────────────────
//
// Handles two different API paths behind one mutation:
//   - contactIds/tags  → POST .../contacts  (returns full progress + counts)
//   - csvFile          → POST .../recipients/csv  (returns created/skipped only)
//
// For the contacts/tags path, the detail cache is patched directly with the
// returned progress fields (same pattern as useRetryFailedCampaign).
//
// For the CSV path, the CSV endpoint doesn't return progress so we can't patch
// directly — instead we just invalidate the detail query to force a refetch.

export function useAddCampaignContacts(campaignId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { contactIds?: string[]; tags?: string[]; csvFile?: File }) => {
      if (data.csvFile) {
        // CSV path — reuse the existing /recipients/csv endpoint.
        const result = await campaignsApi.uploadRecipientsCsv(tenantId, campaignId, data.csvFile);
        return {
          data: {
            addedCount: result.created,
            skippedCount: result.skipped,
            sentCount: 0,
            deliveredCount: 0,
            readCount: 0,
            failedCount: 0,
            totalContacts: 0,
          },
          success: true,
        } satisfies ApiResponse<AddContactsResult>;
      }

      // contacts/tags path
      return campaignsApi.addContacts(tenantId, campaignId, {
        contactIds: data.contactIds,
        tags: data.tags,
      });
    },

    onSuccess: (result, variables) => {
      if (variables.csvFile) {
        // CSV endpoint doesn't return progress — invalidate to force a refetch
        queryClient.invalidateQueries({
          queryKey: campaignKeys.detail(tenantId, campaignId),
        });
      } else {
        // contacts/tags endpoint returns full progress — patch cache directly.
        // status intentionally NOT touched here — addContactsToCampaign never
        // changes status, and the API response doesn't include it.
        queryClient.setQueryData(
          campaignKeys.detail(tenantId, campaignId),
          (old: ApiResponse<CampaignDetail> | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: {
                ...old.data,
                totalContacts: result.data.totalContacts,
                sentCount: result.data.sentCount,
                deliveredCount: result.data.deliveredCount,
                readCount: result.data.readCount,
                failedCount: result.data.failedCount,
              },
            };
          },
        );
      }
      // Always refresh the list so campaign cards reflect the new totalContacts
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}
