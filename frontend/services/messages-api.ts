import api from './api';
import { Message, Conversation, SendMessageRequest, GetMessagesParams } from '@/types/message';
import { ApiResponse, PaginatedResponse, CursorPaginatedResponse } from '@/types/index';

// ─── Media Upload Response ────────────────────────────────────────────────────

export interface UploadedMediaResponse {
  url: string;
  path: string;
  filename: string;
  originalName: string;
  mediaType: string;
  size: number;
}

// ─── Messages API ─────────────────────────────────────────────────────────────

export const messagesApi = {
  // ── Upload a media file ───────────────────────────────────────────────────
  async uploadMedia(tenantId: string, file: File): Promise<UploadedMediaResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<UploadedMediaResponse>(`/tenants/${tenantId}/media/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Send a message ────────────────────────────────────────────────────────
  async send(tenantId: string, data: SendMessageRequest): Promise<Message> {
    const response = await api.post<Message>(`/tenants/${tenantId}/messages`, {
      sessionId: data.sessionId,
      to: data.to,
      type: data.type.toLowerCase(), // backend expects lowercase
      text: data.text ?? data.body, // backend uses dto.text → stored as body
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      caption: data.caption,
      conversationId: data.conversationId,
    });
    return response.data;
  },

  // ── Get all conversations for a tenant ───────────────────────────────────
  async getConversations(
    tenantId: string,
    params?: { page?: number; limit?: number; status?: string; sessionId?: string; search?: string },
  ): Promise<PaginatedResponse<Conversation>> {
    const response = await api.get<PaginatedResponse<Conversation>>(`/tenants/${tenantId}/conversations`, {
      params: { page: 1, limit: 30, ...params },
    });
    return response.data;
  },

  // ── Get a single conversation by ID ──────────────────────────────────────
  async getConversation(tenantId: string, conversationId: string): Promise<ApiResponse<Conversation>> {
    const response = await api.get<ApiResponse<Conversation>>(`/tenants/${tenantId}/conversations/${conversationId}`);
    return response.data;
  },

  // ── Get messages for a conversation (cursor-based) ────────────────────────
  async getMessages(tenantId: string, params: GetMessagesParams): Promise<CursorPaginatedResponse<Message>> {
    const { conversationId, limit, before } = params;
    const response = await api.get<CursorPaginatedResponse<Message>>(
      `/tenants/${tenantId}/conversations/${conversationId}/messages`,
      { params: { limit, before } },
    );
    return response.data;
  },

  // ── Mark all messages in a conversation as read ───────────────────────────
  async markAsRead(tenantId: string, conversationId: string): Promise<ApiResponse<void>> {
    const response = await api.post<ApiResponse<void>>(`/tenants/${tenantId}/conversations/${conversationId}/read`);
    return response.data;
  },

  // ── Search messages across conversations ──────────────────────────────────
  async search(tenantId: string, query: string, conversationId?: string): Promise<PaginatedResponse<Message>> {
    const response = await api.get<PaginatedResponse<Message>>(`/tenants/${tenantId}/messages/search`, {
      params: { query, conversationId },
    });
    return response.data;
  },
};
