import api from './api';
import axios from 'axios';
import { ApiResponse } from '@/types/index';
import {
  TenantProfile,
  UpdateTenantProfileRequest,
  UpdateTenantProfileResult,
  ResendVerificationResponse,
  VerifyEmailResponse,
} from '@/types/tenant';

export const tenantApi = {
  // GET /tenants/:tenantId
  async getProfile(tenantId: string): Promise<ApiResponse<TenantProfile>> {
    const response = await api.get<ApiResponse<TenantProfile>>(`/tenants/${tenantId}`);
    return response.data;
  },

  // PATCH /tenants/:tenantId
  // Returns { data, verificationSent } — flatter than ApiResponse<T>, see
  // types/tenant.ts comment on UpdateTenantProfileResult.
  async updateProfile(tenantId: string, data: UpdateTenantProfileRequest): Promise<UpdateTenantProfileResult> {
    const response = await api.patch<UpdateTenantProfileResult>(`/tenants/${tenantId}`, data);
    return response.data;
  },

  // POST /tenants/:tenantId/resend-verification
  async resendVerification(tenantId: string): Promise<ApiResponse<ResendVerificationResponse>> {
    const response = await api.post<ApiResponse<ResendVerificationResponse>>(
      `/tenants/${tenantId}/resend-verification`,
    );
    return response.data;
  },

  // ── Public route — no JWT, use plain axios ────────────────────────────────
  // GET /tenants/verify-email?token=...
  async verifyEmail(token: string): Promise<ApiResponse<VerifyEmailResponse>> {
    const response = await axios.get<ApiResponse<VerifyEmailResponse>>(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/tenants/verify-email`,
      { params: { token } },
    );
    return response.data;
  },
};
