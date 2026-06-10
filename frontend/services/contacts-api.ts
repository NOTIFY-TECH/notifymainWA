import api from './api';
import { Contact, CreateContactRequest, UpdateContactRequest, ContactImportResult } from '@/types/contact';
import { ApiResponse, PaginatedResponse } from '@/types/index';

// ─── Contacts API ─────────────────────────────────────────────────────────────

export const contactsApi = {
  // ── List contacts for a tenant (searchable, paginated) ──────────────────────
  async list(
    tenantId: string,
    page = 1,
    limit = 30,
    search?: string,
    tags?: string[],
  ): Promise<PaginatedResponse<Contact>> {
    const response = await api.get<PaginatedResponse<Contact>>(`/tenants/${tenantId}/contacts`, {
      params: { page, limit, search, tags: tags?.join(',') },
    });
    return response.data;
  },

  // ── Get a single contact by ID ───────────────────────────────────────────────
  async getById(tenantId: string, contactId: string): Promise<ApiResponse<Contact>> {
    const response = await api.get<ApiResponse<Contact>>(`/tenants/${tenantId}/contacts/${contactId}`);
    return response.data;
  },

  // ── Get contact by phone number ──────────────────────────────────────────────
  async getByPhone(tenantId: string, phone: string): Promise<ApiResponse<Contact>> {
    const response = await api.get<ApiResponse<Contact>>(
      `/tenants/${tenantId}/contacts/phone/${encodeURIComponent(phone)}`,
    );
    return response.data;
  },

  // ── Create a new contact ─────────────────────────────────────────────────────
  async create(tenantId: string, data: CreateContactRequest): Promise<ApiResponse<Contact>> {
    const response = await api.post<ApiResponse<Contact>>(`/tenants/${tenantId}/contacts`, data);
    return response.data;
  },

  // ── Update a contact ─────────────────────────────────────────────────────────
  async update(tenantId: string, contactId: string, data: UpdateContactRequest): Promise<ApiResponse<Contact>> {
    const response = await api.patch<ApiResponse<Contact>>(`/tenants/${tenantId}/contacts/${contactId}`, data);
    return response.data;
  },

  // ── Delete a contact ─────────────────────────────────────────────────────────
  async delete(tenantId: string, contactId: string): Promise<ApiResponse<void>> {
    const response = await api.delete<ApiResponse<void>>(`/tenants/${tenantId}/contacts/${contactId}`);
    return response.data;
  },

  // ── Bulk import contacts from CSV ────────────────────────────────────────────
  // Expected CSV columns: phone (required), name, email, tags (comma-separated)
  async importCsv(tenantId: string, file: File): Promise<ApiResponse<ContactImportResult>> {
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<ApiResponse<ContactImportResult>>(`/tenants/${tenantId}/contacts/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Block / unblock a contact ────────────────────────────────────────────────
  async setBlocked(tenantId: string, contactId: string, isBlocked: boolean): Promise<ApiResponse<Contact>> {
    const response = await api.patch<ApiResponse<Contact>>(`/tenants/${tenantId}/contacts/${contactId}`, { isBlocked });
    return response.data;
  },
};
