'use client';

import { useState } from 'react';
import { useCreateContact } from '@/hooks/useContacts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = { name: '', phoneNumber: '', email: '', notes: '', tags: '' };

// ─── Client-side phone normalisation ─────────────────────────────────────────
// Mirrors the backend phone.util.ts logic so the user sees an error instantly
// without a round-trip. The backend still validates — this is UX, not security.

function normalisePhone(raw: string): { normalised: string; error: string | null } {
  let digits = raw.trim();

  if (!digits) return { normalised: '', error: 'Phone number is required.' };

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');

  if (digits.length === 0) {
    return { normalised: '', error: 'Phone number contains no digits.' };
  }

  if (digits.length === 10) {
    if (digits.startsWith('0')) {
      return {
        normalised: '',
        error: 'A 10-digit number starting with 0 is not a valid Indian mobile number.',
      };
    }
    digits = '91' + digits;
  }

  if (digits.length < 10) {
    return { normalised: '', error: `Phone number too short (${digits.length} digits).` };
  }

  if (digits.length > 15) {
    return { normalised: '', error: `Phone number too long (${digits.length} digits).` };
  }

  return { normalised: digits, error: null };
}

export default function AddContactModal({ open, onClose }: AddContactModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useCreateContact();

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);

    if (!form.name.trim()) return setError('Name is required.');

    const { normalised, error: phoneError } = normalisePhone(form.phoneNumber);
    if (phoneError) return setError(phoneError);

    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      await mutateAsync({
        name: form.name.trim(),
        phoneNumber: normalised, // send normalised value; backend will also normalise via @Transform
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      setForm(EMPTY);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;
      setError(
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
            ? (msg as string[]).join(', ')
            : 'Failed to create contact. Please try again.',
      );
    }
  };

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Add contact</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-name" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input id="ac-name" placeholder="Rahul Sharma" value={form.name} onChange={set('name')} />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-phone" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Phone number <span className="text-red-400">*</span>
            </Label>
            <Input
              id="ac-phone"
              placeholder="919876543210 or +91 98765 43210"
              value={form.phoneNumber}
              onChange={set('phoneNumber')}
            />
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Indian (9876543210 or 919876543210) or international (+1 650 555 0123). Formatting is stripped
              automatically.
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-email" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Email
            </Label>
            <Input
              id="ac-email"
              type="email"
              placeholder="rahul@example.com"
              value={form.email}
              onChange={set('email')}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-tags" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Tags
            </Label>
            <Input id="ac-tags" placeholder="vip, lead, restaurant" value={form.tags} onChange={set('tags')} />
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Comma-separated</p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-notes" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Notes
            </Label>
            <textarea
              id="ac-notes"
              rows={3}
              placeholder="Any notes about this contact..."
              value={form.notes}
              onChange={set('notes')}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
            >
              {isPending ? 'Adding…' : 'Add contact'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
