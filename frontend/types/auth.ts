export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'AGENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Convenience helper — use wherever you need a display name
export function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  isActive: boolean;
  createdAt: string;
}

export type SubscriptionPlan = 'BASIC' | 'GROWTH' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  tenant: Tenant;
}

export interface RefreshResponse {
  accessToken: string;
}
