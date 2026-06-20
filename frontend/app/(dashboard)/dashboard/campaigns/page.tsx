'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCampaigns } from '@/hooks/useCampaigns';
import { ListCampaignsParams, CampaignStatus } from '@/types/campaign';
import CampaignList from '@/components/campaigns/CampaignList';
import { Button } from '@/components/ui/button';
import { FilterBar, FilterChip } from '@/components/ui/filter-bar';
import { Plus } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// ─── Filter config ────────────────────────────────────────────────────────────

const STATUS_CHIPS: FilterChip<CampaignStatus>[] = [
  { value: 'RUNNING', label: 'Running' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | null>(null);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const filters: ListCampaignsParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter ?? undefined,
  };

  const { data, isLoading } = useCampaigns(filters);
  const campaigns = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = !!debouncedSearch || !!statusFilter;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleChipToggle = (status: CampaignStatus) => {
    setStatusFilter(prev => (prev === status ? null : status));
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
            Marketing
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">Campaigns</h1>
          {meta && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'campaign' : 'campaigns'}
            </p>
          )}
        </div>
        <div className="pt-1">
          <button
            onClick={() => router.push('/dashboard/campaigns/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius)] bg-[hsl(var(--purple-dim))] border border-[hsl(var(--purple)/0.25)] text-sm text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple)/0.2)] transition-colors font-medium"
          >
            <Plus size={15} />
            New campaign
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <FilterBar
        searchValue={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search campaigns…"
        chips={STATUS_CHIPS}
        activeChip={statusFilter}
        onChipToggle={handleChipToggle}
      />

      {/* ── List ── */}
      <CampaignList
        campaigns={campaigns}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onCampaignClick={id => router.push(`/dashboard/campaigns/${id}`)}
        onCreate={() => router.push('/dashboard/campaigns/new')}
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
    </div>
  );
}
