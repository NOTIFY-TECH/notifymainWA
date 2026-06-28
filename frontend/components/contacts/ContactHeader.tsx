'use client';

import { ContactDetail } from '@/services/contacts-api';
import { useDeleteContact } from '@/hooks/useContacts';
import { Ban, BellOff, Trash2, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import NewMessageFromContactModal from './NewMessageFromContactModal';

interface ContactHeaderProps {
  contact: ContactDetail;
  isEditing: boolean;
  onEditToggle: () => void;
}

export default function ContactHeader({ contact, isEditing, onEditToggle }: ContactHeaderProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const { mutate: deleteContact, isPending: isDeleting } = useDeleteContact();
  const initial = (contact.name || contact.phoneNumber).charAt(0).toUpperCase();

  // Only allow messaging contacts with a real phone number (not a @lid JID)
  const canMessage = !!contact.phoneNumber && !contact.phoneNumber.includes('@');

  return (
    <>
      <div className="flex items-start gap-4 p-6 border-b border-[hsl(var(--border))]">
        <div className="h-14 w-14 shrink-0 rounded-full bg-[#22C55E]/10 flex items-center justify-center text-xl font-bold text-[hsl(var(--green))] uppercase">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))] truncate">
              {contact.name || contact.phoneNumber}
            </h2>
            {contact.isBlocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                <Ban className="w-3 h-3" /> Blocked
              </span>
            )}
            {contact.isOptedOut && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">
                <BellOff className="w-3 h-3" /> Opted out
              </span>
            )}
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{contact.phoneNumber}</p>
          {contact.email && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{contact.email}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Message button — only shown for contacts with a real phone number */}
          {canMessage && (
            <button
              onClick={() => setMessageModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors bg-[hsl(var(--green))]/10 border-[hsl(var(--green))]/30 text-[hsl(var(--green))] hover:bg-[hsl(var(--green))]/20"
              title="Send a message"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Message
            </button>
          )}

          <button
            onClick={onEditToggle}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              isEditing
                ? 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]'
                : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80',
            )}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Delete?</span>
              <button
                onClick={() => deleteContact(contact.id)}
                disabled={isDeleting}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New message modal — rendered outside the header div to avoid z-index issues */}
      {canMessage && (
        <NewMessageFromContactModal
          open={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          contact={{
            id: contact.id,
            name: contact.name || contact.phoneNumber,
            phoneNumber: contact.phoneNumber,
          }}
        />
      )}
    </>
  );
}
