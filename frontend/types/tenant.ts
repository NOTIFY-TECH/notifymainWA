export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  pendingEmail: string | null;
  emailVerifyExpiresAt: string | null;
  plan: string;
  isActive: boolean;
  maxSessions: number;
  maxMessages: number;
  maxContacts: number;
  // NEW (RBAC hierarchy feature) — when set and in the future, TENANT_ADMIN
  // has delegated access to routes tagged @AllowDelegation(). null = no
  // active delegation window.
  ownerAwayUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTenantProfileRequest {
  name?: string;
  email?: string;
}

// updateProfile's service method returns `{ data: updated, verificationSent }`
// — one level flatter than the `ApiResponse<{ message }>` shape the other
// tenants/team mutations use, since the frontend needs both the updated
// profile AND a flag for whether a verification email actually went out.
export interface UpdateTenantProfileResult {
  data: TenantProfile;
  verificationSent: boolean;
}

export interface ResendVerificationResponse {
  message: string;
}

export interface VerifyEmailResponse {
  message: string;
  email: string;
}

// ─── Owner-away delegation (NEW — RBAC hierarchy feature) ─────────────────────
//
// Mirrors TenantsService.ownerAway()/cancelOwnerAway()'s response exactly —
// both return only the narrow { id, ownerAwayUntil } select, not the full
// TenantProfile. The frontend patches ownerAwayUntil into the existing
// TenantProfile cache entry on success rather than replacing the whole object.

export interface OwnerAwayResult {
  data: {
    id: string;
    ownerAwayUntil: string | null;
  };
}
