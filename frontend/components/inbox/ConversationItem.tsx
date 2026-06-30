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

// ── Avatar color palette — mirrors dashboard icon chip tints ─────────────────
// Each letter maps to one of 6 tinted color slots (bg + text).
const AVATAR_COLORS = [
  { bg: 'bg-blue-50',    ring: 'ring-blue-200',    text: 'text-blue-600',    activeBg: 'bg-blue-100'    },
  { bg: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-600',  activeBg: 'bg-violet-100'  },
  { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-600',   activeBg: 'bg-amber-100'   },
  { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-600', activeBg: 'bg-emerald-100' },
  { bg: 'bg-rose-50',    ring: 'ring-rose-200',    text: 'text-rose-600',    activeBg: 'bg-rose-100'    },
  { bg: 'bg-cyan-50',    ring: 'ring-cyan-200',    text: 'text-cyan-600',    activeBg: 'bg-cyan-100'    },
];

export function getAvatarColor(char: string) {
  const code = (char ?? 'A').toUpperCase().charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

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
    isPinned ? unpin(conversation.id) : pin(conversation.id);
  };

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArchiving || isUnarchiving) return;
    isArchived ? unarchive(conversation.id) : archive(conversation.id);
  };

  const initials = displayName?.charAt(0)?.toUpperCase() ?? '?';
  const color = getAvatarColor(initials);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={cn(
        'group w-full text-left px-3 py-2.5 flex items-start gap-3 cursor-pointer select-none',
        'border-b border-[hsl(var(--border))]',
        'transition-colors duration-100',
        isActive
          ? 'bg-[hsl(var(--green-subtle))] border-l-[3px] border-l-[hsl(var(--green))] pl-[9px]'
          : 'hover:bg-[hsl(var(--muted))] border-l-[3px] border-l-transparent',
      )}
    >
      {/* ── Avatar ── */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-[700] uppercase transition-all mt-0.5',
          isActive
            ? `${color.activeBg} ${color.text} ring-2 ${color.ring} ring-offset-1 ring-offset-[hsl(var(--green-subtle))]`
            : `${color.bg} ${color.text} group-hover:ring-2 group-hover:${color.ring}`,
        )}
      >
        {initials !== '?' ? initials : <MessageSquare size={14} />}
      </div>

      {/* ── Content ── */}
      <div className="min-w-0 flex-1">
        {/* Name + meta */}
        <div className="flex items-center justify-between gap-1.5 mb-0.5">
          <p
            className={cn(
              'text-[13px] truncate flex-1',
              unread > 0 ? 'font-[600] text-[hsl(var(--foreground))]' : 'font-[500] text-[hsl(var(--foreground))]',
            )}
          >
            {displayName}
          </p>

          <div className="flex items-center gap-1 shrink-0">
            {lastTime && (
              <span className={cn(
                'text-[10px]',
                unread > 0 ? 'text-[hsl(var(--green))] font-[600]' : 'text-[hsl(var(--muted-foreground))]',
              )}>
                {formatDistanceToNow(new Date(lastTime), { addSuffix: false })}
              </span>
            )}

            {unread > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[hsl(var(--green))] px-1 text-[10px] font-[700] text-white shadow-sm">
                {unread > 99 ? '99+' : unread}
              </span>
            )}

            {/* Archive toggle */}
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={isArchiving || isUnarchiving}
              title={isArchived ? 'Unarchive conversation' : 'Archive conversation'}
              className={cn(
                'rounded-md p-1 transition-colors',
                isArchived
                  ? 'text-[hsl(var(--muted-foreground))] opacity-100'
                  : 'text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100',
                'hover:bg-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]',
                (isArchiving || isUnarchiving) && 'cursor-not-allowed opacity-50',
              )}
            >
              {isArchived ? <ArchiveX size={13} /> : <Archive size={13} />}
            </button>

            {/* Pin toggle */}
            {!isArchived && (
              <button
                type="button"
                onClick={handlePinToggle}
                disabled={isPinning || isUnpinning}
                title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                className={cn(
                  'rounded-md p-1 transition-colors',
                  isPinned
                    ? 'text-violet-500 opacity-100'
                    : 'text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100',
                  'hover:bg-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]',
                  (isPinning || isUnpinning) && 'cursor-not-allowed opacity-50',
                )}
              >
                {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Last message */}
        <p className={cn(
          'text-[12px] truncate leading-snug',
          unread > 0 ? 'text-[hsl(var(--foreground))] font-[500]' : 'text-[hsl(var(--muted-foreground))]',
        )}>
          {lastText}
        </p>

        {/* Pinned chip */}
        {isPinned && !isArchived && (
          <div className="flex items-center gap-1 mt-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-100">
              <Pin size={8} className="text-violet-500" />
              <span className="text-[9px] font-[600] text-violet-500 uppercase tracking-wide">Pinned</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}