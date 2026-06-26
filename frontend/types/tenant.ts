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
