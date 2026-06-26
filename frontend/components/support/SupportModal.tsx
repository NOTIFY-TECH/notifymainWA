'use client';

import { useState } from 'react';
import { X, LifeBuoy, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useSubmitSupportTicket } from '@/hooks/useSupport';
import { cn } from '@/lib/utils';

const SUBJECTS = [
  { value: 'bug', label: 'Bug / App not working' },
  { value: 'session', label: 'WhatsApp session issue' },
  { value: 'campaign', label: 'Campaign not sending' },
  { value: 'inbox', label: 'Contacts / Inbox issue' },
  { value: 'billing', label: 'Billing / Account' },
  { value: 'other', label: 'Other' },
] as const;

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SupportModal({ open, onClose }: SupportModalProps) {
  const user = useAuthStore(s => s.user);
  const tenant = useAuthStore(s => s.tenant);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const mutation = useSubmitSupportTicket(tenant?.id ?? '');

  if (!open) return null;

  const handleSubmit = () => {
    if (!subject || !message.trim() || !tenant?.id) return;
    mutation.mutate(
      { subject, message: message.trim() },
      {
        onSuccess: () => {
          // keep modal open to show success state
        },
      },
    );
  };

  const handleClose = () => {
    // reset state on close
    setSubject('');
    setMessage('');
    mutation.reset();
    onClose();
  };

  const isSubmitted = mutation.isSuccess;
  const isLoading = mutation.isPending;
  const hasError = mutation.isError;
  const canSubmit = !!subject && message.trim().length > 0 && !isLoading;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        className={cn(
          'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-2xl',
          'bg-[hsl(var(--card))] border border-[hsl(var(--border))]',
          'shadow-2xl shadow-black/40',
          'flex flex-col',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[hsl(var(--border))]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--green))]/12">
            <LifeBuoy size={16} className="text-[hsl(var(--green))]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="support-modal-title" className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Contact Support
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              We&apos;ll get back to you at <span className="text-[hsl(var(--foreground))]">{user?.email}</span>
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
        <div className="px-6 py-5 flex flex-col gap-4">
          {isSubmitted ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--green))]/12">
                <CheckCircle2 size={24} className="text-[hsl(var(--green))]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Request submitted</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Our team will review your message and reply to{' '}
                  <span className="text-[hsl(var(--foreground))]">{user?.email}</span> shortly.
                </p>
              </div>
              <button
                onClick={handleClose}
                className={cn(
                  'mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] hover:bg-[hsl(var(--green))]/20',
                )}
              >
                Done
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              {/* Context pills — read-only info sent automatically */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--muted))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  <span className="text-[hsl(var(--foreground))]/40">Tenant</span>
                  <span className="font-mono text-[hsl(var(--foreground))]">{tenant?.id?.slice(0, 8)}…</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--muted))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  <span className="text-[hsl(var(--foreground))]/40">User</span>
                  <span className="font-mono text-[hsl(var(--foreground))]">{user?.id?.slice(0, 8)}…</span>
                </span>
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="support-subject" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Category
                </label>
                <select
                  id="support-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-sm',
                    'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                    'text-[hsl(var(--foreground))]',
                    'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]',
                    'transition-colors appearance-none cursor-pointer',
                    !subject && 'text-[hsl(var(--muted-foreground))]',
                  )}
                >
                  <option value="" disabled>
                    Select a category…
                  </option>
                  {SUBJECTS.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="support-message" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Message
                </label>
                <textarea
                  id="support-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe the issue you're facing…"
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-sm resize-none',
                    'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                    'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50',
                    'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]',
                    'transition-colors',
                  )}
                />
                <p className="text-right text-[11px] text-[hsl(var(--muted-foreground))]/50">{message.length}/2000</p>
              </div>

              {/* Error */}
              {hasError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">
                    Failed to submit. Please try again or email us at{' '}
                    <a href="mailto:support@notifytechai.com" className="underline underline-offset-2">
                      support@notifytechai.com
                    </a>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isSubmitted && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[hsl(var(--border))]">
            <div className="flex flex-col gap-1">
              <a
                href="mailto:support@notifytechai.com"
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors underline underline-offset-2"
              >
                support@notifytechai.com
              </a>
              <a
                href="tel:+919988152718"
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors underline underline-offset-2"
              >
                +91 99881 52718
              </a>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                canSubmit
                  ? 'bg-[hsl(var(--green))] text-white hover:opacity-90'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]/40 cursor-not-allowed',
              )}
            >
              {isLoading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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
        )}
      </div>
    </>
  );
}
