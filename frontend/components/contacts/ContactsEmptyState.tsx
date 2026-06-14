'use client';

import { Plus, Users } from 'lucide-react';

interface ContactsEmptyStateProps {
  hasFilters: boolean;
  onAdd: () => void;
}

export function ContactsEmptyState({ hasFilters, onAdd }: ContactsEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
        </div>
        <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">No contacts found</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-[hsl(var(--green))]" />
      </div>
      <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">No contacts yet</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs mb-6">
        Add your first contact manually or import a CSV to get started.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22C55E]/20 border border-[#22C55E]/30 text-sm text-[hsl(var(--green))] hover:bg-[#22C55E]/30 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add contact
      </button>
    </div>
  );
}
