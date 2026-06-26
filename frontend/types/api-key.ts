export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string; // e.g. "ntfy_abc123" — display hint only
  permissions: unknown;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// Returned once on creation — includes the raw key that must be shown immediately
export interface CreatedApiKey extends Omit<ApiKey, 'permissions' | 'lastUsedAt'> {
  rawKey: string;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresAt?: string;
}

export interface RenameApiKeyRequest {
  name: string;
}
