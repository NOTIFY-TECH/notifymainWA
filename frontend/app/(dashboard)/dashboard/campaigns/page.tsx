'use client';

import { useState, useCallback } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useAuthStore } from '@/store/authStore';
import { ListCampaignsParams, CampaignStatus } from '@/types/campaign';
import CampaignCard from '@/components/campaigns/CampaignCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Loader2, Megaphone } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';

// ─── Status filter tabs ───────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: CampaignStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
        <Megaphone size={20} className="text-[hsl(var(--muted-foreground))]" />
      </div>
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">
        {hasFilters ? 'No campaigns match your filters' : 'No campaigns yet'}
      </p>
      <p className="text-xs text-[hsl(var(--muted-foreground))] text-center max-w-xs">
        {hasFilters
          ? 'Try adjusting your search or status filter.'
          : 'Create your first campaign to start sending bulk WhatsApp messages.'}
      </p>
      {!hasFilters && (
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const tenantId = useAuthStore.getState().tenant?.id ?? '';

  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<CampaignStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const filters: ListCampaignsParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: activeStatus,
  };

  const { data, isLoading } = useCampaigns(filters);
  const campaigns = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = !!debouncedSearch || !!activeStatus;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusTab = useCallback((value: CampaignStatus | undefined) => {
    setActiveStatus(value);
    setPage(1);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Campaigns</h1>
          {meta && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {meta.total.toLocaleString()} {meta.total === 1 ? 'campaign' : 'campaigns'}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </Link>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <Input placeholder="Search campaigns…" value={search} onChange={handleSearchChange} className="pl-9 text-sm" />
      </div>

      {/* ── Status tabs ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.label}
            onClick={() => handleStatusTab(tab.value)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              activeStatus === tab.value
                ? 'bg-[#22C55E]/20 border-[#22C55E]/40 text-[hsl(var(--green))]'
                : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Campaign grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} tenantId={tenantId} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
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
