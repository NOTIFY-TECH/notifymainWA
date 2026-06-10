// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface OverviewStats {
  totalMessages: number;
  totalContacts: number;
  activeSessions: number;
  activeCampaigns: number;
  messagesDelta: number; // % change vs previous period
  contactsDelta: number;
  deliveryRate: number; // overall delivery rate (0–100)
}

export interface TimeSeriesPoint {
  date: string; // ISO date string
  sent: number;
  delivered: number;
  failed: number;
}

export interface DeliveryRateData {
  delivered: number;
  read: number;
  failed: number;
  pending: number;
}

export interface AgentStats {
  agentId: string;
  agentName: string;
  conversationsHandled: number;
  avgResponseTimeMs: number;
  messagesReplied: number;
}

export type AnalyticsPeriod = '24h' | '7d' | '30d' | '90d';
