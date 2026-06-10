export type SessionStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING' | 'LOADING' | 'QR_READY' | 'INITIALIZING';
export interface Session {
  id: string;
  name: string;
  tenantId: string;
  status: SessionStatus;
  phoneNumber?: string | null;
  messagesSent?: number;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionDto {
  name: string;
}

export interface QrResponse {
  qrCode: string | null;
  status: SessionStatus;
}

export interface SessionStatusResponse {
  id: string;
  status: SessionStatus;
  phoneNumber?: string | null;
}
