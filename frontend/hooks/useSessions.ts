import { sessionsApi } from '@/services/sessions-api';
import { useAuthStore } from '@/store/authStore';
import { Session } from '@/types/session';
import { useQuery } from '@tanstack/react-query';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const sessionKeys = {
  all: (tenantId: string) => ['sessions', tenantId] as const,
  list: (tenantId: string) => ['sessions', tenantId, 'list'] as const,
};

// ─── useSessions ──────────────────────────────────────────────────────────────

export function useSessions() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: sessionKeys.list(tenantId),
    queryFn: () => sessionsApi.list(),
    enabled: !!tenantId,
    select: (data: Session[]) => data,
  });
}

// ─── useConnectedSessions — filtered to CONNECTED only ───────────────────────

export function useConnectedSessions() {
  const query = useSessions();
  return {
    ...query,
    data: query.data?.filter(s => s.status === 'CONNECTED') ?? [],
  };
}
