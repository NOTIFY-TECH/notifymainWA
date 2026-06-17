'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  useMessages,
  useMarkAsRead,
  useSendMessage,
  useConversation,
  conversationKeys,
} from '@/hooks/useConversations';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCreateContactFromConversation } from '@/hooks/useContacts';
import MessageBubble from './MessageBubble';
import SendMessageForm from './SendMessageForm';
import { Message } from '@/types/message';
import { InfiniteData } from '@tanstack/react-query';
import { CursorPaginatedResponse } from '@/types/index';
import { Loader2, ArrowLeft, UserPlus, Check } from 'lucide-react';

interface ThreadViewProps {
  conversationId: string;
  onBack?: () => void;
}

export default function ThreadView({ conversationId, onBack }: ThreadViewProps) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const [savedContact, setSavedContact] = useState(false);

  const { subscribe, unsubscribe } = useWebSocket();
  const { data: conversation } = useConversation(conversationId);
  const { messages, isLoading, hasOlderMessages, isFetchingOlderMessages, fetchOlderMessages } =
    useMessages(conversationId);

  const markAsRead = useMarkAsRead();
  const sendMessage = useSendMessage(conversationId);
  const saveAsContact = useCreateContactFromConversation();

  // ── Mark as read when conversation opens ──────────────────────────────────
  useEffect(() => {
    if (conversationId && conversation?.unreadCount) {
      markAsRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ── Reset savedContact state when conversation changes ────────────────────
  useEffect(() => {
    setSavedContact(false);
  }, [conversationId]);

  // ── Scroll to bottom on first load only ───────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (isFirstLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      isFirstLoad.current = false;
    }
  }, [isLoading, messages.length]);

  // ── Scroll to bottom when a NEW message arrives (not on load-older) ───────
  const prevLengthRef = useRef(0);
  useEffect(() => {
    const prev = prevLengthRef.current;
    const curr = messages.length;
    if (curr > prev && !isFirstLoad.current) {
      const lastMsg = messages[curr - 1];
      const isNew =
        lastMsg && (lastMsg.direction === 'OUTBOUND' || Date.now() - new Date(lastMsg.createdAt).getTime() < 5000);
      if (isNew) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevLengthRef.current = curr;
  }, [messages]);

  // ── WebSocket — append incoming messages in real time ─────────────────────
  const handleIncoming = useCallback(
    (event: {
      conversationId: string;
      messageId: string;
      from: string;
      body: string;
      type: string;
      mediaUrl?: string;
      mediaType?: string;
      caption?: string;
      createdAt: string;
    }) => {
      if (event.conversationId !== conversationId) return;

      const newMessage: Message = {
        id: event.messageId,
        conversationId: event.conversationId,
        direction: 'INBOUND',
        type: event.type.toUpperCase() as Message['type'],
        body: event.body,
        mediaUrl: event.mediaUrl,
        mediaType: event.mediaType,
        caption: event.caption,
        fromNumber: event.from,
        toNumber: '',
        status: 'DELIVERED',
        createdAt: event.createdAt,
        updatedAt: event.createdAt,
        tenantId,
        sessionId: conversation?.sessionId ?? '',
      };

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

      markAsRead.mutate(conversationId);
    },
    [conversationId, tenantId, queryClient, conversation?.sessionId],
  );

  const handleOutgoingSynced = useCallback(
    (event: {
      conversationId: string;
      messageId: string;
      to: string;
      body: string;
      type: string;
      mediaUrl?: string;
      mediaType?: string;
      createdAt: string;
    }) => {
      if (event.conversationId !== conversationId) return;

      const newMessage: Message = {
        id: event.messageId,
        conversationId: event.conversationId,
        direction: 'OUTBOUND',
        type: event.type.toUpperCase() as Message['type'],
        body: event.body,
        mediaUrl: event.mediaUrl,
        mediaType: event.mediaType,
        fromNumber: '',
        toNumber: event.to,
        status: 'SENT',
        createdAt: event.createdAt,
        updatedAt: event.createdAt,
        tenantId,
        sessionId: conversation?.sessionId ?? '',
      };

      queryClient.setQueryData(
        conversationKeys.messages(tenantId, conversationId),
        (old: InfiniteData<CursorPaginatedResponse<Message>> | undefined) => {
          if (!old) return old;
          const lastPage = old.pages[old.pages.length - 1];
          // Avoid duplicate if this message ID is already in cache
          const alreadyExists = old.pages.some(p => p.data.some(m => m.id === newMessage.id));
          if (alreadyExists) return old;
          return {
            ...old,
            pages: [...old.pages.slice(0, -1), { ...lastPage, data: [...lastPage.data, newMessage] }],
          };
        },
      );
    },
    [conversationId, tenantId, queryClient, conversation?.sessionId],
  );

  useEffect(() => {
    subscribe('message:outgoing_synced', handleOutgoingSynced);
    return () => unsubscribe('message:outgoing_synced', handleOutgoingSynced);
  }, [subscribe, unsubscribe, handleOutgoingSynced]);

  useEffect(() => {
    subscribe('message:received', handleIncoming);
    return () => unsubscribe('message:received', handleIncoming);
  }, [subscribe, unsubscribe, handleIncoming]);

  // ── WebSocket — update message status on ack ──────────────────────────────
  const handleAck = useCallback(
    (event: { messageId: string; status: string }) => {
      queryClient.setQueryData(
        conversationKeys.messages(tenantId, conversationId),
        (old: InfiniteData<CursorPaginatedResponse<Message>> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: page.data.map(msg => {
                if (msg.id === event.messageId) {
                  console.log('[ACK] found message, updating to:', event.status);
                }
                return msg.id === event.messageId ? { ...msg, status: event.status as Message['status'] } : msg;
              }),
            })),
          };
        },
      );
    },
    [conversationId, tenantId, queryClient],
  );

  useEffect(() => {
    subscribe('message:ack', handleAck);
    return () => unsubscribe('message:ack', handleAck);
  }, [subscribe, unsubscribe, handleAck]);

  // ── Send handler — text or media ──────────────────────────────────────────
  const handleSend = useCallback(
    (payload: { text?: string; mediaUrl?: string; mediaType?: string; caption?: string; type: string }) => {
      if (!conversation) return;
      sendMessage.mutate({
        sessionId: conversation.sessionId,
        to: conversation.phoneNumber,
        type: payload.type as Message['type'],
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        caption: payload.caption,
        conversationId,
      });
    },
    [conversation, conversationId, sendMessage],
  );

  // ── Load older messages — preserve scroll position ────────────────────────
  const handleLoadOlder = useCallback(async () => {
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    await fetchOlderMessages();
    requestAnimationFrame(() => {
      if (el) {
        el.scrollTop += el.scrollHeight - prevScrollHeight;
      }
    });
  }, [fetchOlderMessages]);

  // ── Save as contact handler ───────────────────────────────────────────────
  const handleSaveAsContact = useCallback(() => {
    saveAsContact.mutate(conversationId, {
      onSuccess: () => setSavedContact(true),
    });
  }, [conversationId, saveAsContact]);

  const displayName = conversation?.contact?.name ?? conversation?.contactName ?? conversation?.phoneNumber;
  const hasContact = !!conversation?.contactId || savedContact;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="h-9 w-9 rounded-full bg-[hsl(var(--green))] flex items-center justify-center text-white text-sm font-semibold uppercase shrink-0">
          {displayName?.charAt(0) ?? '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{displayName ?? 'Loading…'}</p>
          {conversation?.session && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">via {conversation.session.name}</p>
          )}
        </div>

        {/* Save as Contact — only shown when no contact is linked */}
        {!hasContact && (
          <button
            onClick={handleSaveAsContact}
            disabled={saveAsContact.isPending}
            title="Save as contact"
            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--green))] transition-colors disabled:opacity-50"
          >
            {saveAsContact.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          </button>
        )}

        {/* Saved confirmation — briefly shown after saving */}
        {hasContact && savedContact && (
          <div className="p-2 text-[hsl(var(--green))]" title="Contact saved">
            <Check size={16} />
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {hasOlderMessages && (
          <div className="flex justify-center pb-2">
            <button
              onClick={handleLoadOlder}
              disabled={isFetchingOlderMessages}
              className="text-xs text-[hsl(var(--green))] hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {isFetchingOlderMessages ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </>
              ) : (
                'Load earlier messages'
              )}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No messages yet</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg: Message) => <MessageBubble key={msg.id} message={msg} />)
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Send form ── */}
      {conversation && (
        <SendMessageForm
          sessionId={conversation.sessionId}
          toNumber={conversation.phoneNumber}
          conversationId={conversationId}
          tenantId={tenantId}
          onSend={handleSend}
          isSending={sendMessage.isPending}
        />
      )}
    </div>
  );
}
