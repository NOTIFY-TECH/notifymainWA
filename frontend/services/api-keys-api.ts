import api from './api';
import { ApiResponse } from '@/types/index';
import { ApiKey, CreatedApiKey, CreateApiKeyRequest, RenameApiKeyRequest } from '@/types/api-key';

export const apiKeysApi = {
  // GET /tenants/:tenantId/api-keys
  async list(tenantId: string): Promise<ApiResponse<ApiKey[]>> {
    const res = await api.get<ApiResponse<ApiKey[]>>(`/tenants/${tenantId}/api-keys`);
    return res.data;
  },

  // POST /tenants/:tenantId/api-keys
  // Response includes rawKey — shown once, never again.
  async create(tenantId: string, data: CreateApiKeyRequest): Promise<ApiResponse<CreatedApiKey>> {
    const res = await api.post<ApiResponse<CreatedApiKey>>(`/tenants/${tenantId}/api-keys`, data);
    return res.data;
  },

  // PATCH /tenants/:tenantId/api-keys/:keyId
  async rename(tenantId: string, keyId: string, data: RenameApiKeyRequest): Promise<ApiResponse<ApiKey>> {
    const res = await api.patch<ApiResponse<ApiKey>>(`/tenants/${tenantId}/api-keys/${keyId}`, data);
    return res.data;
  },

  // DELETE /tenants/:tenantId/api-keys/:keyId
  async revoke(tenantId: string, keyId: string): Promise<ApiResponse<{ message: string }>> {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/tenants/${tenantId}/api-keys/${keyId}`);
    return res.data;
  },
};
