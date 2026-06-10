'use client';

import { Conversation } from '@/types/message';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const displayName = conversation.contactName || conversation.contact?.name || conversation.phoneNumber;

  const lastMessage = conversation.lastMessage;
  const lastText = (() => {
    if (lastMessage?.type === 'IMAGE') return '📷 Photo';
    if (lastMessage?.type === 'VIDEO') return '🎥 Video';
    if (lastMessage?.type === 'AUDIO') return '🎵 Audio';
    if (lastMessage?.type === 'DOCUMENT') return '📄 Document';
    return lastMessage?.body ?? conversation.lastMessageText ?? 'No messages yet';
  })();
  const lastTime = conversation.lastMessageAt ?? conversation.updatedAt;
  const unread = conversation.unreadCount ?? 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3',
        'border-b border-[hsl(var(--border))]',
        'transition-colors duration-100',
        'hover:bg-[hsl(var(--muted))]',
        isActive && 'bg-[hsl(var(--muted))] border-l-2 border-l-[hsl(var(--green))]',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase',
          isActive ? 'bg-[hsl(var(--green))] text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
        )}
      >
        {displayName?.charAt(0) ?? <MessageSquare size={16} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className={cn(
              'text-sm truncate',
              unread > 0 ? 'font-semibold text-[hsl(var(--foreground))]' : 'font-medium text-[hsl(var(--foreground))]',
            )}
          >
            {displayName}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {lastTime && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {formatDistanceToNow(new Date(lastTime), { addSuffix: false })}
              </span>
            )}
            {unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--green))] px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
        <p
          className={cn(
            'text-xs truncate',
            unread > 0 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          {lastText}
        </p>
      </div>
    </button>
  );
}
