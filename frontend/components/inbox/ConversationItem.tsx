'use client';

import { Conversation } from '@/types/message';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { MessageSquare, Pin, PinOff, Archive, ArchiveX } from 'lucide-react';
import {
  usePinConversation,
  useUnpinConversation,
  useArchiveConversation,
  useUnarchiveConversation,
} from '@/hooks/useConversations';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const displayName = conversation.contactName?.trim() || conversation.phoneNumber;

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
  const isPinned = conversation.isPinned ?? false;
  const isArchived = conversation.isArchived ?? false;

  const { mutate: pin, isPending: isPinning } = usePinConversation();
  const { mutate: unpin, isPending: isUnpinning } = useUnpinConversation();
  const { mutate: archive, isPending: isArchiving } = useArchiveConversation();
  const { mutate: unarchive, isPending: isUnarchiving } = useUnarchiveConversation();

  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinning || isUnpinning) return;
    if (isPinned) {
      unpin(conversation.id);
    } else {
      pin(conversation.id);
    }
  };

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArchiving || isUnarchiving) return;
    if (isArchived) {
      unarchive(conversation.id);
    } else {
      archive(conversation.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={cn(
        'group w-full text-left px-4 py-3 flex items-start gap-3 cursor-pointer',
        'border-b border-[hsl(var(--border))]',
        'transition-colors duration-100',
        isActive ? 'bg-[hsl(var(--green))]/8 border-l-2 border-l-[hsl(var(--green))]' : 'hover:bg-[hsl(var(--muted))]',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase',
          isActive
            ? 'bg-[hsl(var(--green))]/20 text-[hsl(var(--green))]'
            : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
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

          {/* Right side: time + unread badge + action buttons */}
          <div className="flex items-center gap-1 shrink-0">
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

            {/* Archive toggle — shown on hover; always visible when archived */}
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={isArchiving || isUnarchiving}
              title={isArchived ? 'Unarchive conversation' : 'Archive conversation'}
              className={cn(
                'rounded p-1 transition-colors',
                isArchived
                  ? 'text-[hsl(var(--muted-foreground))] opacity-100'
                  : 'text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100',
                'hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                (isArchiving || isUnarchiving) && 'cursor-not-allowed opacity-50',
              )}
            >
              {isArchived ? <ArchiveX size={14} /> : <Archive size={14} />}
            </button>

            {/* Pin toggle — always visible when pinned, shown on hover otherwise */}
            {/* Hidden when conversation is archived (archiving already unpins) */}
            {!isArchived && (
              <button
                type="button"
                onClick={handlePinToggle}
                disabled={isPinning || isUnpinning}
                title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                className={cn(
                  'rounded p-1 transition-colors',
                  isPinned
                    ? 'text-[hsl(var(--green))] opacity-100'
                    : 'text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100',
                  'hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                  (isPinning || isUnpinning) && 'cursor-not-allowed opacity-50',
                )}
              >
                {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
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
    </div>
  );
}
