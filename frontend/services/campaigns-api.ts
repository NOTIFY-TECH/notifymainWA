import api from './api';
import { PaginatedResponse, ApiResponse } from '@/types/index';
import {
  Campaign,
  CampaignDetail,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ImportRecipientsResult,
  ListCampaignsParams,
  RetryFailedResult,
  AddContactsResult,
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

  // PATCH /tenants/:tenantId/campaigns/:campaignId
  //
  // Edits a DRAFT/SCHEDULED campaign. All fields optional — only send what
  // changed. To clear an existing schedule, send scheduledAt: null explicitly
  // (omitting the field entirely leaves the existing schedule untouched).
  async update(tenantId: string, campaignId: string, data: UpdateCampaignRequest): Promise<ApiResponse<Campaign>> {
    const response = await api.patch<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}`, data);
    return response.data;
  },

  // POST /tenants/:tenantId/campaigns/:campaignId/launch
  //
  // Starts sending a DRAFT/SCHEDULED campaign that has at least one
  // recipient. Backend decides RUNNING (immediate) vs SCHEDULED based on
  // whether scheduledAt is set on the campaign at launch time.
  async launch(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.post<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}/launch`);
    return response.data;
  },

  async cancel(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.post<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}/cancel`);
    return response.data;
  },

  // POST /tenants/:tenantId/campaigns/:campaignId/retry-failed
  //
  // Re-queues only FAILED CampaignContact rows. Backend restricts this to
  // COMPLETED campaigns — see CampaignsService.retryFailedCampaign.
  async retryFailed(tenantId: string, campaignId: string): Promise<ApiResponse<RetryFailedResult>> {
    const response = await api.post<ApiResponse<RetryFailedResult>>(
      `/tenants/${tenantId}/campaigns/${campaignId}/retry-failed`,
    );
    return response.data;
  },

  // POST /tenants/:tenantId/campaigns/:campaignId/clone
  //
  // Creates a new DRAFT campaign copying name/messageTemplate/mediaUrl/
  // mediaType/sessionId/rateLimitPerMin, with zero contacts attached.
  async clone(tenantId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    const response = await api.post<ApiResponse<Campaign>>(`/tenants/${tenantId}/campaigns/${campaignId}/clone`);
    return response.data;
  },

  // POST /tenants/:tenantId/campaigns/:campaignId/contacts
  //
  // Adds recipients via contactIds/tags. For CSV, use uploadRecipientsCsv.
  async addContacts(
    tenantId: string,
    campaignId: string,
    data: { contactIds?: string[]; tags?: string[] },
  ): Promise<ApiResponse<AddContactsResult>> {
    const response = await api.post<ApiResponse<AddContactsResult>>(
      `/tenants/${tenantId}/campaigns/${campaignId}/contacts`,
      data,
    );
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
