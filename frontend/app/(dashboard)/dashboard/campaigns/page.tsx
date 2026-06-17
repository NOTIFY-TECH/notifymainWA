'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCampaigns } from '@/hooks/useCampaigns';
import { ListCampaignsParams, CampaignStatus } from '@/types/campaign';
import CampaignList from '@/components/campaigns/CampaignList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_FILTERS: CampaignStatus[] = ['RUNNING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

function StatusChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-[hsl(var(--purple))]/20 border-[hsl(var(--purple))]/40 text-[hsl(var(--purple))]'
          : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
      ].join(' ')}
    >
      {label}
      {active && <X className="w-3 h-3" />}
    </button>
  );
}

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

  const toggleStatus = (status: CampaignStatus) => {
    setStatusFilter(prev => (prev === status ? null : status));
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Campaigns</h1>
          {meta && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'campaign' : 'campaigns'}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => router.push('/dashboard/campaigns/new')}
          className="inline-flex items-center gap-2 bg-[hsl(var(--purple))]/20 border border-[hsl(var(--purple))]/30 text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple))]/30"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </Button>
      </div>

      {/* Search + status filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search campaigns…"
            value={search}
            onChange={handleSearchChange}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(status => (
            <StatusChip
              key={status}
              label={status.charAt(0) + status.slice(1).toLowerCase()}
              active={statusFilter === status}
              onClick={() => toggleStatus(status)}
            />
          ))}
        </div>
      </div>

      {/* List */}
      <CampaignList
        campaigns={campaigns}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onCampaignClick={id => router.push(`/dashboard/campaigns/${id}`)}
        onCreate={() => router.push('/dashboard/campaigns/new')}
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
    </div>
  );
}
