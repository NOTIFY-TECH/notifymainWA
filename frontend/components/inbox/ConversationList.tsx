'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConversations, conversationKeys } from '@/hooks/useConversations';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import ConversationItem from './ConversationItem';
import { Search, Loader2, MessageSquare } from 'lucide-react';
import { Conversation } from '@/types/message';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'OPEN' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Resolved', value: 'RESOLVED' },
] as const;

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { subscribe, unsubscribe } = useWebSocket();

  const { data: conversations, isLoading } = useConversations({
    status,
    search: search || undefined,
  });

  // WebSocket — bump unread + move to top when message arrives for another conversation
  const handleIncoming = useCallback(
    (event: { conversationId: string }) => {
      if (event.conversationId === activeId) return; // ThreadView handles this one

      queryClient.setQueriesData<{ data: Conversation[] }>({ queryKey: conversationKeys.all(tenantId) }, old => {
        if (!old?.data || !Array.isArray(old.data)) return old;
        const idx = old.data.findIndex(c => c.id === event.conversationId);
        if (idx === -1) {
          queryClient.invalidateQueries({ queryKey: conversationKeys.all(tenantId) });
          return old;
        }
        const updated = {
          ...old.data[idx],
          unreadCount: (old.data[idx].unreadCount ?? 0) + 1,
          lastMessageAt: new Date().toISOString(),
        };
        const rest = old.data.filter((_, i) => i !== idx);
        return { ...old, data: [updated, ...rest] };
      });
    },
    [activeId, tenantId, queryClient],
  );

  useEffect(() => {
    subscribe('message:received', handleIncoming);
    return () => unsubscribe('message:received', handleIncoming);
  }, [subscribe, unsubscribe, handleIncoming]);

  return (
    <div className="flex flex-col h-full border-r border-[hsl(var(--border))]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[hsl(var(--border))]">
        <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-3">Inbox</h2>

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
        <div className="flex gap-1">
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
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : !conversations?.length ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare size={28} className="text-[hsl(var(--muted-foreground))] mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No conversations yet</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Messages from WhatsApp will appear here</p>
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
    </div>
  );
}
