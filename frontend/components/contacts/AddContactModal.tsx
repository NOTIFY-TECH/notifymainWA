'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useCreateContact, useDistinctTags } from '@/hooks/useContacts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = { name: '', phoneNumber: '', email: '', notes: '' };

// ─── Client-side phone normalisation ─────────────────────────────────────────
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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tagContainerRef = useRef<HTMLDivElement>(null);
  const { mutateAsync, isPending } = useCreateContact();
  const { data: existingTags = [] } = useDistinctTags();

  // Suggestions: existing tags not already added, filtered by current input
  const suggestions = useMemo(() => {
    const typed = tagInput.trim().toLowerCase();
    return existingTags
      .filter(t => !tags.includes(t.tag))
      .filter(t => (typed ? t.tag.toLowerCase().includes(typed) : true))
      .slice(0, 8);
  }, [existingTags, tags, tagInput]);

  const safeHighlightedIndex = Math.min(highlightedIndex, Math.max(suggestions.length - 1, 0));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagContainerRef.current && !tagContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commitTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned)) return;
    setTags(prev => [...prev, cleaned]);
    setTagInput('');
    setDropdownOpen(false);
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setDropdownOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(Math.min(safeHighlightedIndex + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(Math.max(safeHighlightedIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownOpen && suggestions[safeHighlightedIndex]) {
        commitTag(suggestions[safeHighlightedIndex].tag);
      } else {
        commitTag(tagInput);
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      setTags(prev => prev.slice(0, -1));
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    } else if (e.key === ',') {
      e.preventDefault();
      commitTag(tagInput);
    }
  };

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);

    if (!form.name.trim()) return setError('Name is required.');

    const { normalised, error: phoneError } = normalisePhone(form.phoneNumber);
    if (phoneError) return setError(phoneError);

    // Commit any partially-typed tag before submitting
    const finalTags = tagInput.trim() ? [...new Set([...tags, tagInput.trim().toLowerCase()])] : tags;

    try {
      await mutateAsync({
        name: form.name.trim(),
        phoneNumber: normalised,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tags: finalTags.length > 0 ? finalTags : undefined,
      });
      handleClose();
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
    setTags([]);
    setTagInput('');
    setDropdownOpen(false);
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
            <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Tags</Label>

            {/* Selected tag chips */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#22C55E]/10 border border-[#22C55E]/20 text-[hsl(var(--green))]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-400 transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input + dropdown */}
            <div ref={tagContainerRef} className="relative">
              <input
                id="ac-tags"
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value);
                  setHighlightedIndex(0);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type to search or add a tag…"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
              />

              {dropdownOpen && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.tag}
                      type="button"
                      onMouseDown={e => e.preventDefault()} // keep input focused
                      onClick={() => commitTag(s.tag)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                        i === safeHighlightedIndex
                          ? 'bg-[#22C55E]/10 text-[hsl(var(--green))]'
                          : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                      }`}
                    >
                      <span>{s.tag}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Press Enter or comma to add · Backspace removes last tag
            </p>
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
