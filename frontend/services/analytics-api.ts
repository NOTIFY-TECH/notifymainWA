import api from './api';
import { OverviewStats, TimeSeriesPoint, DeliveryRateData, AgentStats, AnalyticsPeriod } from '@/types/analytics';
import { ApiResponse } from '@/types/index';

// ─── Analytics API ────────────────────────────────────────────────────────────

export const analyticsApi = {
  // ── Overview KPI stats (dashboard hero cards) ────────────────────────────────
  async getOverview(tenantId: string, period: AnalyticsPeriod = '7d'): Promise<ApiResponse<OverviewStats>> {
    const response = await api.get<ApiResponse<OverviewStats>>(`/tenants/${tenantId}/analytics/overview`, {
      params: { period },
    });
    return response.data;
  },

  // ── Messages over time (line/bar chart data) ─────────────────────────────────
  async getMessageTimeSeries(
    tenantId: string,
    period: AnalyticsPeriod = '7d',
  ): Promise<ApiResponse<TimeSeriesPoint[]>> {
    const response = await api.get<ApiResponse<TimeSeriesPoint[]>>(
      `/tenants/${tenantId}/analytics/messages/timeseries`,
      { params: { period } },
    );
    return response.data;
  },

  // ── Delivery rate breakdown (donut/pie chart data) ───────────────────────────
  async getDeliveryRates(tenantId: string, period: AnalyticsPeriod = '7d'): Promise<ApiResponse<DeliveryRateData>> {
    const response = await api.get<ApiResponse<DeliveryRateData>>(`/tenants/${tenantId}/analytics/messages/delivery`, {
      params: { period },
    });
    return response.data;
  },

  // ── Per-agent performance stats ───────────────────────────────────────────────
  async getAgentStats(tenantId: string, period: AnalyticsPeriod = '7d'): Promise<ApiResponse<AgentStats[]>> {
    const response = await api.get<ApiResponse<AgentStats[]>>(`/tenants/${tenantId}/analytics/agents`, {
      params: { period },
    });
    return response.data;
  },

  // ── Campaign-level analytics ──────────────────────────────────────────────────
  async getCampaignAnalytics(tenantId: string, campaignId: string): Promise<ApiResponse<TimeSeriesPoint[]>> {
    const response = await api.get<ApiResponse<TimeSeriesPoint[]>>(
      `/tenants/${tenantId}/analytics/campaigns/${campaignId}`,
    );
    return response.data;
  },
};
