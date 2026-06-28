'use client';

import { Message } from '@/types/message';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download } from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { messagesApi } from '@/services/messages-api';
import { useAuthStore } from '@/store/authStore';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageBubbleProps {
  message: Message;
  sessionJid?: string;
}

function StatusIcon({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'PENDING':
      return <Clock size={11} className="text-white/50" />;
    case 'SENT':
      return <Check size={11} className="text-white/60" />;
    case 'DELIVERED':
      return <CheckCheck size={11} className="text-white/80" />;
    case 'READ':
      return <CheckCheck size={11} className="text-blue-400" />;
    case 'FAILED':
      return <AlertCircle size={11} className="text-red-400" />;
    default:
      return null;
  }
}

function MediaContent({ message, isOutbound }: { message: Message; isOutbound: boolean }) {
  if (!message.mediaUrl) return null;
  const textColor = isOutbound ? 'text-white/80' : 'text-[hsl(var(--muted-foreground))]';
  const bgColor = isOutbound ? 'bg-white/10' : 'bg-[hsl(var(--background))]';

  if (message.type === 'IMAGE')
    return (
      <div className="mb-1.5">
        <div className="relative rounded-lg overflow-hidden max-w-[260px]">
          <Image
            src={message.mediaUrl}
            alt={message.caption ?? 'Image'}
            width={260}
            height={200}
            className="object-cover w-full h-auto rounded-lg"
            unoptimized
          />
        </div>
        {message.caption && <p className={cn('text-xs mt-1', textColor)}>{message.caption}</p>}
      </div>
    );

  if (message.type === 'VIDEO')
    return (
      <div className="mb-1.5">
        <div className="relative rounded-lg overflow-hidden max-w-[260px] bg-black">
          <video src={message.mediaUrl} controls className="w-full rounded-lg max-h-[200px]" preload="metadata" />
        </div>
        {message.caption && <p className={cn('text-xs mt-1', textColor)}>{message.caption}</p>}
      </div>
    );

  if (message.type === 'DOCUMENT') {
    const filename = message.mediaUrl.split('/').pop() ?? 'document.pdf';
    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-1.5 transition-opacity hover:opacity-80',
          bgColor,
        )}
      >
        <FileText size={20} className={isOutbound ? 'text-white' : 'text-[hsl(var(--green))]'} />
        <div className="flex-1 min-w-0">
          <p
            className={cn('text-xs font-medium truncate', isOutbound ? 'text-white' : 'text-[hsl(var(--foreground))]')}
          >
            {message.caption ?? filename}
          </p>
          <p className={cn('text-[10px]', textColor)}>PDF Document</p>
        </div>
        <Download size={14} className={isOutbound ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]'} />
      </a>
    );
  }

  if (message.type === 'AUDIO')
    return (
      <div className="mb-1.5">
        <audio controls src={message.mediaUrl} className="w-full max-w-60 h-9" preload="metadata" />
      </div>
    );

  return (
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('flex items-center gap-2 text-xs underline mb-1.5', textColor)}
    >
      <Download size={12} /> Download attachment
    </a>
  );
}

