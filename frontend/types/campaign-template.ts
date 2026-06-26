export interface CampaignTemplate {
  id: string;
  tenantId: string;
  name: string;
  messageBody: string;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignTemplateRequest {
  name: string;
  messageBody: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface UpdateCampaignTemplateRequest {
  name?: string;
  messageBody?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
}
