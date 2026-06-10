'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Loader2, Smile, Paperclip, X, FileText, Image as ImageIcon, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { messagesApi } from '@/services/messages-api';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme } from '@/components/theme-provider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendPayload {
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  type: string;
}

interface SendMessageFormProps {
  sessionId: string;
  toNumber: string;
  conversationId: string;
  tenantId: string;
  onSend: (payload: SendPayload) => void;
  isSending: boolean;
}

// ─── Allowed file types ───────────────────────────────────────────────────────

const ACCEPTED = 'image/jpeg,image/png,image/webp,video/mp4,application/pdf,audio/mpeg,audio/ogg';

const MAX_SIZE_MB = 16;

function getMessageType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'document';
  return 'document';
}

function FileIcon({ mimeType, size = 20 }: { mimeType: string; size?: number }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} />;
  if (mimeType.startsWith('video/')) return <Film size={size} />;
  return <FileText size={size} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SendMessageForm({ tenantId, onSend, isSending }: SendMessageFormProps) {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // ── Emoji picker ──────────────────────────────────────────────────────────
  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    setText(prev => prev + emojiData.emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }, []);

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`File too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }

    setAttachment(file);

    // Generate local preview for images/videos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const clearAttachment = () => {
    if (preview) URL.revokeObjectURL(preview);
    setAttachment(null);
    setPreview(null);
    setUploadError(null);
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || isSending || isUploading) return;

    setUploadError(null);

    // ── Media message ──
    if (attachment) {
      setIsUploading(true);
      try {
        const uploaded = await messagesApi.uploadMedia(tenantId, attachment);
        const msgType = getMessageType(attachment.type);

        onSend({
          type: msgType,
          mediaUrl: uploaded.url,
          mediaType: uploaded.mediaType,
          caption: trimmed || undefined, // text becomes caption for media
        });

        setText('');
        clearAttachment();
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      } catch {
        setUploadError('Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // ── Text message ──
    onSend({ type: 'text', text: trimmed });
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, attachment, isSending, isUploading, tenantId, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Close emoji picker on Escape
    if (e.key === 'Escape') setShowEmoji(false);
  };

  const isBusy = isSending || isUploading;
  const canSend = (!!text.trim() || !!attachment) && !isBusy;

  return (
    <div className="shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      {/* ── Attachment preview ── */}
      {attachment && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
          {/* Image preview */}
          {preview && attachment.type.startsWith('image/') && (
            <img src={preview} alt="preview" className="h-14 w-14 rounded-lg object-cover shrink-0" />
          )}
          {/* Video preview */}
          {preview && attachment.type.startsWith('video/') && (
            <video src={preview} className="h-14 w-14 rounded-lg object-cover shrink-0" muted />
          )}
          {/* Non-previewable file icon */}
          {!preview && (
            <div className="h-14 w-14 rounded-lg bg-[hsl(var(--background))] flex items-center justify-center shrink-0 text-[hsl(var(--green))]">
              <FileIcon mimeType={attachment.type} size={24} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{attachment.name}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {(attachment.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {isUploading && (
              <p className="text-[10px] text-[hsl(var(--green))] flex items-center gap-1 mt-0.5">
                <Loader2 size={10} className="animate-spin" /> Uploading…
              </p>
            )}
          </div>

          <button
            onClick={clearAttachment}
            disabled={isUploading}
            className="p-1.5 rounded-full hover:bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors disabled:opacity-40"
            aria-label="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Upload error ── */}
      {uploadError && (
        <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
          <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmoji && (
        <div className="absolute bottom-[72px] left-4 z-50 shadow-lg rounded-xl overflow-hidden">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
            height={380}
            width={320}
            searchDisabled={false}
            skinTonesDisabled
            lazyLoadEmojis
          />
        </div>
      )}

      {/* ── Input row ── */}
      <div className="flex items-end gap-2 px-3 py-3">
        {/* Emoji button */}
        <button
          type="button"
          onClick={() => setShowEmoji(v => !v)}
          className={cn(
            'p-2 rounded-lg transition-colors shrink-0 mb-0.5',
            showEmoji
              ? 'bg-[hsl(var(--green))] text-white'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
          )}
          aria-label="Emoji picker"
        >
          <Smile size={18} />
        </button>

        {/* File attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'p-2 rounded-lg transition-colors shrink-0 mb-0.5',
            attachment
              ? 'bg-[hsl(var(--green))] text-white'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
            'disabled:opacity-40',
          )}
          aria-label="Attach file"
        >
          <Paperclip size={18} />
        </button>

        <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFileChange} className="hidden" />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={attachment ? 'Add a caption… (optional)' : 'Type a message…'}
          rows={1}
          disabled={isBusy}
          className={cn(
            'flex-1 resize-none rounded-2xl px-4 py-2.5',
            'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
            'text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
            'focus:outline-none focus:border-[hsl(var(--green))]',
            'transition-colors max-h-[120px] overflow-y-auto',
            'disabled:opacity-60',
          )}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full mb-0.5',
            'bg-[hsl(var(--green))] text-white',
            'transition-all hover:opacity-90 active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          aria-label="Send message"
        >
          {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
