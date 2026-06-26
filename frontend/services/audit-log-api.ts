import api from './api';
import { AuditLogResponse, AuditLogQuery } from '@/types/audit-log';

export const auditLogApi = {
  list: (tenantId: string, query: AuditLogQuery = {}): Promise<AuditLogResponse> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.action) params.set('action', query.action);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);

    return api.get(`/tenants/${tenantId}/audit-log?${params.toString()}`).then(r => r.data);
  },
};
