import api from './api';
import { PaginatedResponse } from '@/types/index';

// ─── Contact Types ────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  phoneNumber: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  notes: string | null;
  isBlocked: boolean;
  isOptedOut: boolean;
  tags: string[];
  conversationCount: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  latestConversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactConversationSummary {
  id: string;
  status: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unreadCount: number;
  createdAt: string;
  session: {
    id: string;
    name: string;
    phoneNumber: string | null;
  } | null;
}

export interface ContactDetail extends Omit<Contact, 'lastMessageAt' | 'lastMessageText' | 'latestConversationId'> {
  conversations: ContactConversationSummary[];
}

export interface CreateContactRequest {
  phoneNumber: string;
  name: string;
  email?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateContactRequest {
  name?: string;
  email?: string;
  phoneNumber?: string;
  notes?: string;
  isBlocked?: boolean;
  isOptedOut?: boolean;
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  isBlocked?: boolean;
  isOptedOut?: boolean;
  sortBy?: 'name' | 'createdAt' | 'lastMessageAt';
  sortOrder?: 'asc' | 'desc';
}

export interface DistinctTag {
  tag: string;
  count: number;
}

// ─── Contacts API ─────────────────────────────────────────────────────────────

export const contactsApi = {
  // ── Feature 1 ─────────────────────────────────────────────────────────────

  async list(tenantId: string, params?: ListContactsParams): Promise<PaginatedResponse<Contact>> {
    const { tags, ...rest } = params ?? {};
    const response = await api.get<PaginatedResponse<Contact>>(`/tenants/${tenantId}/contacts`, {
      params: {
        page: 1,
        limit: 20,
        ...rest,
        ...(tags && tags.length > 0 ? { tags: tags.join(',') } : {}),
      },
    });
    return response.data;
  },

  async create(tenantId: string, data: CreateContactRequest): Promise<Contact> {
    const response = await api.post<Contact>(`/tenants/${tenantId}/contacts`, data);
    return response.data;
  },

  // ── Feature 2 ─────────────────────────────────────────────────────────────

  async get(tenantId: string, contactId: string): Promise<ContactDetail> {
    const response = await api.get<ContactDetail>(`/tenants/${tenantId}/contacts/${contactId}`);
    return response.data;
  },

  async update(tenantId: string, contactId: string, data: UpdateContactRequest): Promise<ContactDetail> {
    const response = await api.patch<ContactDetail>(`/tenants/${tenantId}/contacts/${contactId}`, data);
    return response.data;
  },

  async addTag(tenantId: string, contactId: string, tag: string): Promise<ContactDetail> {
    const response = await api.post<ContactDetail>(`/tenants/${tenantId}/contacts/${contactId}/tags`, { tag });
    return response.data;
  },

  async removeTag(tenantId: string, contactId: string, tag: string): Promise<ContactDetail> {
    const response = await api.delete<ContactDetail>(`/tenants/${tenantId}/contacts/${contactId}/tags/${tag}`);
    return response.data;
  },

  // ── Feature 5 ─────────────────────────────────────────────────────────────

  async listTags(tenantId: string): Promise<DistinctTag[]> {
    const response = await api.get<DistinctTag[]>(`/tenants/${tenantId}/contacts/tags`);
    return response.data;
  },

  async remove(tenantId: string, contactId: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`/tenants/${tenantId}/contacts/${contactId}`);
    return response.data;
  },

  // ── Feature 4 ─────────────────────────────────────────────────────────────

  async createFromConversation(tenantId: string, conversationId: string): Promise<Contact> {
    const response = await api.post<Contact>(`/tenants/${tenantId}/contacts/from-conversation/${conversationId}`);
    return response.data;
  },

  // ── Feature 3 ─────────────────────────────────────────────────────────────

  async import(
    tenantId: string,
    file: File,
  ): Promise<{ created: number; updated: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/tenants/${tenantId}/contacts/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
