'use client';

import { ContactDetail } from '@/services/contacts-api';
import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ContactConversationHistoryProps {
  contact: ContactDetail;
}

// Renders the contact's conversation history — pulled directly from
// ContactDetail.conversations (already returned, ordered by lastMessageAt
// desc, by ContactsService.getContact). This file previously contained a
// verbatim duplicate of ContactHeader.tsx (wrong content saved under this
// filename), which is why a second inert "Edit" card was showing up below
// Tags — that bug is fixed by this being correct content, not by anything
// special in the logic below.

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-[#22C55E]/10 text-[hsl(var(--green))] border-[#22C55E]/20',
  ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  RESOLVED: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  SNOOZED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function ContactConversationHistory({ contact }: ContactConversationHistoryProps) {
  const router = useRouter();
  const conversations = contact.conversations ?? [];

  return (
    <div className="px-6 py-4 border-t border-[hsl(var(--border))]">
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
        Conversation history{conversations.length > 0 ? ` (${conversations.length})` : ''}
      </p>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare className="w-8 h-8 text-[hsl(var(--muted-foreground))] mb-2 opacity-50" />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No conversations yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => router.push(`/dashboard/inbox/${conv.id}`)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] hover:border-[#22C55E]/30 hover:bg-[#22C55E]/5 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      STATUS_STYLES[conv.status] ?? STATUS_STYLES.RESOLVED
                    }`}
                  >
                    {conv.status}
                  </span>
                  {conv.session?.name && (
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                      via {conv.session.name}
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-[hsl(var(--green))] text-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--foreground))] truncate">
                  {conv.lastMessageText || 'No messages yet'}
                </p>
              </div>
              <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">
                {formatRelativeTime(conv.lastMessageAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
