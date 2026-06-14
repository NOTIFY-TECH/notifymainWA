'use client';

import { Contact } from '@/services/contacts-api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Ban, BellOff } from 'lucide-react';

interface ContactItemProps {
  contact: Contact;
  onClick: () => void;
}

export default function ContactItem({ contact, onClick }: ContactItemProps) {
  const displayName = contact.name || contact.phoneNumber;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <tr
      onClick={onClick}
      className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
    >
      {/* Name + phone */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-[#22C55E]/10 flex items-center justify-center text-sm font-semibold text-[hsl(var(--green))] uppercase">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate flex items-center gap-1.5">
              {displayName}
              {contact.isBlocked && <Ban className="w-3 h-3 text-red-400 shrink-0" />}
              {contact.isOptedOut && <BellOff className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{contact.phoneNumber}</p>
          </div>
        </div>
      </td>

      {/* Tags */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {contact.tags.length === 0 ? (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
          ) : (
            contact.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]"
              >
                {tag}
              </span>
            ))
          )}
          {contact.tags.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
              +{contact.tags.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* Conversations */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-[hsl(var(--foreground))]">{contact.conversationCount}</span>
      </td>

      {/* Last message */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {contact.lastMessageAt ? formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: true }) : '—'}
        </span>
      </td>

      {/* Added */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
        </span>
      </td>
    </tr>
  );
}
