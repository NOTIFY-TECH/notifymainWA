'use client';

import { useState, useRef } from 'react';
import { useContacts, useDistinctTags, useEstimatedTagCount } from '@/hooks/useContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Search, Upload, FileText, X, Tag, Users, CheckSquare, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactSelectorProps {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  csvFile: File | null;
  onCsvFileChange: (file: File | null) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
}

type Tab = 'pick' | 'tags' | 'txt';
type TxtSubTab = 'upload' | 'paste';

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType; active: string }[] = [
  {
    id: 'pick',
    label: 'Pick contacts',
    icon: Users,
    active: 'bg-[hsl(var(--green-dim))] text-[hsl(var(--green))] border border-[hsl(var(--green)/0.3)]',
  },
  {
    id: 'tags',
    label: 'By tag',
    icon: Tag,
    active: 'bg-[hsl(var(--purple-dim))] text-[hsl(var(--purple))] border border-[hsl(var(--purple)/0.3)]',
  },
  {
    id: 'txt',
    label: 'By numbers',
    icon: Hash,
    active: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a raw string of comma/newline-separated phone numbers into a deduped array. */
function parseNumbers(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  raw
    .split(/[\n,]+/)
    .map(s => s.trim().replace(/\s+/g, ''))
    .filter(s => s.length > 0)
    .forEach(n => {
      if (!seen.has(n)) {
        seen.add(n);
        result.push(n);
      }
    });
  return result;
}

/** Build a synthetic CSV File blob from an array of phone number strings. */
function buildCsvFile(numbers: string[], name = 'numbers.csv'): File {
  const content = 'phoneNumber\n' + numbers.join('\n');
  return new File([content], name, { type: 'text/csv' });
}

/**
 * Detect whether raw file content is a CSV with a `phoneNumber` header column,
 * or a plain TXT of comma/newline-separated numbers.
 * Returns { mode: 'csv' } if it's a proper CSV (pass through as-is),
 * or { mode: 'txt', numbers } if it needs parsing.
 */
function detectAndParse(raw: string): { mode: 'csv' } | { mode: 'txt'; numbers: string[] } {
  const firstLine = raw.split(/\r?\n/)[0].trim().toLowerCase();
  // If first line contains 'phonenumber' treat as CSV — pass through directly
  if (firstLine.includes('phonenumber')) {
    return { mode: 'csv' };
  }
  return { mode: 'txt', numbers: parseNumbers(raw) };
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [txtSubTab, setTxtSubTab] = useState<TxtSubTab>('upload');
  const [pasteValue, setPasteValue] = useState('');
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [txtFileName, setTxtFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useContacts({ search: debouncedSearch || undefined, limit: 500 });
  const contacts = data?.data ?? [];

  const { data: distinctTags, isLoading: tagsLoading } = useDistinctTags();
  const { data: estimatedCount, isLoading: estimateLoading } = useEstimatedTagCount(selectedTags);

  // ── Contact picker ────────────────────────────────────────────────────────

  const toggleContact = (id: string) => {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  const selectAll = () => {
    onSelectedIdsChange(contacts.map(c => c.id));
  };

  // ── Tag picker ────────────────────────────────────────────────────────────

  const toggleTag = (tag: string) => {
    onSelectedTagsChange(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]);
  };

  // ── TXT / paste helpers ───────────────────────────────────────────────────

  const applyNumbers = (numbers: string[]) => {
    setParsedNumbers(numbers);
    if (numbers.length === 0) {
      onCsvFileChange(null);
    } else {
      onCsvFileChange(buildCsvFile(numbers));
    }
  };

  const handleTxtFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTxtFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = ev.target?.result as string;
      const result = detectAndParse(raw);
      if (result.mode === 'csv') {
        // Proper CSV with phoneNumber header — pass original file directly
        // so the backend receives it in the format it already expects.
        const passthrough = new File([file], file.name, { type: 'text/csv' });
        // Count data rows (excluding header) for the preview counter
        const rows = raw
          .split(/\r?\n/)
          .slice(1)
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0);
        setParsedNumbers(rows);
        onCsvFileChange(passthrough);
      } else {
        applyNumbers(result.numbers);
      }
    };
    reader.readAsText(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    setPasteValue(raw);
    applyNumbers(parseNumbers(raw));
  };

  const clearTxt = () => {
    setParsedNumbers([]);
    setPasteValue('');
    setTxtFileName(null);
    onCsvFileChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* ── Panels ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        {/* ── PICK FROM CONTACTS ─────────────────────────────────────────── */}
        <div className={cn('absolute inset-0 flex flex-col', tab !== 'pick' && 'hidden')}>
          {/* Search + Select All row */}
          <div className="shrink-0 px-3 pt-2.5 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <Input
                placeholder="Search contacts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-[hsl(var(--muted))] border-[hsl(var(--border))]"
              />
            </div>
            <button
              type="button"
              onClick={selectAll}
              disabled={isLoading || contacts.length === 0}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border',
                contacts.length === 0 || isLoading
                  ? 'opacity-40 cursor-not-allowed border-transparent text-[hsl(var(--muted-foreground))]'
                  : 'border-[hsl(var(--green)/0.3)] text-[hsl(var(--green))] bg-[hsl(var(--green-dim))] hover:opacity-80',
              )}
              title="Select all loaded contacts"
            >
              <CheckSquare className="w-3 h-3 shrink-0" />
              All
            </button>
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
            <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--green-dim))]">
              <p className="text-[11px] font-semibold text-[hsl(var(--green))]">
                {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
              <button
                type="button"
                onClick={() => onSelectedIdsChange([])}
                className="text-[10px] text-[hsl(var(--green))] hover:opacity-70 transition-opacity inline-flex items-center gap-1"
              >
                <X className="w-2.5 h-2.5" /> Clear
              </button>
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

        {/* ── BY NUMBERS (TXT upload / paste) ────────────────────────────── */}
        <div className={cn('absolute inset-0 flex flex-col', tab !== 'txt' && 'hidden')}>
          {/* Sub-tab strip */}
          <div className="shrink-0 flex gap-1 px-3 pt-2.5 pb-2">
            {(['upload', 'paste'] as TxtSubTab[]).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setTxtSubTab(st)}
                className={cn(
                  'px-3 py-1 rounded-md text-[11px] font-semibold transition-all capitalize',
                  txtSubTab === st
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] border border-transparent',
                )}
              >
                {st === 'upload' ? 'Upload file' : 'Paste numbers'}
              </button>
            ))}
          </div>

          {/* Sub-tab: Upload file */}
          {txtSubTab === 'upload' && (
            <div className="flex-1 min-h-0 flex flex-col justify-center px-5 py-3 gap-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                Upload a <span className="font-semibold text-[hsl(var(--foreground))]">.txt</span> (comma-separated
                numbers) or <span className="font-semibold text-[hsl(var(--foreground))]">.csv</span> (with a{' '}
                <code className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded text-amber-400">
                  phoneNumber
                </code>{' '}
                column) file.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed py-7 cursor-pointer transition-colors',
                  txtFileName && parsedNumbers.length > 0
                    ? 'border-[hsl(var(--green)/0.4)] bg-[hsl(var(--green-dim))]'
                    : 'border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5',
                )}
              >
                {txtFileName && parsedNumbers.length > 0 ? (
                  <>
                    <FileText className="w-6 h-6 text-[hsl(var(--green))]" />
                    <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{txtFileName}</p>
                    <p className="text-[11px] text-[hsl(var(--green))] font-semibold">
                      {parsedNumbers.length} number{parsedNumbers.length !== 1 ? 's' : ''} loaded
                    </p>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        clearTxt();
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 inline-flex items-center gap-1 transition-colors mt-0.5"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-amber-400" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Click to select a .txt or .csv file</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                className="hidden"
                onChange={handleTxtFileChange}
              />

              {parsedNumbers.length > 0 && <NumbersPreview numbers={parsedNumbers} />}
            </div>
          )}

          {/* Sub-tab: Paste numbers */}
          {txtSubTab === 'paste' && (
            <div className="flex-1 min-h-0 flex flex-col px-4 pt-1 pb-3 gap-2.5">
              <p className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                Paste phone numbers separated by{' '}
                <span className="font-semibold text-[hsl(var(--foreground))]">commas</span> or{' '}
                <span className="font-semibold text-[hsl(var(--foreground))]">new lines</span>.
              </p>
              <textarea
                value={pasteValue}
                onChange={handlePasteChange}
                placeholder={'919876543210, 918765432109\n919988776655\n...'}
                className="flex-1 min-h-0 w-full rounded-[var(--radius-sm)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2.5 text-[12px] font-mono placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/60 resize-none leading-relaxed transition-colors"
              />
              {parsedNumbers.length > 0 && (
                <div className="shrink-0">
                  <NumbersPreview numbers={parsedNumbers} />
                </div>
              )}
              {pasteValue.length > 0 && parsedNumbers.length === 0 && (
                <p className="text-[11px] text-red-400 shrink-0">No valid numbers found. Check formatting.</p>
              )}
            </div>
          )}

          {/* Footer — shown for both sub-tabs when numbers are loaded */}
          {parsedNumbers.length > 0 && (
            <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border))] bg-amber-500/8">
              <p className="text-[11px] font-semibold text-amber-500">
                {parsedNumbers.length} number{parsedNumbers.length !== 1 ? 's' : ''} queued for import
              </p>
              <button
                type="button"
                onClick={clearTxt}
                className="text-[10px] text-amber-500 hover:opacity-70 transition-opacity inline-flex items-center gap-1"
              >
                <X className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NumbersPreview — small sub-component ─────────────────────────────────────

function NumbersPreview({ numbers }: { numbers: string[] }) {
  const preview = numbers.slice(0, 3);
  const rest = numbers.length - preview.length;
  return (
    <div className="rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] px-3 py-2 flex flex-wrap items-center gap-1.5">
      {preview.map(n => (
        <span
          key={n}
          className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-500"
        >
          {n}
        </span>
      ))}
      {rest > 0 && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">+{rest} more</span>}
    </div>
  );
}
