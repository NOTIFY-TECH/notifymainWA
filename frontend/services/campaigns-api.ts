import api from './api';
import { PaginatedResponse, ApiResponse } from '@/types/index';
import { Campaign, CampaignDetail, CreateCampaignRequest, ListCampaignsParams } from '@/types/campaign';

export const campaignsApi = {
  async list(tenantId: string, params?: ListCampaignsParams): Promise<PaginatedResponse<Campaign>> {
    const response = await api.get<PaginatedResponse<Campaign>>(`/tenants/${tenantId}/campaigns`, {
      params: { page: 1, limit: 20, ...params },
    });
    return response.data;
  },

  async get(tenantId: string, campaignId: string): Promise<ApiResponse<CampaignDetail>> {
    const response = await api.get<ApiResponse<CampaignDetail>>(`/tenants/${tenantId}/campaigns/${campaignId}`);
    return response.data;
  },

  async create(tenantId: string, data: CreateCampaignRequest): Promise<ApiResponse<Campaign>> {
    const response = await api.post<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns`, data);
    return response.data;
  },

  async cancel(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.post<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}/cancel`);
    return response.data;
  },
};
