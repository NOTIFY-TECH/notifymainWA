'use client';

import { Message } from '@/types/message';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Play, Download } from 'lucide-react';
import Image from 'next/image';

interface MessageBubbleProps {
  message: Message;
}

// ─── Delivery Status Icon ─────────────────────────────────────────────────────

function StatusIcon({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'PENDING':
      return <Clock size={11} className="text-white/60" />;
    case 'SENT':
      return <Check size={11} className="text-white/60" />;
    case 'DELIVERED':
      return <CheckCheck size={11} className="text-white/60" />;
    case 'READ':
      return <CheckCheck size={11} className="text-[hsl(var(--green))]" />;
    case 'FAILED':
      return <AlertCircle size={11} className="text-red-400" />;
    default:
      return null;
  }
}

// ─── Media Renderer ───────────────────────────────────────────────────────────

function MediaContent({ message, isOutbound }: { message: Message; isOutbound: boolean }) {
  if (!message.mediaUrl) return null;

  const textColor = isOutbound ? 'text-white/80' : 'text-[hsl(var(--muted-foreground))]';
  const bgColor = isOutbound ? 'bg-white/10' : 'bg-[hsl(var(--background))]';

  // ── Image ──
  if (message.type === 'IMAGE') {
    return (
      <div className="mb-1.5">
        <div className="relative rounded-lg overflow-hidden max-w-[260px]">
          <Image
            src={message.mediaUrl}
            alt={message.caption ?? 'Image'}
            width={260}
            height={200}
            className="object-cover w-full h-auto rounded-lg"
            unoptimized // external URLs from our own backend
          />
        </div>
        {message.caption && <p className={cn('text-xs mt-1', textColor)}>{message.caption}</p>}
      </div>
    );
  }

  // ── Video ──
  if (message.type === 'VIDEO') {
    return (
      <div className="mb-1.5">
        <div className="relative rounded-lg overflow-hidden max-w-[260px] bg-black">
          <video src={message.mediaUrl} controls className="w-full rounded-lg max-h-[200px]" preload="metadata" />
        </div>
        {message.caption && <p className={cn('text-xs mt-1', textColor)}>{message.caption}</p>}
      </div>
    );
  }

  // ── PDF / Document ──
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

  // ── Audio ──
  if (message.type === 'AUDIO') {
    return (
      <div className="mb-1.5">
        <audio controls src={message.mediaUrl} className="w-full max-w-60 h-9" preload="metadata" />
      </div>
    );
  }

  // ── Sticker ──

  // ── Fallback for unknown media ──
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

// ─── Message Bubble ───────────────────────────────────────────────────────────

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND';
  const hasMedia = !!message.mediaUrl;
  const hasText = !!message.body;

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm break-words',
          isOutbound
            ? 'bg-[hsl(var(--green))] text-white rounded-br-sm'
            : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-bl-sm',
        )}
      >
        {/* Media */}
        {hasMedia && <MediaContent message={message} isOutbound={isOutbound} />}

        {/* Text body */}
        {hasText && <p className="leading-relaxed whitespace-pre-wrap">{message.body}</p>}

        {/* Timestamp + status */}
        <div className={cn('flex items-center gap-1 mt-1', isOutbound ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-[10px]', isOutbound ? 'text-white/60' : 'text-[hsl(var(--muted-foreground))]')}>
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
