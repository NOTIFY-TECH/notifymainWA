'use client';

import { useState, useRef } from 'react';
import { useContacts, useDistinctTags, useEstimatedTagCount } from '@/hooks/useContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Search, Upload, FileText, X, Tag, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactSelectorProps {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  csvFile: File | null;
  onCsvFileChange: (file: File | null) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
}

type Tab = 'pick' | 'tags' | 'csv';

// ─── Tab config — each tab has its own accent colour ─────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType; active: string; indicator: string }[] = [
  {
    id: 'pick',
    label: 'Pick contacts',
    icon: Users,
    // green
    active: 'bg-[hsl(var(--green-dim))] text-[hsl(var(--green))] border border-[hsl(var(--green)/0.3)]',
    indicator: 'bg-[hsl(var(--green))]',
  },
  {
    id: 'tags',
    label: 'By tag',
    icon: Tag,
    // purple
    active: 'bg-[hsl(var(--purple-dim))] text-[hsl(var(--purple))] border border-[hsl(var(--purple)/0.3)]',
    indicator: 'bg-[hsl(var(--purple))]',
  },
  {
    id: 'csv',
    label: 'Upload CSV',
    icon: Upload,
    // amber
    active: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    indicator: 'bg-amber-400',
  },
];

export default function ContactSelector({
  selectedIds,
  onSelectedIdsChange,
  csvFile,
  onCsvFileChange,
  selectedTags,
  onSelectedTagsChange,
}: ContactSelectorProps) {
  const [tab, setTab] = useState<Tab>('pick');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useContacts({ search: debouncedSearch || undefined, limit: 50 });
  const contacts = data?.data ?? [];

  const { data: distinctTags, isLoading: tagsLoading } = useDistinctTags();
  const { data: estimatedCount, isLoading: estimateLoading } = useEstimatedTagCount(selectedTags);

  const toggleContact = (id: string) => {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  const toggleTag = (tag: string) => {
    onSelectedTagsChange(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || !selected.name.endsWith('.csv')) return;
    onCsvFileChange(selected);
  };

  const activeTab = TABS.find(t => t.id === tab)!;

  return (
    <div className="flex flex-col h-full">
      {/* ── Tab strip ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex gap-1.5 p-3 pb-2 border-b border-[hsl(var(--border))]">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                isActive
                  ? t.active
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] border border-transparent',
              )}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Fixed-height panel — all three tabs live here, only one shown ── */}
      {/* h-[240px] is fixed so the right column never resizes between tabs   */}
      <div className="flex-1 min-h-0 relative">
        {/* ── PICK FROM CONTACTS ─────────────────────────────────────────── */}
        <div className={cn('absolute inset-0 flex flex-col', tab !== 'pick' && 'hidden')}>
          {/* Search */}
          <div className="shrink-0 px-3 pt-2.5 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <Input
                placeholder="Search contacts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-[hsl(var(--muted))] border-[hsl(var(--border))]"
              />
            </div>
          </div>

          {/* Scrollable contact list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-4 py-6 text-center">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-4 py-6 text-center">No contacts found</p>
            ) : (
              contacts.map(contact => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))]/60 last:border-b-0 cursor-pointer hover:bg-[hsl(var(--muted)/0.6)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    className="accent-[hsl(var(--green))] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{contact.name}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{contact.phoneNumber}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          {/* Selection count footer */}
          {selectedIds.length > 0 && (
            <div className="shrink-0 px-4 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--green-dim))]">
              <p className="text-[11px] font-semibold text-[hsl(var(--green))]">
                {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>

        {/* ── BY TAG ─────────────────────────────────────────────────────── */}
        <div className={cn('absolute inset-0 flex flex-col', tab !== 'tags' && 'hidden')}>
          <div className="flex-1 min-h-0 overflow-y-auto pt-1">
            {tagsLoading ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-4 py-6 text-center">Loading tags…</p>
            ) : !distinctTags || distinctTags.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-4 py-6 text-center">No tags yet</p>
            ) : (
              distinctTags.map(({ tag, count }) => (
                <label
                  key={tag}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))]/60 last:border-b-0 cursor-pointer hover:bg-[hsl(var(--muted)/0.6)] transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="accent-[hsl(var(--purple))] shrink-0"
                    />
                    <Tag className="w-3 h-3 text-[hsl(var(--purple))] shrink-0" />
                    <span className="text-sm text-[hsl(var(--foreground))] truncate">{tag}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[hsl(var(--purple-dim))] text-[hsl(var(--purple))]">
                    {count}
                  </span>
                </label>
              ))
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="shrink-0 px-4 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--purple-dim))]">
              <p className="text-[11px] font-semibold text-[hsl(var(--purple))]">
                {estimateLoading
                  ? 'Estimating…'
                  : `≈ ${estimatedCount ?? 0} contact${estimatedCount === 1 ? '' : 's'} across ${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {/* ── UPLOAD CSV ─────────────────────────────────────────────────── */}
        <div className={cn('absolute inset-0 flex flex-col justify-center px-5 py-4 gap-4', tab !== 'csv' && 'hidden')}>
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
            Upload a <span className="font-semibold text-[hsl(var(--foreground))]">.csv</span> file with a single{' '}
            <code className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-amber-400">
              phoneNumber
            </code>{' '}
            column.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed py-7 cursor-pointer transition-colors',
              csvFile
                ? 'border-[hsl(var(--green)/0.4)] bg-[hsl(var(--green-dim))]'
                : 'border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5',
            )}
          >
            {csvFile ? (
              <>
                <FileText className="w-6 h-6 text-[hsl(var(--green))]" />
                <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{csvFile.name}</p>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onCsvFileChange(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300 inline-flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove file
                </button>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-amber-400" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Click to select a CSV file</p>
              </>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>
      </div>
    </div>
  );
}
