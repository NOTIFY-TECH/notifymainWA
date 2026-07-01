import { UserRole } from '@/types/auth';

// Re-export so callers can import UserRole from either place without ambiguity.
// The canonical definition lives in @/types/auth to match the auth store's User type.
export type { UserRole };

// Roles that can be assigned when inviting a new member
// UPDATED (RBAC hierarchy feature) — MANAGER added.
export const INVITABLE_ROLES: UserRole[] = ['TENANT_ADMIN', 'MANAGER', 'AGENT'];

// Human-readable labels for display
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_OWNER: 'Owner',
  TENANT_ADMIN: 'Admin',
  MANAGER: 'Manager',
  AGENT: 'Agent',
};

// ─── Member ───────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  // NEW (RBAC hierarchy feature) — which Manager this member (if an Agent)
  // reports to. null for unassigned Agents and for all non-Agent roles.
  managerId: string | null;
}

// ─── Pending invitation ───────────────────────────────────────────────────────

export interface PendingInvitation {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ─── listMembers response ─────────────────────────────────────────────────────

export interface TeamListResponse {
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
}

// ─── Invite token validation ──────────────────────────────────────────────────

export interface InviteTokenInfo {
  email: string;
  role: UserRole;
  tenantName: string;
  inviterName: string;
  expiresAt: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface InviteMemberRequest {
  email: string;
  role: UserRole;
}

export interface UpdateMemberRoleRequest {
  role: UserRole;
}

// NEW (RBAC hierarchy feature) — assign/change/clear an Agent's manager.
// managerId: null explicitly unassigns.
export interface UpdateMemberManagerRequest {
  managerId: string | null;
}

export interface AcceptInviteRequest {
  firstName: string;
  lastName: string;
  password: string;
}

// ─── Manager performance tab (NEW — RBAC hierarchy feature) ──────────────────
//
// Mirrors TeamService.getMyAgentsPerformance()'s per-agent shape exactly.
// Response-time is intentionally not included — explicitly descoped per
// project decision at the backend. Endpoint is MANAGER-only and
// auto-scoped server-side to the caller's own agents; no request params.

export interface AgentPerformanceStats {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  messagesSent: number;
  conversationsHandled: number;
  conversationsResolved: number;
  campaignsCreated: number;
}

// ─── acceptInvite response ────────────────────────────────────────────────────
//
// NOTE: refreshToken is intentionally NOT part of this type. As of the
// team.controller.ts/team.service.ts fix, the refresh token is set as an
// httpOnly `refresh_token` cookie server-side (same as AuthController's
// login/signup/refresh routes) and stripped from the JSON body before it
// reaches the client. It must never be read out of this response — if you
// see it in the body again, that's a regression of the original bug where
// newly-invited users had no refresh cookie set and were silently logged out
// ~15 minutes after accepting their invite.
//
// `tenant` now mirrors AuthService.login's full tenant shape
// (id, name, slug, plan, isActive, createdAt) instead of just {id, name} —
// so invite-page.tsx no longer needs to fall back to hand-built defaults
// (slug: '', plan: 'BASIC', etc.) when hydrating the auth store.
export interface AcceptInviteResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
    createdAt: string;
  };
}
