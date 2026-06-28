'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useConnectedSessions } from '@/hooks/useSessions';
import { messagesApi } from '@/services/messages-api';
import { X, MessageSquarePlus, Send, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewMessageFromContactModalProps {
  open: boolean;
  onClose: () => void;
  contact: {
    id: string;
    name: string;
    phoneNumber: string;
  };
}

export default function NewMessageFromContactModal({ open, onClose, contact }: NewMessageFromContactModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = useAuthStore(s => s.tenant?.id ?? '');

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [message, setMessage] = useState('');

  const { data: connectedSessions } = useConnectedSessions();

  // Use explicitly selected session, or fall back to first connected
  const sessionId = selectedSessionId || connectedSessions?.[0]?.id || '';

  const handleClose = () => {
    setMessage('');
    setSelectedSessionId('');
    onClose();
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      messagesApi.send(tenantId, {
        sessionId,
        to: contact.phoneNumber,
        type: 'TEXT',
        text: message.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
      handleClose();
      router.push('/dashboard/inbox');
    },
  });

  const canSend = !!sessionId && message.trim().length > 0 && !sendMutation.isPending;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-msg-title"
        className={cn(
          'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-2xl flex flex-col',
          'bg-[hsl(var(--card))] border border-[hsl(var(--border))]',
          'shadow-2xl shadow-black/40',
        )}
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--green))]/12">
            <MessageSquarePlus size={15} className="text-[hsl(var(--green))]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="new-msg-title" className="text-sm font-semibold text-[hsl(var(--foreground))]">
              New Message
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              To: {contact.name || contact.phoneNumber}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 flex flex-col gap-4 flex-1 overflow-y-auto">
            {/* Contact pill */}
            <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--muted))] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] text-xs font-semibold uppercase">
                {(contact.name || contact.phoneNumber).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                  {contact.name || contact.phoneNumber}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{contact.phoneNumber}</p>
              </div>
            </div>

            {/* Session picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Send via session</label>
              {!connectedSessions?.length ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                  <AlertCircle size={14} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">No connected WhatsApp sessions. Connect a session first.</p>
                </div>
              ) : (
                <select
                  value={sessionId}
                  onChange={e => setSelectedSessionId(e.target.value)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-sm appearance-none',
                    'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                    'text-[hsl(var(--foreground))]',
                    'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]',
                    'transition-colors cursor-pointer',
                  )}
                >
                  {connectedSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phoneNumber ? `(${s.phoneNumber})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Type your message…"
                autoFocus
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-sm resize-none',
                  'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50',
                  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]',
                  'transition-colors',
                )}
              />
            </div>

            {/* Error */}
            {sendMutation.isError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400">
                  Failed to send. Check the session is still connected and try again.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[hsl(var(--border))] shrink-0">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                canSend
                  ? 'bg-[hsl(var(--green))] text-white hover:opacity-90'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]/40 cursor-not-allowed',
              )}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={13} />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
