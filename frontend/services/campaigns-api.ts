import api from './api';
import { PaginatedResponse, ApiResponse } from '@/types/index';
import {
  Campaign,
  CampaignDetail,
  CreateCampaignRequest,
  ImportRecipientsResult,
  ListCampaignsParams,
} from '@/types/campaign';

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

  // POST /tenants/:tenantId/campaigns/:campaignId/recipients/csv
  //
  // Sends the CSV as multipart/form-data with the file in a field named 'file'.
  // axios sets Content-Type: multipart/form-data with the correct boundary
  // automatically when the body is a FormData instance — do not set it manually.
  //
  // Returns ImportRecipientsResult directly (no ApiResponse wrapper),
  // matching the backend controller which returns the service result as-is.
  async uploadRecipientsCsv(tenantId: string, campaignId: string, file: File): Promise<ImportRecipientsResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ImportRecipientsResult>(
      `/tenants/${tenantId}/campaigns/${campaignId}/recipients/csv`,
      formData,
      // Do NOT pass Content-Type here — axios must set it with the multipart
      // boundary. Manually setting 'multipart/form-data' omits the boundary
      // and the server will fail to parse the body.
    );
    return response.data;
  },
};
