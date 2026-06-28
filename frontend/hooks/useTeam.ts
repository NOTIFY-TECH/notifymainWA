import { teamApi } from '@/services/team-api';
import { useAuthStore } from '@/store/authStore';
import {
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  AcceptInviteRequest,
  TeamListResponse,
  InviteTokenInfo,
  TeamMember,
} from '@/types/team';
import { ApiResponse } from '@/types/index';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const teamKeys = {
  all: (tenantId: string) => ['team', tenantId] as const,
  list: (tenantId: string) => ['team', tenantId, 'list'] as const,
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
      // Patch the member in the list cache directly — no need for a full refetch
      queryClient.setQueryData<ApiResponse<TeamListResponse>>(teamKeys.list(tenantId), old => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            members: old.data.members.map(m => (m.id === result.data.id ? { ...m, role: result.data.role } : m)),
          },
        };
      });
    },
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
