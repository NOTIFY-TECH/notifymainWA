'use client';

import { Contact } from '@/services/contacts-api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Ban, BellOff } from 'lucide-react';

const AVATAR_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-violet-50', text: 'text-violet-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-rose-50', text: 'text-rose-600' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600' },
];

function getContactAvatarColor(initial: string) {
  const code = initial.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

interface ContactItemProps {
  contact: Contact;
  onClick: () => void;
}

export default function ContactItem({ contact, onClick }: ContactItemProps) {
  const displayName = contact.name || contact.phoneNumber;
  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = getContactAvatarColor(initial);

  return (
    <tr
      onClick={onClick}
      className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
    >
      {/* Name + phone */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[13px] font-[600] uppercase',
              avatarColor.bg,
              avatarColor.text,
            )}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-[500] text-[hsl(var(--foreground))] truncate flex items-center gap-1.5">
              {displayName}
              {contact.isBlocked && <Ban className="w-3 h-3 text-red-400 shrink-0" />}
              {contact.isOptedOut && <BellOff className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />}
            </p>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))] truncate">{contact.phoneNumber}</p>
          </div>
        </div>
      </td>

      {/* Tags */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {contact.tags.length === 0 ? (
            <span className="text-[12px] text-[hsl(var(--muted-foreground))]">—</span>
          ) : (
            contact.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[600] bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                {tag}
              </span>
            ))
          )}
          {contact.tags.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[600] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
              +{contact.tags.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* Conversations */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-[13px] text-[hsl(var(--foreground))]">{contact.conversationCount}</span>
      </td>

      {/* Last message */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {contact.lastMessageAt ? formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: true }) : '—'}
        </span>
      </td>

      {/* Added */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
        </span>
      </td>
    </tr>
  );
}
