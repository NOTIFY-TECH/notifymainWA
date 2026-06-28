'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConversations, conversationKeys, sortConversations } from '@/hooks/useConversations';
import { useConnectedSessions } from '@/hooks/useSessions';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import ConversationItem from './ConversationItem';
import NewConversationModal from './NewConversationModal';
import { Search, Loader2, MessageSquare, RefreshCw, SquarePen, ChevronDown, Check, Smartphone } from 'lucide-react';
import { Conversation } from '@/types/message';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'OPEN' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Archived', value: 'ARCHIVED' },
] as const;

const sessionFilterKey = (tenantId: string) => `notifytechai:inbox:sessionFilter:${tenantId}`;

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const tid = useAuthStore.getState().tenant?.id;
      if (!tid) return undefined;
      return window.localStorage.getItem(sessionFilterKey(tid)) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!tenantId) return;
    try {
      if (sessionId) {
        window.localStorage.setItem(sessionFilterKey(tenantId), sessionId);
      } else {
        window.localStorage.removeItem(sessionFilterKey(tenantId));
      }
    } catch {
      // ignore — non-critical persistence
    }
  }, [sessionId, tenantId]);

  const { data: connectedSessions = [] } = useConnectedSessions();

  const { data: conversations, isLoading } = useConversations({
    status,
    sessionId,
    search: search || undefined,
  });

  // ── WebSocket: bump unread + move to top on new inbound message ──────────
  // Only applies to non-archived views — archived conversations stay put.
  const handleIncoming = useCallback(
    (event: { conversationId: string }) => {
      // Don't bump the list when viewing archived conversations
      if (status === 'ARCHIVED') return;
      queryClient.setQueriesData<{ data: Conversation[] }>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old?.data || !Array.isArray(old.data)) return old;
        const idx = old.data.findIndex(c => c.id === event.conversationId);
        if (idx === -1) {
          queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
          return old;
        }
        const isActive = event.conversationId === activeId;
        const updated = {
          ...old.data[idx],
          unreadCount: isActive ? old.data[idx].unreadCount : (old.data[idx].unreadCount ?? 0) + 1,
          lastMessageAt: new Date().toISOString(),
        };
        const rest = old.data.filter((_, i) => i !== idx);
        return { ...old, data: sortConversations([updated, ...rest]) };
      });
    },
    [activeId, tenantId, queryClient, status],
  );

  const handleSyncing = useCallback(() => {
    setIsSyncing(true);
  }, []);

  const handleSyncComplete = useCallback(() => {
    setIsSyncing(false);
    queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
  }, [tenantId, queryClient]);

  const handleSessionStatus = useCallback((event: { sessionId: string; status: string }) => {
    if (event.status === 'DISCONNECTED') {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    subscribe('message:received', handleIncoming);
    subscribe('session:syncing', handleSyncing);
    subscribe('session:sync_complete', handleSyncComplete);
    subscribe('session:status', handleSessionStatus);
    return () => {
      unsubscribe('message:received', handleIncoming);
      unsubscribe('session:syncing', handleSyncing);
      unsubscribe('session:sync_complete', handleSyncComplete);
      unsubscribe('session:status', handleSessionStatus);
    };
  }, [subscribe, unsubscribe, handleIncoming, handleSyncing, handleSyncComplete, handleSessionStatus]);

  useEffect(() => {
    if (!sessionMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setSessionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sessionMenuOpen]);

  const sessionLabel = (s: { name: string; phoneNumber?: string | null }) =>
    s.phoneNumber ? `${s.name} · ${s.phoneNumber}` : s.name;

  const selectedSessionLabel = sessionId
    ? sessionLabel(connectedSessions.find(s => s.id === sessionId) ?? { name: 'Unknown session' })
    : 'All sessions';

  const isArchivedView = status === 'ARCHIVED';

  return (
    <div className="flex flex-col h-full border-r border-[hsl(var(--border))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[hsl(var(--border))] shrink-0">
        <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Inbox</h2>
        {!isArchivedView && (
          <button
            onClick={() => setNewConvOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] hover:bg-[hsl(var(--green))]/20"
            aria-label="New conversation"
          >
            <SquarePen size={13} />
            New
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 pt-3 pb-2 border-b border-[hsl(var(--border))] shrink-0">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-3 py-2 rounded-[var(--radius)] bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--green))] transition-colors"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.label}
              onClick={() => setStatus(tab.value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                status === tab.value
                  ? 'bg-[hsl(var(--green))] text-white'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Session selector — hidden in archived view (less relevant there) */}
        {!isArchivedView && (
          <div className="relative" ref={sessionMenuRef}>
            <button
              onClick={() => setSessionMenuOpen(o => !o)}
              className={cn(
                'flex items-center gap-1.5 w-full pl-2.5 pr-2 py-1.5 rounded-md text-xs font-medium transition-colors border',
                sessionMenuOpen
                  ? 'border-[hsl(var(--green))]/40 bg-[hsl(var(--muted))]'
                  : 'border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--muted))]',
              )}
            >
              <Smartphone
                size={12}
                className={cn(
                  'shrink-0',
                  sessionId ? 'text-[hsl(var(--green))]' : 'text-[hsl(var(--muted-foreground))]',
                )}
              />
              <span
                className={cn(
                  'truncate flex-1 text-left',
                  sessionId ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
                )}
              >
                {selectedSessionLabel}
              </span>
              <ChevronDown size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            </button>

            {sessionMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg shadow-black/20 py-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setSessionId(undefined);
                    setSessionMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <span className="text-[hsl(var(--foreground))]">All sessions</span>
                  {sessionId === undefined && <Check size={13} className="text-[hsl(var(--green))]" />}
                </button>
                {connectedSessions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">No connected sessions</p>
                ) : (
                  connectedSessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSessionId(s.id);
                        setSessionMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))] transition-colors"
                    >
                      <span className="text-[hsl(var(--foreground))] truncate">{sessionLabel(s)}</span>
                      {sessionId === s.id && <Check size={13} className="text-[hsl(var(--green))] shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp sync banner — only shown in non-archived views */}
      {isSyncing && !isArchivedView && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--green)/0.08)] border-b border-[hsl(var(--green)/0.2)]">
          <RefreshCw size={12} className="animate-spin text-[hsl(var(--green))] shrink-0" />
          <span className="text-xs text-[hsl(var(--green))]">Syncing WhatsApp chats…</span>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : !conversations?.length ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare size={28} className="text-[hsl(var(--muted-foreground))] mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {isArchivedView ? 'No archived conversations' : 'No conversations yet'}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {isArchivedView
                ? 'Conversations you archive will appear here'
                : 'Messages from WhatsApp will appear here'}
            </p>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>

      <NewConversationModal open={newConvOpen} onClose={() => setNewConvOpen(false)} />
    </div>
  );
}
