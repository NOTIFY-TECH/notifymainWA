import { messagesApi } from '@/services/messages-api';
import { useAuthStore } from '@/store/authStore';
import { Conversation, Message, SendMessageRequest } from '@/types/message';
import { CursorPaginatedResponse } from '@/types/index';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, InfiniteData } from '@tanstack/react-query';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const conversationKeys = {
  all: (tenantId: string) => ['conversations', tenantId] as const,
  list: (tenantId: string, filters?: object) => ['conversations', tenantId, 'list', filters] as const,
  detail: (tenantId: string, id: string) => ['conversations', tenantId, 'detail', id] as const,
  messages: (tenantId: string, id: string) => ['conversations', tenantId, 'messages', id] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ConversationListCache = { data: Conversation[]; meta?: unknown };

export function sortConversations(convs: Conversation[]): Conversation[] {
  return [...convs].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isPinned && b.isPinned) {
      return new Date(b.pinnedAt ?? 0).getTime() - new Date(a.pinnedAt ?? 0).getTime();
    }
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  });
}

// ─── useConversations ─────────────────────────────────────────────────────────

export function useConversations(filters?: { status?: string; sessionId?: string; search?: string }) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: conversationKeys.list(tenantId, filters),
    queryFn: () => messagesApi.getConversations(tenantId, { ...filters, limit: 50 }),
    enabled: !!tenantId && rehydrated,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    select: data => data.data,
  });
}

// ─── useConversation ──────────────────────────────────────────────────────────

export function useConversation(conversationId: string | null) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  return useQuery({
    queryKey: conversationKeys.detail(tenantId, conversationId ?? ''),
    queryFn: () => messagesApi.getConversation(tenantId, conversationId!),
    enabled: !!tenantId && !!conversationId && rehydrated,
    select: data => data.data,
  });
}

// ─── useMessages ──────────────────────────────────────────────────────────────

export function useMessages(conversationId: string | null) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const rehydrated = useAuthStore(s => s.rehydrated);

  const query = useInfiniteQuery<
    CursorPaginatedResponse<Message>,
    Error,
    InfiniteData<CursorPaginatedResponse<Message>>,
    ReturnType<typeof conversationKeys.messages>,
    string | undefined
  >({
    queryKey: conversationKeys.messages(tenantId, conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      messagesApi.getMessages(tenantId, {
        conversationId: conversationId!,
        before: pageParam,
        limit: 30,
      }),
    initialPageParam: undefined,
    getPreviousPageParam: first => first.meta?.nextCursor ?? undefined,
    getNextPageParam: () => undefined,
    enabled: !!tenantId && !!conversationId && rehydrated,
  });

  const messages =
    query.data?.pages
      .slice()
      .reverse()
      .flatMap(p => p.data) ?? [];

  return {
    ...query,
    messages,
    hasOlderMessages: query.hasPreviousPage,
    isFetchingOlderMessages: query.isFetchingPreviousPage,
    fetchOlderMessages: query.fetchPreviousPage,
  };
}

// ─── useMarkAsRead ────────────────────────────────────────────────────────────

export function useMarkAsRead() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.markAsRead(tenantId, conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
    },
  });
}

// ─── usePinConversation ───────────────────────────────────────────────────────

export function usePinConversation() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.pinConversation(tenantId, conversationId),
    onSuccess: (_, conversationId) => {
      const now = new Date().toISOString();
      queryClient.setQueriesData<ConversationListCache>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old?.data) return old;
        const patched = old.data.map(c => (c.id === conversationId ? { ...c, isPinned: true, pinnedAt: now } : c));
        return { ...old, data: sortConversations(patched) };
      });
    },
  });
}

// ─── useUnpinConversation ─────────────────────────────────────────────────────

export function useUnpinConversation() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.unpinConversation(tenantId, conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.setQueriesData<ConversationListCache>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old?.data) return old;
        const patched = old.data.map(c => (c.id === conversationId ? { ...c, isPinned: false, pinnedAt: null } : c));
        return { ...old, data: sortConversations(patched) };
      });
    },
  });
}

// ─── useArchiveConversation ───────────────────────────────────────────────────
// Optimistically removes the conversation from the current list immediately.
// The 30s poll will keep the archived view in sync. No need to add it to
// an "Archived" cache — the user navigates there via the status tab which
// triggers a fresh fetch with status=ARCHIVED.

export function useArchiveConversation() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.archiveConversation(tenantId, conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
    },
  });
}

// ─── useUnarchiveConversation ─────────────────────────────────────────────────
// Removes the conversation from the archived list immediately. The regular
// inbox will pick it up on next poll.

export function useUnarchiveConversation() {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.unarchiveConversation(tenantId, conversationId),
    onSuccess: (_, conversationId) => {
      // Invalidate all conversation list caches — prefix match catches all filter combos
      queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
    },
  });
}

// ─── useSendMessage ───────────────────────────────────────────────────────────

export function useSendMessage(conversationId: string) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageRequest) => messagesApi.send(tenantId, data),
    onSuccess: (newMessage: Message) => {
      queryClient.setQueryData(
        conversationKeys.messages(tenantId, conversationId),
        (old: InfiniteData<CursorPaginatedResponse<Message>> | undefined) => {
          if (!old) return old;
          const lastPage = old.pages[old.pages.length - 1];
          return {
            ...old,
            pages: [...old.pages.slice(0, -1), { ...lastPage, data: [...lastPage.data, newMessage] }],
          };
        },
      );

      queryClient.setQueriesData<ConversationListCache>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old?.data) return old;
        return {
          ...old,
          data: sortConversations(
            old.data.map(c =>
              c.id === conversationId
                ? { ...c, lastMessageAt: newMessage.createdAt, lastMessageText: newMessage.body ?? '' }
                : c,
            ),
          ),
        };
      });
    },
  });
}
