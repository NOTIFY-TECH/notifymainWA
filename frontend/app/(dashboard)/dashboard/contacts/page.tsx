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

// ─── Tag filter chip ──────────────────────────────────────────────────────────

const QUICK_TAGS = ['vip', 'lead', 'inactive'];

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-[#22C55E]/20 border-[#22C55E]/40 text-[hsl(var(--green))]'
          : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
      ].join(' ')}
    >
      {label}
      {active && <X className="w-3 h-3" />}
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
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Contacts</h1>
          {meta && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'contact' : 'contacts'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
          >
            <Plus className="w-4 h-4" />
            Add contact
          </Button>
        </div>
      </div>

      {/* Search + tag filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={handleSearchChange}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_TAGS.map(tag => (
            <TagChip key={tag} label={tag} active={activeTags.includes(tag)} onClick={() => toggleTag(tag)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <ContactList
        contacts={contacts}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onContactClick={handleContactClick}
        onAdd={() => setAddOpen(true)}
      />

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
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

      {/* Modals */}
      <AddContactModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
