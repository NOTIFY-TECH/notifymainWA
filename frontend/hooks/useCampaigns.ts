import { campaignsApi } from '@/services/campaigns-api';
import { useAuthStore } from '@/store/authStore';
import {
  Campaign,
  CampaignDetail,
  CreateCampaignRequest,
  ListCampaignsParams,
  CampaignProgressEvent,
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
      queryClient.setQueriesData<PaginatedResponse<Campaign>>({ queryKey: campaignKeys.all(tenantId) }, old => {
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
