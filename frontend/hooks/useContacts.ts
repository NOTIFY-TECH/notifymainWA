import {
  contactsApi,
  Contact,
  ContactDetail,
  CreateContactRequest,
  UpdateContactRequest,
  ListContactsParams,
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
      // Update detail cache immediately
      queryClient.setQueryData(contactKeys.detail(tenantId, contactId), updated);
      // Invalidate list so name/email changes reflect there too
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

// ─── useDeleteContact ─────────────────────────────────────────────────────────

export function useDeleteContact() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (contactId: string) => contactsApi.remove(tenantId, contactId),
    onSuccess: (_, contactId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: contactKeys.detail(tenantId, contactId) });
      // Remove from list cache optimistically
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
