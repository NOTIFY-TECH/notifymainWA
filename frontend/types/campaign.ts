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
  mediaType: string | null;
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
  mediaType?: string;
  contactIds?: string[];
  tags?: string[];
  scheduledAt?: string;
  rateLimitPerMin?: number;
}

// ─── Update (edit) campaign ────────────────────────────────────────────────────

// All fields optional — PATCH semantics. scheduledAt: undefined = don't touch,
// null = clear the schedule, string = set a new one.
export interface UpdateCampaignRequest {
  name?: string;
  sessionId?: string;
  messageTemplate?: string;
  mediaUrl?: string;
  mediaType?: string;
  scheduledAt?: string | null;
  rateLimitPerMin?: number;
}

export interface ListCampaignsParams {
  page?: number;
  limit?: number;
  status?: CampaignStatus;
  sessionId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
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

// ─── Retry failed recipients ──────────────────────────────────────────────────

// Return shape from POST .../retry-failed — service spreads computeCampaignProgress
// onto { campaignId, retriedCount }, so this mirrors the progress fields on
// Campaign rather than re-typing them separately.
export interface RetryFailedResult {
  campaignId: string;
  retriedCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  totalContacts: number;
  status: CampaignStatus;
}

// ─── Add contacts to campaign ─────────────────────────────────────────────────

// Return shape from POST .../contacts — service spreads computeCampaignProgress
// plus addedCount/skippedCount.
export interface AddContactsResult {
  addedCount: number;
  skippedCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  totalContacts: number;
}
