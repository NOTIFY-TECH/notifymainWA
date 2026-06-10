// ─── Campaign Types ───────────────────────────────────────────────────────────

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';

export interface Campaign {
  id: string;
  tenantId: string;
  sessionId: string;
  name: string;
  message: string;
  status: CampaignStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  deliveryRate: number; // 0–100
  readRate: number; // 0–100
}

export interface CreateCampaignRequest {
  name: string;
  sessionId: string;
  message: string;
  scheduledAt?: string; // ISO timestamp; omit to start immediately
  // CSV recipient data is uploaded separately via uploadRecipients()
}

export interface CampaignRecipient {
  phone: string;
  name?: string;
  [key: string]: string | undefined; // custom template variables
}