function ReactionBar({
  reactions,
  sessionJid,
  onReact,
}: {
  reactions: Record<string, string[]>;
  sessionJid?: string;
  onReact: (emoji: string) => void;
}) {
  const entries = Object.entries(reactions).filter(([, senders]) => senders.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, senders]) => {
        const isMine = sessionJid ? senders.includes(sessionJid) : false;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(isMine ? '' : emoji)}
            title={isMine ? 'Remove reaction' : `React with ${emoji}`}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors border',
              isMine
                ? 'bg-[hsl(var(--green))]/15 border-[hsl(var(--green))]/40 text-[hsl(var(--green))]'
                : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80',
            )}
          >
            <span>{emoji}</span>
            {senders.length > 1 && <span className="font-medium">{senders.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function MessageBubble({ message, sessionJid }: MessageBubbleProps) {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';
  const isOutbound = message.direction === 'OUTBOUND';
  const hasMedia = !!message.mediaUrl;
  const hasText = !!message.body;

  const [showPicker, setShowPicker] = useState(false);

  // Optimistic reactions — persisted until the API call fails OR until the
  // cache (message.reactions) catches up with a matching value. We never
  // clear on success so the reaction is visible even before the WS event
  // arrives (or if the engine reaction route isn't implemented yet).
  const [optimisticReactions, setOptimisticReactions] = useState<{
    forMessageId: string;
    reactions: Record<string, string[]>;
  } | null>(null);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide which reactions to display:
  // 1. If we have an optimistic override for this message, use it.
  // 2. Otherwise fall back to whatever the TanStack cache has (message.reactions).
  // This means reactions stay visible immediately after clicking, and
  // seamlessly hand off to the cache once the WS event patches it in.
  const cacheReactions = (message.reactions as Record<string, string[]>) ?? {};
  const reactions: Record<string, string[]> =
    optimisticReactions?.forMessageId === message.id ? optimisticReactions.reactions : cacheReactions;

  const myCurrentReaction = sessionJid
    ? (Object.entries(reactions).find(([, senders]) => senders.includes(sessionJid))?.[0] ?? null)
    : null;

  const handleReact = async (emoji: string) => {
    if (!sessionJid || !message.externalId) return;
    setShowPicker(false);

    // Build the new reactions map optimistically
    const base = cacheReactions;
    const cleaned: Record<string, string[]> = {};
    for (const [e, senders] of Object.entries(base)) {
      const filtered = senders.filter(j => j !== sessionJid);
      if (filtered.length > 0) cleaned[e] = filtered;
    }
    if (emoji) cleaned[emoji] = [...(cleaned[emoji] ?? []), sessionJid];

    // Show immediately — do NOT clear this on success.
    // It stays until either:
    //   a) The WS message:reaction event arrives and ThreadView patches
    //      message.reactions in the cache — at that point this component
    //      re-renders with the real data and optimisticReactions is stale
    //      (forMessageId still matches but the cache has the same value now,
    //      so switching to cacheReactions on the next click is fine).
    //   b) The API call fails — we revert to cacheReactions by clearing.
    setOptimisticReactions({ forMessageId: message.id, reactions: cleaned });

    try {
      await messagesApi.reactToMessage(tenantId, message.id, emoji);
      // Success: leave optimisticReactions in place. The WS event will
      // arrive shortly and patch message.reactions to the same value.
      // The next user interaction will naturally use the cache value.
    } catch {
      // Failure: revert — show what the cache has
      setOptimisticReactions(null);
    }
  };

  const handleMouseEnter = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => setShowPicker(true), 300);
  };

  const handleMouseLeave = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setShowPicker(false);
  };

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className="flex flex-col max-w-[72%]">
        {/* Hover zone: paddingTop creates an invisible bridge so the mouse
            can travel from bubble → picker without leaving the zone */}
        <div
          className="relative"
          style={{ paddingTop: message.externalId && sessionJid ? '2.5rem' : 0 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Emoji picker — sits inside the padding area */}
          {showPicker && message.externalId && sessionJid && (
            <div
              className={cn(
                'absolute top-0 flex items-center gap-0.5 rounded-full px-2 py-1',
                'shadow-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] z-10',
                isOutbound ? 'right-0' : 'left-0',
              )}
            >
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(myCurrentReaction === emoji ? '' : emoji)}
                  title={myCurrentReaction === emoji ? 'Remove reaction' : emoji}
                  className={cn(
                    'text-base leading-none p-0.5 rounded-full transition-transform hover:scale-125',
                    myCurrentReaction === emoji && 'opacity-50',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Bubble */}
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2.5 text-sm break-words',
              isOutbound
                ? 'bg-[hsl(var(--green))] text-white rounded-br-sm'
                : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-bl-sm',
            )}
          >
            {hasMedia && <MediaContent message={message} isOutbound={isOutbound} />}
            {hasText && <p className="leading-relaxed whitespace-pre-wrap">{message.body}</p>}
            {!hasMedia && !hasText && (
              <p className={cn('text-xs italic', isOutbound ? 'text-white/50' : 'text-[hsl(var(--muted-foreground))]')}>
                [Media message]
              </p>
            )}
            <div className={cn('flex items-center gap-1 mt-1', isOutbound ? 'justify-end' : 'justify-start')}>
              <span className={cn('text-[10px]', isOutbound ? 'text-white/60' : 'text-[hsl(var(--muted-foreground))]')}>
                {format(new Date(message.createdAt), 'HH:mm')}
              </span>
              {isOutbound && <StatusIcon status={message.status} />}
            </div>
          </div>
        </div>

        {/* Reaction bar — always visible when there are reactions */}
        <div className={cn('px-1', isOutbound ? 'self-end' : 'self-start')}>
          <ReactionBar reactions={reactions} sessionJid={sessionJid} onReact={handleReact} />
        </div>
      </div>
    </div>
  );
}
