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
import MessageBubble from './MessageBubble';
import SendMessageForm from './SendMessageForm';
import { Message } from '@/types/message';
import { InfiniteData } from '@tanstack/react-query';
import { CursorPaginatedResponse } from '@/types/index';
import { Loader2, ArrowLeft, UserPlus, Check, X, Pencil, MessageSquare, ChevronUp } from 'lucide-react';
import { contactsApi } from '@/services/contacts-api';
import { useCreateContactFromConversation, useContact } from '@/hooks/useContacts';
import ContactInfoForm from '@/components/contacts/ContactInfoForm';
import { getAvatarColor } from './ConversationItem';

interface ThreadViewProps {
  conversationId: string;
  onBack?: () => void;
}

// ─── Save as Contact Modal ────────────────────────────────────────────────────

interface SaveContactModalProps {
  open: boolean;
  phoneDisplay: string;
  onSave: (name: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function SaveContactModal({ open, phoneDisplay, onSave, onClose, isPending }: SaveContactModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return setError('Name is required.');
    setError(null);
    onSave(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-[600] text-[hsl(var(--foreground))]">Save as contact</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        <div className="mb-3">
          <p className="text-[11px] font-[500] text-[hsl(var(--muted-foreground))] mb-1">Phone number</p>
          <p className="text-[13px] text-[hsl(var(--foreground))] px-3 py-2 rounded-[var(--radius-sm)] bg-[hsl(var(--muted))] border border-[hsl(var(--border))]">
            {phoneDisplay}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">WhatsApp privacy ID — cannot be edited</p>
        </div>
        <div className="mb-4">
          <label className="text-[11px] font-[500] text-[hsl(var(--muted-foreground))] mb-1 block">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="e.g. Rahul Sharma"
            className="w-full rounded-[var(--radius-sm)] border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]/60 transition-colors"
          />
          {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[12px] font-[500] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[12px] font-[600] bg-[hsl(var(--green))] text-white hover:bg-[hsl(142_71%_30%)] transition-colors disabled:opacity-50 shadow-sm"
          >
            {isPending ? 'Saving…' : 'Save contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Contact Modal ───────────────────────────────────────────────────────

interface EditContactModalProps {
  open: boolean;
  contactId: string;
  onClose: () => void;
}

function EditContactModal({ open, contactId, onClose }: EditContactModalProps) {
  const { data: contact, isLoading } = useContact(open ? contactId : null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(var(--border))]">
          <h3 className="text-[13px] font-[600] text-[hsl(var(--foreground))]">Edit contact</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        {isLoading || !contact ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : (
          <ContactInfoForm key={`${contact.id}-${open}`} contact={contact} isEditing={true} onSaved={onClose} />
        )}
      </div>
    </div>
  );
}

// ─── ThreadView ───────────────────────────────────────────────────────────────

export default function ThreadView({ conversationId, onBack }: ThreadViewProps) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  const [savedContact, setSavedContact] = useState(false);
  const [savedContactConvId, setSavedContactConvId] = useState<string | null>(null);
  const isSavedForCurrentConv = savedContact && savedContactConvId === conversationId;

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  const { subscribe, unsubscribe } = useWebSocket();
  const { data: conversation } = useConversation(conversationId);
  const { messages, isLoading, hasOlderMessages, isFetchingOlderMessages, fetchOlderMessages } =
    useMessages(conversationId);

  const markAsRead = useMarkAsRead();
  const sendMessage = useSendMessage(conversationId);
  const createFromConversation = useCreateContactFromConversation();

  useEffect(() => {
    if (conversationId && conversation && conversation.unreadCount > 0) {
      markAsRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conversation?.unreadCount]);

  useEffect(() => {
    if (isLoading) return;
    if (isFirstLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      isFirstLoad.current = false;
    }
  }, [isLoading, messages.length]);

  const prevLengthRef = useRef(0);
  useEffect(() => {
    const prev = prevLengthRef.current;
    const curr = messages.length;
    if (curr > prev && !isFirstLoad.current) {
      const lastMsg = messages[curr - 1];
      const isNew =
        lastMsg && (lastMsg.direction === 'OUTBOUND' || Date.now() - new Date(lastMsg.createdAt).getTime() < 5000);
      if (isNew) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = curr;
  }, [messages]);

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
          return { ...old, pages: [...old.pages.slice(0, -1), { ...lastPage, data: [...lastPage.data, newMessage] }] };
        },
      );
      markAsRead.mutate(conversationId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, tenantId, queryClient, conversation?.sessionId],
  );

  const handleReaction = useCallback(
    (event: { messageId: string; conversationId: string; reactions: Record<string, string[]> }) => {
      if (event.conversationId !== conversationId) return;
      queryClient.setQueryData(
        conversationKeys.messages(tenantId, conversationId),
        (old: InfiniteData<CursorPaginatedResponse<Message>> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: page.data.map(msg => (msg.id === event.messageId ? { ...msg, reactions: event.reactions } : msg)),
            })),
          };
        },
      );
    },
    [conversationId, tenantId, queryClient],
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
          const alreadyExists = old.pages.some(p => p.data.some(m => m.id === newMessage.id));
          if (alreadyExists) return old;
          return { ...old, pages: [...old.pages.slice(0, -1), { ...lastPage, data: [...lastPage.data, newMessage] }] };
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

