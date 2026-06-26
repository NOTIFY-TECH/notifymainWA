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
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');

  return useQuery({
    queryKey: campaignKeys.list(tenantId, filters),
    queryFn: () => campaignsApi.list(tenantId, filters),
    enabled: !!tenantId,
    select: (data: PaginatedResponse<Campaign>) => data,
  });
}

// ─── useCampaign ──────────────────────────────────────────────────────────────

export function useCampaign(campaignId: string | null) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe } = useWebSocket();

  const query = useQuery({
    queryKey: campaignKeys.detail(tenantId, campaignId ?? ''),
    queryFn: () => campaignsApi.get(tenantId, campaignId!),
    enabled: !!tenantId && !!campaignId,
    select: (data: ApiResponse<CampaignDetail>) => data.data,
  });

  // ── Live progress via campaign:progress WebSocket event ──────────────────
  // Patches aggregate counts + status AND individual CampaignContact statuses.
  // The backend emits campaign:progress on every ack, and also emits
  // message:ack with { messageId, externalId, status } which we use to update
  // individual rows in the contacts array so the table updates live.
  useEffect(() => {
    if (!tenantId || !campaignId) return;

    const handleProgress = (payload: CampaignProgressEvent) => {
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

    // ── Per-contact status update via message:ack ─────────────────────────
    // The backend emits message:ack with { messageId, externalId, status }
    // whenever a delivery receipt arrives. We match the messageId against
    // CampaignContact.messageId in the cached contacts array and update that
    // row's status + timestamp fields so the table reflects the live state
    // without a full refetch.
    const handleAck = (payload: { messageId: string; externalId: string; status: string }) => {
      queryClient.setQueryData<ApiResponse<CampaignDetail>>(campaignKeys.detail(tenantId, campaignId), old => {
        if (!old?.data?.contacts) return old;
        const now = new Date().toISOString();
        return {
          ...old,
          data: {
            ...old.data,
            contacts: old.data.contacts.map(c => {
              if (c.messageId !== payload.messageId) return c;
              const status = payload.status as typeof c.status;
              return {
                ...c,
                status,
                sentAt: status === 'SENT' ? (c.sentAt ?? now) : c.sentAt,
                deliveredAt: status === 'DELIVERED' ? (c.deliveredAt ?? now) : c.deliveredAt,
                readAt: status === 'READ' ? (c.readAt ?? now) : c.readAt,
                failedAt: status === 'FAILED' ? (c.failedAt ?? now) : c.failedAt,
              };
            }),
          },
        };
      });
    };

    subscribe<CampaignProgressEvent>('campaign:progress', handleProgress);
    subscribe<{ messageId: string; externalId: string; status: string }>('message:ack', handleAck);
    return () => {
      unsubscribe<CampaignProgressEvent>('campaign:progress', handleProgress);
      unsubscribe<{ messageId: string; externalId: string; status: string }>('message:ack', handleAck);
    };
  }, [tenantId, campaignId, subscribe, unsubscribe, queryClient]);

  return query;
}

// ─── useCreateCampaign ────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => campaignsApi.create(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useUpdateCampaign ────────────────────────────────────────────────────────

export function useUpdateCampaign(campaignId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
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

// ─── useLaunchCampaign ───────────────────────────────────────────────────────

export function useLaunchCampaign(campaignId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
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

// ─── useUploadCampaignRecipients ─────────────────────────────────────────────

export function useUploadCampaignRecipients() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
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

// ─── useCancelCampaign ───────────────────────────────────────────────────────

export function useCancelCampaign(campaignId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
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

// ─── useRetryFailedCampaign ──────────────────────────────────────────────────

export function useRetryFailedCampaign(campaignId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
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

// ─── useCloneCampaign ────────────────────────────────────────────────────────

export function useCloneCampaign(campaignId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => campaignsApi.clone(tenantId, campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}

// ─── useAddCampaignContacts ──────────────────────────────────────────────────

export function useAddCampaignContacts(campaignId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { contactIds?: string[]; tags?: string[]; csvFile?: File }) => {
      if (data.csvFile) {
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
      return campaignsApi.addContacts(tenantId, campaignId, {
        contactIds: data.contactIds,
        tags: data.tags,
      });
    },

    onSuccess: (result, variables) => {
      if (variables.csvFile) {
        queryClient.invalidateQueries({
          queryKey: campaignKeys.detail(tenantId, campaignId),
        });
      } else {
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
      queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
    },
  });
}
