import api from './api';
import { Campaign, CampaignStats, CreateCampaignRequest } from '@/types/campaign';
import { ApiResponse, PaginatedResponse } from '@/types/index';

// ─── Campaigns API ────────────────────────────────────────────────────────────

export const campaignsApi = {
  // ── List all campaigns for a tenant ─────────────────────────────────────────
  async list(tenantId: string, page = 1, limit = 20): Promise<PaginatedResponse<Campaign>> {
    const response = await api.get<PaginatedResponse<Campaign>>(`/tenants/${tenantId}/campaigns`, {
      params: { page, limit },
    });
    return response.data;
  },

  // ── Get a single campaign ────────────────────────────────────────────────────
  async getById(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.get<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}`);
    return response.data;
  },

  // ── Create a campaign ────────────────────────────────────────────────────────
  async create(tenantId: string, data: CreateCampaignRequest): Promise<ApiResponse<Campaign>> {
    const response = await api.post<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns`, data);
    return response.data;
  },

  // ── Upload recipients CSV for a campaign ────────────────────────────────────
  // Sends multipart/form-data; the file is a CSV with at minimum a `phone` column.
  async uploadRecipients(tenantId: string, campaignId: string, file: File): Promise<ApiResponse<{ imported: number }>> {
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<ApiResponse<{ imported: number }>>(
      `/tenants/${tenantId}/campaigns/${campaignId}/recipients`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  // ── Pause a running campaign ─────────────────────────────────────────────────
  async pause(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.patch<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}/pause`);
    return response.data;
  },

  // ── Resume a paused campaign ─────────────────────────────────────────────────
  async resume(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.patch<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}/resume`);
    return response.data;
  },

  // ── Delete a campaign (only DRAFT or COMPLETED) ──────────────────────────────
  async delete(tenantId: string, campaignId: string): Promise<ApiResponse<void>> {
    const response = await api.delete<ApiResponse<void>>(`/tenants/${tenantId}/campaigns/${campaignId}`);
    return response.data;
  },

  // ── Get live stats for a campaign (used for 5s polling) ─────────────────────
  async getStats(tenantId: string, campaignId: string): Promise<ApiResponse<CampaignStats>> {
    const response = await api.get<ApiResponse<CampaignStats>>(`/tenants/${tenantId}/campaigns/${campaignId}/stats`);
    return response.data;
  },
};
