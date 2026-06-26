import {
  contactsApi,
  Contact,
  ContactDetail,
  CreateContactRequest,
  UpdateContactRequest,
  ListContactsParams,
  DistinctTag,
} from '@/services/contacts-api';
import { useAuthStore } from '@/store/authStore';
import { PaginatedResponse } from '@/types/index';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const contactKeys = {
  all: (tenantId: string) => ['contacts', tenantId] as const,
  list: (tenantId: string, filters?: object) => ['contacts', tenantId, 'list', filters] as const,
  detail: (tenantId: string, id: string) => ['contacts', tenantId, 'detail', id] as const,
  tags: (tenantId: string) => ['contacts', tenantId, 'tags'] as const,
};

// ─── useContacts ──────────────────────────────────────────────────────────────

export function useContacts(filters?: ListContactsParams) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: contactKeys.list(tenantId, filters),
    queryFn: () => contactsApi.list(tenantId, filters),
    enabled: !!tenantId,
    select: (data: PaginatedResponse<Contact>) => data,
  });
}

// ─── useContact ───────────────────────────────────────────────────────────────

export function useContact(contactId: string | null) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: contactKeys.detail(tenantId, contactId ?? ''),
    queryFn: () => contactsApi.get(tenantId, contactId!),
    enabled: !!tenantId && !!contactId,
  });
}

// ─── useCreateContact ─────────────────────────────────────────────────────────

export function useCreateContact() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContactRequest) => contactsApi.create(tenantId, data),
    onSuccess: (newContact: Contact) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all(tenantId) });
      queryClient.setQueriesData<PaginatedResponse<Contact>>({ queryKey: contactKeys.list(tenantId) }, old => {
        if (!old) return old;
        return {
          ...old,
          data: [newContact, ...old.data],
          meta: { ...old.meta, total: old.meta.total + 1 },
        };
      });
    },
  });
}

// ─── useUpdateContact ─────────────────────────────────────────────────────────

export function useUpdateContact(contactId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateContactRequest) => contactsApi.update(tenantId, contactId, data),
    onSuccess: (updated: ContactDetail) => {
      queryClient.setQueryData(contactKeys.detail(tenantId, contactId), updated);
      queryClient.invalidateQueries({ queryKey: contactKeys.list(tenantId) });
    },
  });
}

// ─── useContactTags ───────────────────────────────────────────────────────────

export function useContactTags(contactId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  const setDetail = (updated: ContactDetail) => {
    queryClient.setQueryData(contactKeys.detail(tenantId, contactId), updated);
  };

  const add = useMutation({
    mutationFn: (tag: string) => contactsApi.addTag(tenantId, contactId, tag),
    onSuccess: setDetail,
  });

  const remove = useMutation({
    mutationFn: (tag: string) => contactsApi.removeTag(tenantId, contactId, tag),
    onSuccess: setDetail,
  });

  return { add, remove };
}

// ─── useDistinctTags ────────────────────────────────────────────────────────

export function useDistinctTags() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: contactKeys.tags(tenantId),
    queryFn: () => contactsApi.listTags(tenantId),
    enabled: !!tenantId,
  });
}

// ─── useEstimatedTagCount ───────────────────────────────────────────────────

export function useEstimatedTagCount(tags: string[]) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const params: ListContactsParams = { tags, limit: 1 };

  return useQuery({
    queryKey: contactKeys.list(tenantId, params),
    queryFn: () => contactsApi.list(tenantId, params),
    enabled: !!tenantId && tags.length > 0,
    select: data => data.meta.total,
  });
}

// ─── useDeleteContact ─────────────────────────────────────────────────────────
//
// Reads tenantId inside mutationFn (not at hook init time) to avoid the
// stale-snapshot bug where the store hasn't hydrated yet when the hook
// mounts, leaving tenantId as '' and sending DELETE to /tenants//contacts/:id.
// Same pattern used in useTenant.ts (fixed session 9).

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (contactId: string) => {
      // Read tenantId at call time — store is guaranteed hydrated by the
      // time the user can click the delete button.
      const tenantId = useAuthStore.getState().tenant?.id ?? '';
      return contactsApi.remove(tenantId, contactId);
    },
    onSuccess: (_, contactId) => {
      const tenantId = useAuthStore.getState().tenant?.id ?? '';
      queryClient.removeQueries({ queryKey: contactKeys.detail(tenantId, contactId) });
      queryClient.setQueriesData<PaginatedResponse<Contact>>({ queryKey: contactKeys.list(tenantId) }, old => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter(c => c.id !== contactId),
          meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
        };
      });
      router.push('/dashboard/contacts');
    },
  });
}

// ─── useCreateContactFromConversation ─────────────────────────────────────────

export function useCreateContactFromConversation() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => contactsApi.createFromConversation(tenantId, conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    },
  });
}

// ─── useImportContacts ────────────────────────────────────────────────────────

export function useImportContacts() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => contactsApi.import(tenantId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all(tenantId) });
    },
  });
}
