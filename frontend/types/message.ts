// ─── Message & Conversation Types ────────────────────────────────────────────

export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type ConversationStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'SNOOZED';

export interface Message {
  id: string;
  conversationId: string;
  tenantId: string;
  sessionId: string;
  direction: MessageDirection;
  type: MessageType;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  status: MessageStatus;
  fromNumber: string;
  toNumber: string;
  externalId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Included relations (returned by backend includes) ────────────────────────

export interface ConversationContact {
  id: string;
  name: string;
  whatsappName?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string;
  email?: string | null;
}

export interface ConversationSession {
  id: string;
  name: string;
  phoneNumber?: string | null;
  status?: string;
}

export interface ConversationAgent {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  tenantId: string;
  sessionId: string;
  phoneNumber: string; // the contact's phone number
  contactId?: string | null;
  contactName?: string | null; // convenience alias (may not exist — use contact.name)
  status: ConversationStatus;
  assignedAgentId?: string | null;
  subject?: string | null;
  unreadCount: number;
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  lastMessage?: Message; // optionally populated
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;

  // Included relations
  contact?: ConversationContact | null;
  session?: ConversationSession | null;
  assignedAgent?: ConversationAgent | null;
}

// ─── Request / Query types ────────────────────────────────────────────────────

export interface SendMessageRequest {
  sessionId: string;
  to: string;
  type: MessageType;
  body?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  conversationId?: string;
}

export interface GetMessagesParams {
  conversationId: string;
  cursor?: string;
  limit?: number;
  before?: string;
  after?: string;
}
