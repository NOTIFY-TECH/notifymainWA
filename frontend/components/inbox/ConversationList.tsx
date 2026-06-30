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
  { label: 'All',      value: undefined,    activeBg: 'bg-[hsl(var(--green))]',   activeText: 'text-white' },
  { label: 'Open',     value: 'OPEN',       activeBg: 'bg-emerald-500',            activeText: 'text-white' },
  { label: 'Assigned', value: 'ASSIGNED',   activeBg: 'bg-blue-500',               activeText: 'text-white' },
  { label: 'Resolved', value: 'RESOLVED',   activeBg: 'bg-violet-500',             activeText: 'text-white' },
  { label: 'Archived', value: 'ARCHIVED',   activeBg: 'bg-slate-400',              activeText: 'text-white' },
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
      // ignore
    }
  }, [sessionId, tenantId]);

  const { data: connectedSessions = [] } = useConnectedSessions();

  const { data: conversations, isLoading } = useConversations({
    status,
    sessionId,
    search: search || undefined,
  });

  const handleIncoming = useCallback(
    (event: { conversationId: string }) => {
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

  const handleSyncing = useCallback(() => { setIsSyncing(true); }, []);

  const handleSyncComplete = useCallback(() => {
    setIsSyncing(false);
    queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
  }, [tenantId, queryClient]);

  const handleSessionStatus = useCallback((event: { sessionId: string; status: string }) => {
    if (event.status === 'DISCONNECTED') setIsSyncing(false);
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
    <div className="flex flex-col h-full bg-[hsl(var(--card))]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[hsl(var(--green-subtle))] flex items-center justify-center">
            <MessageSquare size={14} className="text-[hsl(var(--green))]" />
          </div>
          <h2 className="text-[15px] font-[600] text-[hsl(var(--foreground))] tracking-tight">Inbox</h2>
        </div>
        {!isArchivedView && (
          <button
            onClick={() => setNewConvOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-[600] transition-colors bg-[hsl(var(--green))] text-white hover:bg-[hsl(142_71%_30%)] shadow-sm"
            aria-label="New conversation"
          >
            <SquarePen size={12} />
            New
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[hsl(var(--border))] shrink-0 space-y-2">

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-7 pr-3 py-1.5 rounded-[var(--radius-sm)] bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]/20 transition-colors"
          />
        </div>

        {/* Status tabs — each with its own color */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {STATUS_TABS.map(tab => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.label}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[11px] font-[600] transition-colors whitespace-nowrap shrink-0',
                  isActive
                    ? `${tab.activeBg} ${tab.activeText} shadow-sm`
                    : 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Session selector — blue-tinted, intentional style */}
        {!isArchivedView && (
          <div className="relative" ref={sessionMenuRef}>
            <button
              onClick={() => setSessionMenuOpen(o => !o)}
              className={cn(
                'flex items-center gap-2 w-full pl-2.5 pr-2 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-[500] transition-all border',
                sessionMenuOpen
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : sessionId
                    ? 'border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-50'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--border))]',
              )}
            >
              <div className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md shrink-0',
                sessionId || sessionMenuOpen ? 'bg-blue-100' : 'bg-[hsl(var(--border))]',
              )}>
                <Smartphone size={11} className={sessionId || sessionMenuOpen ? 'text-blue-500' : 'text-[hsl(var(--muted-foreground))]'} />
              </div>
              <span className="truncate flex-1 text-left">{selectedSessionLabel}</span>
              <ChevronDown
                size={11}
                className={cn(
                  'shrink-0 transition-transform',
                  sessionMenuOpen ? 'rotate-180 text-blue-500' : '',
                )}
              />
            </button>

            {sessionMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-md)] py-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setSessionId(undefined); setSessionMenuOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <span className="text-[hsl(var(--foreground))]">All sessions</span>
                  {sessionId === undefined && <Check size={12} className="text-[hsl(var(--green))]" />}
                </button>
                {connectedSessions.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))]">No connected sessions</p>
                ) : (
                  connectedSessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSessionId(s.id); setSessionMenuOpen(false); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-[hsl(var(--muted))] transition-colors"
                    >
                      <span className="text-[hsl(var(--foreground))] truncate">{sessionLabel(s)}</span>
                      {sessionId === s.id && <Check size={12} className="text-[hsl(var(--green))] shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sync banner ── */}
      {isSyncing && !isArchivedView && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--green) / 0.08)] border-b border-[hsl(var(--green) / 0.2)] shrink-0">
          <RefreshCw size={11} className="animate-spin text-[hsl(var(--green))] shrink-0" />
          <span className="text-[11px] font-[500] text-[hsl(var(--green))]">Syncing WhatsApp chats…</span>
        </div>
      )}

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : !conversations?.length ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--green-subtle))] flex items-center justify-center">
              <MessageSquare size={20} className="text-[hsl(var(--green))]" />
            </div>
            <div className="space-y-1">
              <p className="text-[13px] font-[500] text-[hsl(var(--foreground))]">
                {isArchivedView ? 'No archived conversations' : 'No conversations yet'}
              </p>
              <p className="text-[12px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                {isArchivedView
                  ? 'Conversations you archive will appear here'
                  : 'Messages from WhatsApp will appear here'}
              </p>
            </div>
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