'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useContacts } from '@/hooks/useContacts';
import { ListContactsParams } from '@/services/contacts-api';
import ContactList from '@/components/contacts/ContactList';
import AddContactModal from '@/components/contacts/AddContactModal';
import ImportContactsModal from '@/components/contacts/ImportContactsModal';
import { Button } from '@/components/ui/button';
import { Search, Plus, Upload, X, Users } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// ─── Tag chip ─────────────────────────────────────────────────────────────────

const QUICK_TAGS = ['vip', 'lead', 'inactive'];

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-[600] border transition-colors',
        active
          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
          : 'bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--foreground)/0.2)]',
      )}
    >
      {label}
      {active && <X className="w-3 h-3 ml-0.5" />}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const filters: ListContactsParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    tags: activeTags.length > 0 ? activeTags : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const { data, isLoading } = useContacts(filters);
  const contacts = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = !!debouncedSearch || activeTags.length > 0;

  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
    setPage(1);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleContactClick = (contactId: string) => {
    router.push(`/dashboard/contacts/${contactId}`);
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-[600] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">CRM</p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Users size={15} className="text-emerald-500" />
            </div>
            <h1 className="text-[20px] font-[700] tracking-tight text-[hsl(var(--foreground))]">Contacts</h1>
          </div>
          {meta && (
            <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-1">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'contact' : 'contacts'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius)] border border-[hsl(var(--border))] text-[12px] font-[500] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius)] bg-emerald-500 text-white text-[12px] font-[600] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={14} />
            Add contact
          </button>
        </div>
      </div>

      {/* ── Search + filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <input
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={handleSearchChange}
            className="w-full h-9 pl-8 pr-3 rounded-[var(--radius-sm)] bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-emerald-400/40 focus:border-emerald-400/60 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_TAGS.map(tag => (
            <TagChip key={tag} label={tag} active={activeTags.includes(tag)} onClick={() => toggleTag(tag)} />
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <ContactList
        contacts={contacts}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onContactClick={handleContactClick}
        onAdd={() => setAddOpen(true)}
      />

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))] pt-2">
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <AddContactModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
