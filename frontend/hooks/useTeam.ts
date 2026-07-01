import { teamApi } from '@/services/team-api';
import { useAuthStore } from '@/store/authStore';
import {
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  UpdateMemberManagerRequest,
  AcceptInviteRequest,
  TeamListResponse,
  InviteTokenInfo,
  TeamMember,
  AgentPerformanceStats,
} from '@/types/team';
import { ApiResponse } from '@/types/index';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const teamKeys = {
  all: (tenantId: string) => ['team', tenantId] as const,
  list: (tenantId: string) => ['team', tenantId, 'list'] as const,
  myAgentsPerformance: (tenantId: string) => ['team', tenantId, 'my-agents-performance'] as const,
};

// ─── useTeam ──────────────────────────────────────────────────────────────────

export function useTeam() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: teamKeys.list(tenantId),
    queryFn: () => teamApi.listMembers(tenantId),
    enabled: rehydrated && !!tenantId,
    select: (data: ApiResponse<TeamListResponse>) => data.data,
  });
}

// ─── useInviteMember ──────────────────────────────────────────────────────────

export function useInviteMember() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteMemberRequest) => teamApi.inviteMember(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(tenantId) });
    },
  });
}

// ─── useResendInvite ──────────────────────────────────────────────────────────

export function useResendInvite() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');

  return useMutation({
    mutationFn: (invitationId: string) => teamApi.resendInvite(tenantId, invitationId),
    // No cache update needed — resend doesn't change the invitation list shape
  });
}

// ─── useRevokeInvite ──────────────────────────────────────────────────────────

export function useRevokeInvite() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => teamApi.revokeInvite(tenantId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(tenantId) });
    },
  });
}

// ─── useUpdateMemberRole ──────────────────────────────────────────────────────

export function useUpdateMemberRole() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateMemberRoleRequest }) =>
      teamApi.updateMemberRole(tenantId, userId, data),
    onSuccess: (result: ApiResponse<TeamMember>) => {
      // Patch the member in the list cache directly — no need for a full refetch.
      // Also clear managerId if the role changed away from AGENT, mirroring the
      // server-side auto-clear (so the picker doesn't show stale data until the
      // next full refetch).
      queryClient.setQueryData<ApiResponse<TeamListResponse>>(teamKeys.list(tenantId), old => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            members: old.data.members.map(m =>
              m.id === result.data.id ? { ...m, role: result.data.role, managerId: result.data.managerId } : m,
            ),
          },
        };
      });
    },
  });
}

// ─── useUpdateMemberManager ───────────────────────────────────────────────────
// NEW (RBAC hierarchy feature) — assign/change/clear which Manager an Agent
// reports to. Patches the cache directly on success (same pattern as
// useUpdateMemberRole) so the picker reflects the change without a refetch.

export function useUpdateMemberManager() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateMemberManagerRequest }) =>
      teamApi.updateMemberManager(tenantId, userId, data),
    onSuccess: (result: ApiResponse<TeamMember>) => {
      queryClient.setQueryData<ApiResponse<TeamListResponse>>(teamKeys.list(tenantId), old => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            members: old.data.members.map(m =>
              m.id === result.data.id ? { ...m, managerId: result.data.managerId } : m,
            ),
          },
        };
      });
    },
  });
}

// ─── useMyAgentsPerformance ───────────────────────────────────────────────────
// NEW (RBAC hierarchy feature) — Manager-facing performance stats for their
// own agents. Backend auto-scopes to req.user.userId, so no params beyond
// tenantId. Gated on role === 'MANAGER' in `enabled` since the endpoint is
// MANAGER-only server-side — avoids firing a request that will 403/404 for
// every other role.

export function useMyAgentsPerformance() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const role = useAuthStore(s => s.user?.role);
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: teamKeys.myAgentsPerformance(tenantId),
    queryFn: () => teamApi.getMyAgentsPerformance(tenantId),
    enabled: rehydrated && !!tenantId && role === 'MANAGER',
    select: (data: ApiResponse<AgentPerformanceStats[]>) => data.data,
  });
}

// ─── useRemoveMember ──────────────────────────────────────────────────────────

export function useRemoveMember() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(tenantId, userId),
    onSuccess: (_result, userId) => {
      // Remove the member from the list cache directly
      queryClient.setQueryData<ApiResponse<TeamListResponse>>(teamKeys.list(tenantId), old => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            members: old.data.members.filter(m => m.id !== userId),
          },
        };
      });
    },
  });
}

// ─── useValidateInviteToken ───────────────────────────────────────────────────
// Used on the public /invite/[token] page — no tenantId needed.

export function useValidateInviteToken(token: string) {
  return useQuery({
    queryKey: ['invite-token', token],
    queryFn: () => teamApi.validateToken(token),
    enabled: !!token,
    retry: false, // don't retry 400/404 — expired/invalid token should fail fast
    select: (data: ApiResponse<InviteTokenInfo>) => data.data,
  });
}

// ─── useAcceptInvite ──────────────────────────────────────────────────────────

export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: (data: AcceptInviteRequest) => teamApi.acceptInvite(token, data),
    // Caller handles onSuccess — needs to call setAuth + router.push
  });
}
