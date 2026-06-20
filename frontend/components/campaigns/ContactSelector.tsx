'use client';

import { useState, useRef } from 'react';
import { useContacts, useDistinctTags, useEstimatedTagCount } from '@/hooks/useContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Upload, FileText, X, Tag } from 'lucide-react';
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
    if (!selected) return;
    if (!selected.name.endsWith('.csv')) {
      return;
    }
    onCsvFileChange(selected);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('pick')}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            tab === 'pick'
              ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'
              : 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          Pick from contacts
        </button>
        <button
          type="button"
          onClick={() => setTab('tags')}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            tab === 'tags'
              ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'
              : 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          By tag
        </button>
        <button
          type="button"
          onClick={() => setTab('csv')}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            tab === 'csv'
              ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'
              : 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          Upload CSV
        </button>
      </div>

      {tab === 'pick' ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] max-h-60 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-3 py-4 text-center">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-3 py-4 text-center">No contacts found</p>
            ) : (
              contacts.map(contact => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 px-3 py-2 border-b border-[hsl(var(--border))] last:border-b-0 cursor-pointer hover:bg-[hsl(var(--muted))]"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    className="accent-[hsl(var(--green))]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-[hsl(var(--foreground))] truncate">{contact.name}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{contact.phoneNumber}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          {selectedIds.length > 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      ) : tab === 'tags' ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-[hsl(var(--border))] max-h-60 overflow-y-auto">
            {tagsLoading ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-3 py-4 text-center">Loading tags…</p>
            ) : !distinctTags || distinctTags.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-3 py-4 text-center">No tags yet</p>
            ) : (
              distinctTags.map(({ tag, count }) => (
                <label
                  key={tag}
                  className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[hsl(var(--border))] last:border-b-0 cursor-pointer hover:bg-[hsl(var(--muted))]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="accent-[hsl(var(--green))]"
                    />
                    <Tag className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                    <span className="text-sm text-[hsl(var(--foreground))] truncate">{tag}</span>
                  </span>
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">{count}</span>
                </label>
              ))
            )}
          </div>

          {selectedTags.length > 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {estimateLoading
                ? 'Estimating…'
                : `≈ ${estimatedCount ?? 0} contact${estimatedCount === 1 ? '' : 's'} match`}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Upload a <span className="font-medium text-[hsl(var(--foreground))]">.csv</span> file with a single{' '}
            <span className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded">phoneNumber</span>{' '}
            column.
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[hsl(var(--border))] rounded-lg py-6 cursor-pointer hover:border-[#22C55E]/50 transition-colors"
          >
            {csvFile ? (
              <>
                <FileText className="w-5 h-5 text-[hsl(var(--green))]" />
                <p className="text-xs font-medium text-[hsl(var(--foreground))]">{csvFile.name}</p>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onCsvFileChange(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-[10px] text-red-400 hover:underline inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Click to select a CSV file</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>
      )}
    </div>
  );
}
