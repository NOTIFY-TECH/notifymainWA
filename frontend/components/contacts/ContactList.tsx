'use client';

import { Contact } from '@/services/contacts-api';
import ContactItem from './ContactItem';
import { ContactsEmptyState } from './ContactsEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ContactListProps {
  contacts: Contact[];
  isLoading: boolean;
  hasFilters: boolean;
  onContactClick: (contactId: string) => void;
  onAdd: () => void;
}

const COLUMNS = [
  { label: 'Name', className: 'px-4 py-3 w-[40%]' },
  { label: 'Tags', className: 'px-4 py-3 hidden sm:table-cell' },
  { label: 'Chats', className: 'px-4 py-3 hidden md:table-cell w-20' },
  { label: 'Last message', className: 'px-4 py-3 hidden lg:table-cell' },
  { label: 'Added', className: 'px-4 py-3 hidden xl:table-cell' },
];

function RowSkeleton() {
  return (
    <tr className="border-b border-[hsl(var(--border))]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <Skeleton className="h-5 w-16 rounded-md" />
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <Skeleton className="h-3.5 w-6" />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <Skeleton className="h-3 w-20" />
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <Skeleton className="h-3 w-16" />
      </td>
    </tr>
  );
}

export default function ContactList({ contacts, isLoading, hasFilters, onContactClick, onAdd }: ContactListProps) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            {COLUMNS.map(col => (
              <th
                key={col.label}
                className={cn('text-xs font-medium text-[hsl(var(--muted-foreground))]', col.className)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
          ) : contacts.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <ContactsEmptyState hasFilters={hasFilters} onAdd={onAdd} />
              </td>
            </tr>
          ) : (
            contacts.map(contact => (
              <ContactItem key={contact.id} contact={contact} onClick={() => onContactClick(contact.id)} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
