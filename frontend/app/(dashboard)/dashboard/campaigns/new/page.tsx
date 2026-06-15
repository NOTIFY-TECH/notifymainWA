'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCampaign } from '@/hooks/useCampaigns';
import { useConnectedSessions } from '@/hooks/useSessions';
import { useContacts } from '@/hooks/useContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { CreateCampaignRequest } from '@/types/campaign';
import { Contact } from '@/services/contacts-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, X, Search, Upload, FileText, CheckCircle, AlertCircle, Loader2, Users, Check } from 'lucide-react';
import Link from 'next/link';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{title}</p>
      {children}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  );
}

// ─── Contact selector tabs ────────────────────────────────────────────────────

type ContactTab = 'search' | 'csv';

// ── Search tab ────────────────────────────────────────────────────────────────

function ContactSearchTab({
  selectedIds,
  onToggle,
}: {
  selectedIds: Set<string>;
  onToggle: (contact: Contact) => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useContacts({
    page: 1,
    limit: 50,
    search: debouncedSearch || undefined,
  });

  const contacts = data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      <div className="flex flex-col divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {search ? 'No contacts match your search' : 'No contacts yet'}
            </p>
          </div>
        ) : (
          contacts.map(contact => {
            const selected = selectedIds.has(contact.id);
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => onToggle(contact)}
                className="flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[hsl(var(--muted))] transition-colors"
              >
                {/* Checkbox */}
                <div
                  className={[
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    selected
                      ? 'bg-[hsl(var(--green))] border-[hsl(var(--green))]'
                      : 'border-[hsl(var(--border))] bg-transparent',
                  ].join(' ')}
                >
                  {selected && <Check size={10} className="text-white" />}
                </div>

                {/* Avatar */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-semibold uppercase text-[hsl(var(--foreground))]">
                  {contact.name?.charAt(0) ?? '?'}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{contact.name}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{contact.phoneNumber}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── CSV tab ───────────────────────────────────────────────────────────────────

interface CsvRow {
  name: string;
  phoneNumber: string;
}

function CsvUploadTab({ onParsed }: { onParsed: (rows: CsvRow[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith('.csv')) {
      setParseError('Only .csv files are accepted.');
      return;
    }
    setFile(selected);
    setParseError(null);
    setRows([]);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        setParseError('CSV must have a header row and at least one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const phoneIdx = headers.indexOf('phonenumber');

      if (phoneIdx === -1) {
        setParseError('CSV must have a "phoneNumber" column.');
        return;
      }

      const parsed: CsvRow[] = lines
        .slice(1)
        .map(line => {
          const cols = line.split(',').map(c => c.trim());
          return {
            name: nameIdx !== -1 ? (cols[nameIdx] ?? '') : '',
            phoneNumber: cols[phoneIdx] ?? '',
          };
        })
        .filter(r => !!r.phoneNumber);

      setRows(parsed);
      onParsed(parsed);
    };
    reader.readAsText(selected);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[hsl(var(--border))] rounded-lg py-8 cursor-pointer hover:border-[#22C55E]/50 transition-colors"
      >
        {file ? (
          <>
            <FileText className="w-5 h-5 text-[hsl(var(--green))]" />
            <p className="text-xs font-medium text-[hsl(var(--foreground))]">{file.name}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {(file.size / 1024).toFixed(1)} KB — click to change
            </p>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Click to select a CSV file</p>
          </>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        Required column: <span className="font-mono bg-[hsl(var(--muted))] px-1 py-0.5 rounded">phoneNumber</span>.
        Optional: <span className="font-mono bg-[hsl(var(--muted))] px-1 py-0.5 rounded">name</span>.
      </p>

      {parseError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{parseError}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--green))] shrink-0" />
          <p className="text-xs text-[hsl(var(--green))]">
            {rows.length} contact{rows.length !== 1 ? 's' : ''} parsed
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Selected contacts pill bar ───────────────────────────────────────────────

function SelectedBar({
  contacts,
  csvCount,
  onRemove,
}: {
  contacts: Contact[];
  csvCount: number;
  onRemove: (id: string) => void;
}) {
  const total = contacts.length + csvCount;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
        <Users size={12} />
        {total} selected
      </span>
      {contacts.map(c => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#22C55E]/10 border border-[#22C55E]/20 text-[hsl(var(--green))]"
        >
          {c.name || c.phoneNumber}
          <button type="button" onClick={() => onRemove(c.id)} className="hover:opacity-70">
            <X size={10} />
          </button>
        </span>
      ))}
      {csvCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
          +{csvCount} from CSV
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  sessionId: '',
  messageTemplate: '',
  mediaUrl: '',
  scheduledAt: '',
  rateLimitPerMin: 30,
};

export default function NewCampaignPage() {
  const router = useRouter();
  const { data: sessions = [], isLoading: sessionsLoading } = useConnectedSessions();
  const { mutateAsync, isPending } = useCreateCampaign();

  const [form, setForm] = useState(EMPTY_FORM);
  const [contactTab, setContactTab] = useState<ContactTab>('search');
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const toggleContact = useCallback((contact: Contact) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
        setSelectedContacts(cs => cs.filter(c => c.id !== contact.id));
      } else {
        next.add(contact.id);
        setSelectedContacts(cs => [...cs, contact]);
      }
      return next;
    });
  }, []);

  const removeContact = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedContacts(cs => cs.filter(c => c.id !== id));
  }, []);

  const handleCsvParsed = useCallback((rows: CsvRow[]) => {
    setCsvRows(rows);
  }, []);

  const handleSubmit = async (scheduleMode: 'now' | 'later') => {
    setError(null);

    if (!form.name.trim()) return setError('Campaign name is required.');
    if (!form.sessionId) return setError('Select a WhatsApp session.');
    if (!form.messageTemplate.trim()) return setError('Message template is required.');

    const totalContacts = selectedContacts.length + csvRows.length;
    if (totalContacts === 0) return setError('Add at least one contact.');

    if (scheduleMode === 'later' && !form.scheduledAt) return setError('Pick a date and time to schedule.');

    const payload: CreateCampaignRequest = {
      name: form.name.trim(),
      sessionId: form.sessionId,
      messageTemplate: form.messageTemplate.trim(),
      mediaUrl: form.mediaUrl.trim() || undefined,
      contactIds: selectedContacts.length > 0 ? selectedContacts.map(c => c.id) : undefined,
      scheduledAt: scheduleMode === 'later' ? new Date(form.scheduledAt).toISOString() : undefined,
      rateLimitPerMin: Number(form.rateLimitPerMin),
    };

    try {
      await mutateAsync(payload);
      router.push('/dashboard/campaigns');
    } catch (err: unknown) {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;
      setError(typeof msg === 'string' ? msg : 'Failed to create campaign. Please try again.');
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto pb-10">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/campaigns"
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">New campaign</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Send a bulk WhatsApp message to a list of contacts
          </p>
        </div>
      </div>

      {/* ── Basics ── */}
      <Section title="Details">
        <Field label="Campaign name" required>
          <Input placeholder="e.g. Diwali offer — Nov 2026" value={form.name} onChange={set('name')} />
        </Field>

        <Field label="WhatsApp session" required hint="Only connected sessions are shown.">
          <select
            value={form.sessionId}
            onChange={set('sessionId')}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
          >
            <option value="" disabled>
              {sessionsLoading
                ? 'Loading sessions…'
                : sessions.length === 0
                  ? 'No connected sessions'
                  : 'Select a session'}
            </option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.phoneNumber ? ` · ${s.phoneNumber}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Message ── */}
      <Section title="Message">
        <Field label="Message template" required hint="This message will be sent to every contact.">
          <textarea
            rows={5}
            placeholder="Hello! We have a special offer just for you…"
            value={form.messageTemplate}
            onChange={set('messageTemplate')}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none"
          />
        </Field>

        <Field label="Media URL" hint="Optional. Paste a URL to attach an image or document.">
          <Input placeholder="https://…/image.jpg" value={form.mediaUrl} onChange={set('mediaUrl')} />
        </Field>
      </Section>

      {/* ── Contacts ── */}
      <Section title="Contacts">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[hsl(var(--muted))] w-fit">
          {(['search', 'csv'] as ContactTab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setContactTab(tab)}
              className={[
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                contactTab === tab
                  ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              ].join(' ')}
            >
              {tab === 'search' ? 'Search contacts' : 'Upload CSV'}
            </button>
          ))}
        </div>

        {contactTab === 'search' ? (
          <ContactSearchTab selectedIds={selectedIds} onToggle={toggleContact} />
        ) : (
          <CsvUploadTab onParsed={handleCsvParsed} />
        )}

        <SelectedBar contacts={selectedContacts} csvCount={csvRows.length} onRemove={removeContact} />
      </Section>

      {/* ── Schedule ── */}
      <Section title="Schedule">
        <Field label="Send at" hint="Leave blank to start immediately after saving.">
          <Input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className="text-sm" />
        </Field>

        <Field
          label="Rate limit"
          hint={`Messages per minute. Between 10 and 60. Current: ${form.rateLimitPerMin}/min.`}
        >
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={form.rateLimitPerMin}
            onChange={e => setForm(prev => ({ ...prev, rateLimitPerMin: Number(e.target.value) }))}
            className="w-full accent-[hsl(var(--green))]"
          />
          <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>10/min</span>
            <span className="font-medium text-[hsl(var(--foreground))]">{form.rateLimitPerMin}/min</span>
            <span>60/min</span>
          </div>
        </Field>
      </Section>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/campaigns"
          className="px-3 py-1.5 rounded-md text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleSubmit('later')}>
            {isPending ? <Loader2 size={14} className="animate-spin" /> : 'Schedule'}
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => handleSubmit('now')}
            className="bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : 'Start now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
