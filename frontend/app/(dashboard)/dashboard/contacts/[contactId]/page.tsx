'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useContact } from '@/hooks/useContacts';
import ContactHeader from '@/components/contacts/ContactHeader';
import ContactInfoForm from '@/components/contacts/ContactInfoForm';
import ContactTags from '@/components/contacts/ContactTags';
import ContactConversationHistory from '@/components/contacts/ContactConversationHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ contactId: string }>;
}

export default function ContactDetailPage({ params }: Props) {
  const { contactId } = use(params);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { data: contact, isLoading, isError } = useContact(contactId);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4 pt-2">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <div className="p-6 flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="p-6 flex flex-col gap-4 border-t border-[hsl(var(--border))]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-48" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !contact) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Contact not found</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 mb-4">This contact may have been deleted.</p>
        <button
          onClick={() => router.push('/dashboard/contacts')}
          className="text-xs text-[hsl(var(--green))] hover:underline"
        >
          Back to contacts
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button
        onClick={() => router.push('/dashboard/contacts')}
        className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All contacts
      </button>

      <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
        <ContactHeader contact={contact} isEditing={isEditing} onEditToggle={() => setIsEditing(e => !e)} />
        <ContactInfoForm key={contact.id} contact={contact} isEditing={isEditing} onSaved={() => setIsEditing(false)} />
        <ContactTags contact={contact} />
        <ContactConversationHistory contact={contact} />
      </div>
    </div>
  );
}
