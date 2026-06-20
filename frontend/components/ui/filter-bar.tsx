'use client';

import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterChip<T extends string> {
  value: T;
  label: string;
}

interface FilterBarProps<T extends string> {
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Pill filters (optional — can use FilterBar as search-only)
  chips?: FilterChip<T>[];
  activeChip?: T | null;
  onChipToggle?: (value: T) => void;

  // Layout
  className?: string;
}

// ─── Sub-component: single pill chip ─────────────────────────────────────────

function Chip<T extends string>({
  chip,
  active,
  onToggle,
}: {
  chip: FilterChip<T>;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-[hsl(var(--purple))]/15 border-[hsl(var(--purple))]/35 text-[hsl(var(--purple))]'
          : [
              'bg-[hsl(var(--muted))] border-[hsl(var(--border))]',
              'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              'hover:bg-[hsl(var(--muted))]/80',
            ].join(' '),
      )}
    >
      {chip.label}
      {active && <X className="w-3 h-3" />}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilterBar<T extends string>({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  chips,
  activeChip,
  onChipToggle,
  className,
}: FilterBarProps<T>) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Chips */}
      {chips && chips.length > 0 && onChipToggle && (
        <div className="flex items-center gap-2 flex-wrap">
          {chips.map(chip => (
            <Chip
              key={chip.value}
              chip={chip}
              active={activeChip === chip.value}
              onToggle={() => onChipToggle(chip.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
