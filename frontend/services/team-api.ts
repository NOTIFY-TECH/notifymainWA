import api from './api';
import axios from 'axios';
import { ApiResponse } from '@/types/index';
import {
  TeamListResponse,
  InviteTokenInfo,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  AcceptInviteRequest,
  AcceptInviteResponse,
  TeamMember,
} from '@/types/team';

export const teamApi = {
  // GET /tenants/:tenantId/team
  // Returns members + pendingInvitations — not paginated.
  async listMembers(tenantId: string): Promise<ApiResponse<TeamListResponse>> {
    const response = await api.get<ApiResponse<TeamListResponse>>(`/tenants/${tenantId}/team`);
    return response.data;
  },

  // POST /tenants/:tenantId/team/invite
  async inviteMember(
    tenantId: string,
    data: InviteMemberRequest,
  ): Promise<ApiResponse<{ id: string; email: string; role: string; expiresAt: string }>> {
    const response = await api.post(`/tenants/${tenantId}/team/invite`, data);
    return response.data;
  },

  // POST /tenants/:tenantId/team/invite/:invitationId/resend
  async resendInvite(tenantId: string, invitationId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.post(`/tenants/${tenantId}/team/invite/${invitationId}/resend`);
    return response.data;
  },

  // DELETE /tenants/:tenantId/team/invite/:invitationId
  async revokeInvite(tenantId: string, invitationId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/tenants/${tenantId}/team/invite/${invitationId}`);
    return response.data;
  },

  // PATCH /tenants/:tenantId/team/:userId/role
  async updateMemberRole(
    tenantId: string,
    userId: string,
    data: UpdateMemberRoleRequest,
  ): Promise<ApiResponse<TeamMember>> {
    const response = await api.patch<ApiResponse<TeamMember>>(`/tenants/${tenantId}/team/${userId}/role`, data);
    return response.data;
  },

  // DELETE /tenants/:tenantId/team/:userId
  async removeMember(tenantId: string, userId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/tenants/${tenantId}/team/${userId}`);
    return response.data;
  },

  // ── Public routes — no JWT, use plain axios ───────────────────────────────

  // GET /invitations/:token
  async validateToken(token: string): Promise<ApiResponse<InviteTokenInfo>> {
    const response = await axios.get<ApiResponse<InviteTokenInfo>>(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/invitations/${token}`,
    );
    return response.data;
  },

  // POST /invitations/:token/accept
  async acceptInvite(token: string, data: AcceptInviteRequest): Promise<ApiResponse<AcceptInviteResponse>> {
    const response = await axios.post<ApiResponse<AcceptInviteResponse>>(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/invitations/${token}/accept`,
      data,
    );
    return response.data;
  },
};
