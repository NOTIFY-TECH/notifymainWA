'use client';

import { Message } from '@/types/message';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download, Play, Pause, Mic } from 'lucide-react';
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
      return <CheckCheck size={11} className="text-blue-300" />;
    case 'FAILED':
      return <AlertCircle size={11} className="text-red-300" />;
    default:
      return null;
  }
}

function AudioPlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play();
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const trackColor = isOutbound ? 'bg-white/25' : 'bg-[hsl(var(--border))]';
  const fillColor = isOutbound ? 'bg-white' : 'bg-[hsl(var(--green))]';
  const iconBg = isOutbound ? 'bg-white/20' : 'bg-[hsl(var(--green-subtle))]';
  const iconColor = isOutbound ? 'text-white' : 'text-[hsl(var(--green))]';
  const timeColor = isOutbound ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]';

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105',
          iconBg,
        )}
      >
        {isPlaying ? (
          <Pause size={15} className={iconColor} fill="currentColor" />
        ) : (
          <Play size={15} className={cn(iconColor, 'ml-0.5')} fill="currentColor" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={cn('relative h-1.5 w-full rounded-full cursor-pointer', trackColor)}
          onClick={e => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            el.currentTime = ratio * duration;
          }}
        >
          <div
            className={cn('absolute left-0 top-0 h-full rounded-full', fillColor)}
            style={{ width: `${progressPct}%` }}
          />
          <div
            className={cn(
              'absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full shadow-sm',
              fillColor,
            )}
            style={{ left: `${progressPct}%` }}
          />
        </div>
        <div className={cn('flex items-center gap-1 mt-1 text-[10px]', timeColor)}>
          <Mic size={9} />
          <span>{formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}</span>
        </div>
      </div>
    </div>
  );
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
      <div className="mb-1">
        <AudioPlayer src={message.mediaUrl} isOutbound={isOutbound} />
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

  const [optimisticReactions, setOptimisticReactions] = useState<{
    forMessageId: string;
    reactions: Record<string, string[]>;
  } | null>(null);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheReactions = (message.reactions as Record<string, string[]>) ?? {};
  const reactions: Record<string, string[]> =
    optimisticReactions?.forMessageId === message.id ? optimisticReactions.reactions : cacheReactions;

  const myCurrentReaction = sessionJid
    ? (Object.entries(reactions).find(([, senders]) => senders.includes(sessionJid))?.[0] ?? null)
    : null;

  const handleReact = async (emoji: string) => {
    if (!sessionJid || !message.externalId) return;
    setShowPicker(false);

    const base = cacheReactions;
    const cleaned: Record<string, string[]> = {};
    for (const [e, senders] of Object.entries(base)) {
      const filtered = senders.filter(j => j !== sessionJid);
      if (filtered.length > 0) cleaned[e] = filtered;
    }
    if (emoji) cleaned[emoji] = [...(cleaned[emoji] ?? []), sessionJid];

    setOptimisticReactions({ forMessageId: message.id, reactions: cleaned });

    try {
      await messagesApi.reactToMessage(tenantId, message.id, emoji);
    } catch {
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
        <div
          className="relative"
          style={{ paddingTop: message.externalId && sessionJid ? '2.5rem' : 0 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Emoji picker */}
          {showPicker && message.externalId && sessionJid && (
            <div
              className={cn(
                'absolute top-0 flex items-center gap-0.5 rounded-full px-2 py-1',
                'shadow-[var(--shadow-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] z-10',
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
              'rounded-2xl px-3 py-2 text-[13px] break-words',
              isOutbound
                ? 'bg-[hsl(var(--green))] text-white rounded-br-sm shadow-[0_2px_8px_hsl(142_71%_35%/0.25)]'
                : 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] rounded-bl-sm border border-[hsl(var(--border))] shadow-[var(--shadow-sm)]',
            )}
          >
            {hasMedia && <MediaContent message={message} isOutbound={isOutbound} />}
            {hasText && <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{message.body}</p>}
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

        {/* Reaction bar */}
        <div className={cn('px-1', isOutbound ? 'self-end' : 'self-start')}>
          <ReactionBar reactions={reactions} sessionJid={sessionJid} onReact={handleReact} />
        </div>
      </div>
    </div>
  );
}
