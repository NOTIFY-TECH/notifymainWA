import api from './api';
import { useAuthStore } from '@/store/authStore';
import { Session, CreateSessionDto, QrResponse, SessionStatusResponse } from '@/types/session';

function getTenantId(): string {
  const tenantId = useAuthStore.getState().tenant?.id;
  if (!tenantId) throw new Error('No tenant in auth store — user not logged in?');
  return tenantId;
}

export const sessionsApi = {
  list: async (): Promise<Session[]> => {
    const tenantId = getTenantId();
    const res = await api.get<Session[]>(`/tenants/${tenantId}/sessions`);
    return res.data;
  },

  create: async (dto: CreateSessionDto): Promise<Session> => {
    const tenantId = getTenantId();
    const res = await api.post<Session>(`/tenants/${tenantId}/sessions`, dto);
    return res.data;
  },

  getQr: async (sessionId: string): Promise<QrResponse> => {
    const tenantId = getTenantId();
    const res = await api.get<QrResponse>(`/tenants/${tenantId}/sessions/${sessionId}/qr`);
    return res.data;
  },

  getStatus: async (sessionId: string): Promise<SessionStatusResponse> => {
    const tenantId = getTenantId();
    const res = await api.get<SessionStatusResponse>(`/tenants/${tenantId}/sessions/${sessionId}/status`);
    return res.data;
  },

  /** Reconnect using existing WhatsApp auth — no QR if auth still valid */
  reconnect: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const tenantId = getTenantId();
    const res = await api.post(`/tenants/${tenantId}/sessions/${sessionId}/reconnect`);
    return res.data;
  },

  /** Unlink WhatsApp number — clears auth so next scan links a new number */
  unlink: async (sessionId: string): Promise<Session> => {
    const tenantId = getTenantId();
    const res = await api.post<Session>(`/tenants/${tenantId}/sessions/${sessionId}/unlink`);
    return res.data;
  },

  delete: async (sessionId: string): Promise<void> => {
    const tenantId = getTenantId();
    await api.delete(`/tenants/${tenantId}/sessions/${sessionId}`);
  },
};
