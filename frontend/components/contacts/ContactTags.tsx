'use client';

import { useState } from 'react';
import { ContactDetail } from '@/services/contacts-api';
import { useContactTags } from '@/hooks/useContacts';
import { Plus, X } from 'lucide-react';

interface ContactTagsProps {
  contact: ContactDetail;
}

export default function ContactTags({ contact }: ContactTagsProps) {
  const [input, setInput] = useState('');
  const { add, remove } = useContactTags(contact.id);

  const handleAdd = () => {
    const tag = input.trim().toLowerCase();
    if (!tag || contact.tags.includes(tag)) return;
    add.mutate(tag, { onSuccess: () => setInput('') });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
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

      {/* Add tag input */}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag…"
          className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-xs placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
        />
        <button
          onClick={handleAdd}
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