  useEffect(() => {
    subscribe('message:reaction', handleReaction);
    return () => unsubscribe('message:reaction', handleReaction);
  }, [subscribe, unsubscribe, handleReaction]);

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
                if (msg.id === event.messageId) console.log('[ACK] found message, updating to:', event.status);
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

  const handleSend = useCallback(
    (payload: {
      text?: string;
      mediaUrl?: string;
      mediaType?: string;
      caption?: string;
      type: string;
      conversationId?: string;
    }) => {
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

  const handleLoadOlder = useCallback(async () => {
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    await fetchOlderMessages();
    requestAnimationFrame(() => {
      if (el) el.scrollTop += el.scrollHeight - prevScrollHeight;
    });
  }, [fetchOlderMessages]);

  const handleSaveConfirm = useCallback(
    async (name: string) => {
      setIsSavingName(true);
      try {
        let contactId: string;
        try {
          const contact = await createFromConversation.mutateAsync(conversationId);
          contactId = contact.id;
        } catch (err: unknown) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr?.response?.status === 409 && conversation?.contactId) {
            contactId = conversation.contactId;
          } else {
            throw err;
          }
        }
        await contactsApi.update(tenantId, contactId, { name });
        queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] });
        setSaveModalOpen(false);
        setSavedContact(true);
        setSavedContactConvId(conversationId);
        queryClient.invalidateQueries({ queryKey: conversationKeys.detail(tenantId, conversationId) });
        queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
      } catch {
        // leave modal open
      } finally {
        setIsSavingName(false);
      }
    },
    [conversationId, conversation, createFromConversation, queryClient, tenantId],
  );

  const displayName = conversation?.contact?.name ?? conversation?.contactName ?? conversation?.phoneNumber;
  const hasContact = !!conversation?.contactId || isSavedForCurrentConv;
  const contactId = conversation?.contactId ?? null;

  const phoneDisplay = conversation?.phoneNumber
    ? conversation.phoneNumber.includes('@')
      ? conversation.phoneNumber.split('@')[0]
      : conversation.phoneNumber
    : '';

  const avatarInitial = displayName?.charAt(0)?.toUpperCase() ?? '?';
  const avatarColor = getAvatarColor(avatarInitial);

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))]">
      <SaveContactModal
        key={saveModalOpen ? conversationId : 'closed'}
        open={saveModalOpen}
        phoneDisplay={phoneDisplay}
        onSave={handleSaveConfirm}
        onClose={() => setSaveModalOpen(false)}
        isPending={isSavingName}
      />

      {contactId && (
        <EditContactModal
          open={editModalOpen}
          contactId={contactId}
          onClose={() => {
            setEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: conversationKeys.detail(tenantId, conversationId) });
            queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
          }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] shrink-0 shadow-[var(--shadow-sm)]">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        {/* Avatar — same color as ConversationItem */}
        <div
          className={`h-9 w-9 rounded-full ${avatarColor.bg} ${avatarColor.text} ring-2 ${avatarColor.ring} ring-offset-1 ring-offset-[hsl(var(--card))] flex items-center justify-center text-[13px] font-[700] uppercase shrink-0`}
        >
          {avatarInitial !== '?' ? avatarInitial : '?'}
        </div>

        {/* Name + session */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-[600] text-[hsl(var(--foreground))] truncate leading-tight">
            {displayName ?? 'Loading…'}
          </p>
          {conversation?.session && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate leading-tight mt-0.5">
              via {conversation.session.name}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {hasContact && contactId && (
            <button
              onClick={() => setEditModalOpen(true)}
              title="Edit contact"
              className="p-2 rounded-[var(--radius-sm)] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--green))] transition-colors"
            >
              <Pencil size={15} />
            </button>
          )}

          {!hasContact && (
            <button
              onClick={() => setSaveModalOpen(true)}
              disabled={createFromConversation.isPending || isSavingName}
              title="Save as contact"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-[600] bg-[hsl(var(--green-subtle))] text-[hsl(var(--green))] hover:bg-[hsl(var(--green))]/20 transition-colors disabled:opacity-50"
            >
              {createFromConversation.isPending || isSavingName ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserPlus size={13} />
              )}
              Save
            </button>
          )}

          {hasContact && isSavedForCurrentConv && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[hsl(var(--green-subtle))] text-[hsl(var(--green))]">
              <Check size={13} />
              <span className="text-[11px] font-[600]">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {hasOlderMessages && (
          <div className="flex justify-center pb-3">
            <button
              onClick={handleLoadOlder}
              disabled={isFetchingOlderMessages}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[11px] font-[500] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--green))] hover:border-[hsl(var(--green))]/40 hover:bg-[hsl(var(--green-subtle))] transition-colors shadow-[var(--shadow-sm)] disabled:opacity-50"
            >
              {isFetchingOlderMessages ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ChevronUp size={11} />
                  Load earlier messages
                </>
              )}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--green-subtle))] flex items-center justify-center">
              <MessageSquare size={22} className="text-[hsl(var(--green))]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[13px] font-[600] text-[hsl(var(--foreground))]">No messages yet</p>
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                Send a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg: Message) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              sessionJid={
                conversation?.session?.phoneNumber ? `${conversation.session.phoneNumber}@s.whatsapp.net` : undefined
              }
            />
          ))
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
