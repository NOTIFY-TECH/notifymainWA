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

// ─── useConversations ─────────────────────────────────────────────────────────

export function useConversations(filters?: { status?: string; sessionId?: string; search?: string }) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: conversationKeys.list(tenantId, filters),
    queryFn: () => messagesApi.getConversations(tenantId, { ...filters, limit: 50 }),
    enabled: !!tenantId,
    refetchInterval: 30_000,
    select: data => data.data,
  });
}

// ─── useConversation ──────────────────────────────────────────────────────────

export function useConversation(conversationId: string | null) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  return useQuery({
    queryKey: conversationKeys.detail(tenantId, conversationId ?? ''),
    queryFn: () => messagesApi.getConversation(tenantId, conversationId!),
    enabled: !!tenantId && !!conversationId,
    select: data => data.data,
  });
}

// ─── useMessages ──────────────────────────────────────────────────────────

export function useMessages(conversationId: string | null) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

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
    enabled: !!tenantId && !!conversationId,
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
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.markAsRead(tenantId, conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.setQueriesData<Conversation[]>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old) return old;
        return old.map(c => (c.id === conversationId ? { ...c, unreadCount: 0 } : c));
      });
    },
  });
}

// ─── useSendMessage ───────────────────────────────────────────────────────────

export function useSendMessage(conversationId: string) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageRequest) => messagesApi.send(tenantId, data),
    onSuccess: (newMessage: Message) => {
      queryClient.setQueryData(
        conversationKeys.messages(tenantId, conversationId),
        (old: InfiniteData<CursorPaginatedResponse<Message>> | undefined) => {
          if (!old) return old;
          // Append to the LAST page (newest page)
          const lastPage = old.pages[old.pages.length - 1];
          return {
            ...old,
            pages: [...old.pages.slice(0, -1), { ...lastPage, data: [...lastPage.data, newMessage] }],
          };
        },
      );

      // Also bump lastMessageAt + lastMessageText in the conversation list
      queryClient.setQueriesData<Conversation[]>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old) return old;
        return old.map(c =>
          c.id === conversationId
            ? { ...c, lastMessageAt: newMessage.createdAt, lastMessageText: newMessage.body ?? '' }
            : c,
        );
      });
    },
  });
}
