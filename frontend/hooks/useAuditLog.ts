import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { auditLogApi } from '@/services/audit-log-api';
import { AuditLogQuery } from '@/types/audit-log';

export const auditLogKeys = {
  all: (tenantId: string) => ['audit-log', tenantId] as const,
  list: (tenantId: string, query: AuditLogQuery) => ['audit-log', tenantId, query] as const,
};

export function useAuditLog(query: AuditLogQuery = {}) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: auditLogKeys.list(tenantId, query),
    queryFn: () => auditLogApi.list(tenantId, query),
    enabled: !!tenantId && rehydrated,
    staleTime: 30_000,
  });
}
