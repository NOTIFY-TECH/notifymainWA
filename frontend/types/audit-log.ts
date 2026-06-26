export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'DOWNLOAD'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SESSION_CONNECT'
  | 'SESSION_DISCONNECT'
  | 'CAMPAIGN_START'
  | 'CAMPAIGN_STOP'
  | 'API_KEY_CREATE'
  | 'API_KEY_REVOKE';

export interface AuditLogUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: AuditLogUser;
}

export interface AuditLogMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: AuditLogMeta;
  success: boolean;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  action?: AuditAction;
  from?: string;
  to?: string;
}
