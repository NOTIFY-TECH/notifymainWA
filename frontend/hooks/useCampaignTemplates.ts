import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { campaignTemplatesApi } from '@/services/campaign-templates-api';
import { CreateCampaignTemplateRequest, UpdateCampaignTemplateRequest } from '@/types/campaign-template';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const templateKeys = {
  all: (tenantId: string) => ['campaign-templates', tenantId] as const,
  list: (tenantId: string) => ['campaign-templates', tenantId, 'list'] as const,
};

// ─── useCampaignTemplates ─────────────────────────────────────────────────────

export function useCampaignTemplates() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: templateKeys.list(tenantId),
    queryFn: () => campaignTemplatesApi.list(tenantId),
    enabled: !!tenantId && rehydrated,
    select: data => data.data,
  });
}

// ─── useCreateCampaignTemplate ────────────────────────────────────────────────

export function useCreateCampaignTemplate() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCampaignTemplateRequest) => campaignTemplatesApi.create(tenantId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all(tenantId) });
    },
  });
}

// ─── useUpdateCampaignTemplate ────────────────────────────────────────────────

export function useUpdateCampaignTemplate(templateId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateCampaignTemplateRequest) => campaignTemplatesApi.update(tenantId, templateId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all(tenantId) });
    },
  });
}

// ─── useDeleteCampaignTemplate ────────────────────────────────────────────────
// Same fix as above — was calling old.map/.filter on the raw envelope object.

export function useDeleteCampaignTemplate() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => campaignTemplatesApi.remove(tenantId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all(tenantId) });
    },
  });
}
