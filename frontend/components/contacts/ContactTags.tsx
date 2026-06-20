'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { ContactDetail } from '@/services/contacts-api';
import { useContactTags, useDistinctTags } from '@/hooks/useContacts';
import { Plus, X } from 'lucide-react';

interface ContactTagsProps {
  contact: ContactDetail;
}

export default function ContactTags({ contact }: ContactTagsProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { add, remove } = useContactTags(contact.id);
  const { data: existingTags = [] } = useDistinctTags();

  // Tags the contact doesn't already have, filtered by what's typed so far,
  // most-used first (useDistinctTags already returns them ordered by count).
  const suggestions = useMemo(() => {
    const typed = input.trim().toLowerCase();
    return existingTags
      .filter(t => !contact.tags.includes(t.tag))
      .filter(t => (typed ? t.tag.toLowerCase().includes(typed) : true))
      .slice(0, 8);
  }, [existingTags, contact.tags, input]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Index is reset directly in the onChange handler below (where the typed
  // value actually changes) rather than via a useEffect watching `input` —
  // same fix as ContactInfoForm's set-state-in-effect issue. Clamped here at
  // render time as a safety net for the case where the list shrinks (e.g. a
  // tag gets added) without input changing.
  const safeHighlightedIndex = Math.min(highlightedIndex, Math.max(suggestions.length - 1, 0));

  const commitTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (!cleaned || contact.tags.includes(cleaned)) return;
    add.mutate(cleaned, { onSuccess: () => setInput('') });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
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
      // If a suggestion is highlighted and the dropdown is open, pick it —
      // otherwise fall back to creating whatever's typed as a new tag.
      if (isOpen && suggestions[safeHighlightedIndex]) {
        commitTag(suggestions[safeHighlightedIndex].tag);
      } else {
        commitTag(input);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="px-6 py-4 border-t border-[hsl(var(--border))]">
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Tags</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {contact.tags.length === 0 && <span className="text-xs text-[hsl(var(--muted-foreground))]">No tags yet</span>}
        {contact.tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#22C55E]/10 border border-[#22C55E]/20 text-[hsl(var(--green))]"
          >
            {tag}
            <button
              onClick={() => remove.mutate(tag)}
              disabled={remove.isPending}
              className="hover:text-red-400 transition-colors disabled:opacity-50"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Add tag input + autocomplete dropdown */}
      <div ref={containerRef} className="relative flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            value={input}
            onChange={e => {
              setInput(e.target.value);
              setHighlightedIndex(0);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Add a tag…"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-xs placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
          />

          {isOpen && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s.tag}
                  type="button"
                  onMouseDown={e => e.preventDefault()} // keep input focused, avoid blur-before-click race
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

        <button
          onClick={() => commitTag(input)}
          disabled={add.isPending || !input.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#22C55E]/10 border border-[#22C55E]/20 text-[hsl(var(--green))] hover:bg-[#22C55E]/20 transition-colors disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
    </div>
  );
}
