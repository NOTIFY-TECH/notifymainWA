'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCampaigns } from '@/hooks/useCampaigns';
import { ListCampaignsParams, CampaignStatus } from '@/types/campaign';
import CampaignList from '@/components/campaigns/CampaignList';
import { Button } from '@/components/ui/button';
import { FilterBar, FilterChip } from '@/components/ui/filter-bar';
import { Plus, Megaphone } from 'lucide-react';
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
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-[600] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Marketing
          </p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <Megaphone size={15} className="text-violet-500" />
            </div>
            <h1 className="text-[20px] font-[700] tracking-tight text-[hsl(var(--foreground))]">Campaigns</h1>
          </div>
          {meta && (
            <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-1">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'campaign' : 'campaigns'}
            </p>
          )}
        </div>

        <div className="pt-1">
          <button
            onClick={() => router.push('/dashboard/campaigns/new')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius)] bg-[hsl(var(--purple))] text-white text-[12px] font-[600] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={14} />
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
    </div>
  );
}
