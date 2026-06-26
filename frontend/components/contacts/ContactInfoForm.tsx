'use client';

import { useState } from 'react';
import { ContactDetail } from '@/services/contacts-api';
import { useUpdateContact } from '@/hooks/useContacts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ContactInfoFormProps {
  contact: ContactDetail;
  isEditing: boolean;
  onSaved: () => void;
}

function buildForm(contact: ContactDetail) {
  // If the stored phoneNumber is a raw JID (contains '@'), treat the phone
  // field as empty so the user can enter a real number. The JID stays on
  // the Conversation.phoneNumber — we don't overwrite that here.
  const isJid = contact.phoneNumber?.includes('@');
  return {
    name: contact.name ?? '',
    email: contact.email ?? '',
    phoneNumber: isJid ? '' : (contact.phoneNumber ?? ''),
    notes: contact.notes ?? '',
    isBlocked: contact.isBlocked,
    isOptedOut: contact.isOptedOut,
  };
}

export default function ContactInfoForm({ contact, isEditing, onSaved }: ContactInfoFormProps) {
  const { mutateAsync, isPending } = useUpdateContact(contact.id);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => buildForm(contact));

  const isJidPhone = contact.phoneNumber?.includes('@');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const toggle = (field: 'isBlocked' | 'isOptedOut') => setForm(prev => ({ ...prev, [field]: !prev[field] }));

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) return setError('Name is required.');

    // Phone is only required if the stored one is NOT a JID.
    // If it IS a JID and user left phone empty, we skip updating phoneNumber
    // (the JID stays as the conversation address — we just save other fields).
    if (!isJidPhone && !form.phoneNumber.trim()) return setError('Phone number is required.');

    try {
      await mutateAsync({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        // Only send phoneNumber if it's non-empty (avoids sending '' which
        // would fail backend validation, or replacing a JID with nothing).
        ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber.trim() } : {}),
        notes: form.notes.trim() || undefined,
        isBlocked: form.isBlocked,
        isOptedOut: form.isOptedOut,
      });
      onSaved();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;
      setError(typeof msg === 'string' ? msg : 'Failed to save. Please try again.');
    }
  };

  if (!isEditing) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <Row label="Name" value={contact.name} />
        <Row label="Email" value={contact.email ?? '—'} />
        {/* Phone — show a friendly label for JID-only contacts */}
        {isJidPhone ? (
          <div>
            <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-0.5">
              Phone
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] italic">
              No phone number — WhatsApp privacy ID only
            </p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Click Edit to add a real phone number
            </p>
          </div>
        ) : (
          <Row label="Phone" value={contact.phoneNumber} />
        )}
        <Row label="Notes" value={contact.notes ?? '—'} multiline />
        <div className="flex gap-4">
          <Row label="Blocked" value={contact.isBlocked ? 'Yes' : 'No'} />
          <Row label="Opted out" value={contact.isOptedOut ? 'Yes' : 'No'} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Name <span className="text-red-400">*</span>
        </Label>
        <Input value={form.name} onChange={set('name')} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Phone {!isJidPhone && <span className="text-red-400">*</span>}
        </Label>
        <Input
          value={form.phoneNumber}
          onChange={set('phoneNumber')}
          placeholder={isJidPhone ? 'Add real phone number (e.g. 919876543210)' : 'e.g. 91XXXXXXXXXX'}
        />
        {isJidPhone && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            This contact was saved from a WhatsApp privacy ID. Adding a phone number lets you include them in campaigns.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Email</Label>
        <Input type="email" value={form.email} onChange={set('email')} placeholder="—" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Notes</Label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Add notes about this contact…"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none"
        />
      </div>

      <div className="flex gap-6">
        <Toggle
          label="Blocked"
          description="Prevents messages from this contact"
          checked={form.isBlocked}
          onChange={() => toggle('isBlocked')}
        />
        <Toggle
          label="Opted out"
          description="Excludes from bulk campaigns"
          checked={form.isOptedOut}
          onChange={() => toggle('isOptedOut')}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value, multiline }: { label: string; value: string | null; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className={`text-sm text-[hsl(var(--foreground))] ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value || '—'}
      </p>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer flex-1">
      <div className="relative mt-0.5">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-[hsl(var(--green))]' : 'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]'}`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{description}</p>
      </div>
    </label>
  );
}
