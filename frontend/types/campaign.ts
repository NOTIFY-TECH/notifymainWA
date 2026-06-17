export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type CampaignContactStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'OPTED_OUT';

export interface Campaign {
  id: string;
  tenantId: string;
  sessionId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  messageTemplate: string;
  mediaUrl: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  rateLimitPerMin: number;
  createdAt: string;
  updatedAt: string;
  session?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
}

export interface CampaignContact {
  id: string;
  phoneNumber: string;
  status: CampaignContactStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
}

export interface CampaignDetail extends Campaign {
  contacts: CampaignContact[];
}

export interface CreateCampaignRequest {
  name: string;
  sessionId: string;
  messageTemplate: string;
  mediaUrl?: string;
  contactIds?: string[];
  scheduledAt?: string;
  rateLimitPerMin?: number;
}

export interface ListCampaignsParams {
  page?: number;
  limit?: number;
  status?: CampaignStatus;
  sessionId?: string;
  search?: string;
}

// Payload shape for the 'campaign:progress' WebSocket event
export interface CampaignProgressEvent {
  campaignId: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  totalContacts: number;
  status: CampaignStatus;
}

// ─── CSV recipient import ─────────────────────────────────────────────────────

export interface RecipientImportError {
  row: number;
  reason: string;
}

// Return shape from POST .../recipients/csv
// Returned directly (no ApiResponse wrapper) — matches backend ImportRecipientsResult
export interface ImportRecipientsResult {
  created: number;
  skipped: number;
  errors: RecipientImportError[];
}
