import api from './api';
import {
  CampaignTemplate,
  CreateCampaignTemplateRequest,
  UpdateCampaignTemplateRequest,
} from '@/types/campaign-template';

interface ApiResponse<T> {
  data: T;
  success: boolean;
}

export const campaignTemplatesApi = {
  list: (tenantId: string) =>
    api.get<ApiResponse<CampaignTemplate[]>>(`/tenants/${tenantId}/campaign-templates`).then(r => r.data),

  create: (tenantId: string, body: CreateCampaignTemplateRequest) =>
    api.post<ApiResponse<CampaignTemplate>>(`/tenants/${tenantId}/campaign-templates`, body).then(r => r.data),

  update: (tenantId: string, templateId: string, body: UpdateCampaignTemplateRequest) =>
    api
      .patch<ApiResponse<CampaignTemplate>>(`/tenants/${tenantId}/campaign-templates/${templateId}`, body)
      .then(r => r.data),

  remove: (tenantId: string, templateId: string) =>
    api.delete<{ success: boolean }>(`/tenants/${tenantId}/campaign-templates/${templateId}`).then(r => r.data),
};
