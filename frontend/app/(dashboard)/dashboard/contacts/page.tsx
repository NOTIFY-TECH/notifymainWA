'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useContacts } from '@/hooks/useContacts';
import { ListContactsParams } from '@/services/contacts-api';
import ContactList from '@/components/contacts/ContactList';
import AddContactModal from '@/components/contacts/AddContactModal';
import ImportContactsModal from '@/components/contacts/ImportContactsModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Upload, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// ─── Tag chip ─────────────────────────────────────────────────────────────────

const QUICK_TAGS = ['vip', 'lead', 'inactive'];

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-[hsl(var(--green-dim))] border-[hsl(var(--green)/0.3)] text-[hsl(var(--green))]'
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
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">CRM</p>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">Contacts</h1>
          {meta && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'contact' : 'contacts'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors font-medium"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius)] bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-sm text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] transition-colors font-medium"
          >
            <Plus size={15} />
            Add contact
          </button>
        </div>
      </div>

      {/* ── Search + filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={handleSearchChange}
            className="pl-9 h-9 text-sm"
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
        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] pt-2">
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
