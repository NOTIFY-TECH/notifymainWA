'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useConnectedSessions } from '@/hooks/useSessions';
import { contactsApi } from '@/services/contacts-api';
import { messagesApi } from '@/services/messages-api';
import { X, Search, MessageSquarePlus, Send, Loader2, AlertCircle, ChevronLeft, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'pick-contact' | 'compose';

export default function NewConversationModal({ open, onClose }: NewConversationModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenant = useAuthStore(s => s.tenant);
  const tenantId = tenant?.id ?? '';

  const [step, setStep] = useState<Step>('pick-contact');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string; phoneNumber: string } | null>(
    null,
  );
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [message, setMessage] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const { data: connectedSessions } = useConnectedSessions();

  // Derive session — use explicitly selected one, or fall back to first connected
  const sessionId = selectedSessionId || connectedSessions?.[0]?.id || '';

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Focus search on open
  useEffect(() => {
    if (open && step === 'pick-contact') {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, step]);

  // Reset on close
  const handleClose = () => {
    setStep('pick-contact');
    setSearch('');
    setDebouncedSearch('');
    setSelectedContact(null);
    setMessage('');
    setSelectedSessionId('');
    onClose();
  };

  // Contact search query
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', 'picker', tenantId, debouncedSearch],
    queryFn: () => contactsApi.list(tenantId, { search: debouncedSearch || undefined, limit: 20 }),
    enabled: !!tenantId && open,
  });

  // Filter out JID-only contacts (can't message them directly)
  const contacts = (contactsData?.data ?? []).filter(c => c.phoneNumber && !c.phoneNumber.includes('@'));

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: () =>
      messagesApi.send(tenantId, {
        sessionId,
        to: selectedContact!.phoneNumber,
        type: 'TEXT',
        text: message.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
      handleClose();
      router.push('/dashboard/inbox');
    },
  });

  const canSend = !!sessionId && message.trim().length > 0 && !!selectedContact && !sendMutation.isPending;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conv-title"
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
          {step === 'compose' && (
            <button
              onClick={() => setStep('pick-contact')}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              aria-label="Back"
            >
              <ChevronLeft size={15} />
            </button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--green))]/12">
            <MessageSquarePlus size={15} className="text-[hsl(var(--green))]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="new-conv-title" className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {step === 'pick-contact' ? 'New Conversation' : 'Compose Message'}
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {step === 'pick-contact' ? 'Search your contacts' : `To: ${selectedContact?.name}`}
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

        {/* ── Step 1: Pick contact ── */}
        {step === 'pick-contact' && (
          <>
            {/* Search box */}
            <div className="px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by name or phone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={cn(
                    'w-full pl-8 pr-3 py-2 text-sm rounded-lg',
                    'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                    'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50',
                    'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]',
                    'transition-colors',
                  )}
                />
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
                  <Phone size={28} className="text-[hsl(var(--muted-foreground))]" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {debouncedSearch ? `No contacts found for "${debouncedSearch}"` : 'No contacts with a phone number'}
                  </p>
                </div>
              ) : (
                <ul className="py-2">
                  {contacts.map(contact => (
                    <li key={contact.id}>
                      <button
                        onClick={() => {
                          setSelectedContact({
                            id: contact.id,
                            name: contact.name || contact.phoneNumber,
                            phoneNumber: contact.phoneNumber,
                          });
                          setStep('compose');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted))] transition-colors text-left"
                      >
                        {/* Avatar */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] text-xs font-semibold uppercase">
                          {(contact.name || contact.phoneNumber).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                            {contact.name || contact.phoneNumber}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{contact.phoneNumber}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Compose ── */}
        {step === 'compose' && selectedContact && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-4 flex flex-col gap-4 flex-1 overflow-y-auto">
              {/* Selected contact pill */}
              <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--muted))] px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] text-xs font-semibold uppercase">
                  {selectedContact.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{selectedContact.name}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{selectedContact.phoneNumber}</p>
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
                  placeholder="Type your opening message…"
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
        )}
      </div>
    </>
  );
}
