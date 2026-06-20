'use client';

import { Campaign } from '@/types/campaign';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import CampaignCard from './CampaignCard';

interface CampaignListProps {
  campaigns: Campaign[];
  isLoading: boolean;
  hasFilters: boolean;
  onCampaignClick: (campaignId: string) => void;
  onCreate: () => void;
}

export default function CampaignList({
  campaigns,
  isLoading,
  hasFilters,
  onCampaignClick,
  onCreate,
}: CampaignListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        accent="purple"
        title={hasFilters ? 'No campaigns match your filters' : 'No campaigns yet'}
        description={
          hasFilters
            ? 'Try adjusting your search or status filter.'
            : 'Create your first campaign to start sending messages.'
        }
        action={!hasFilters ? { label: 'New campaign', onClick: onCreate, icon: Plus } : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {campaigns.map(c => (
        <CampaignCard key={c.id} campaign={c} onClick={() => onCampaignClick(c.id)} />
      ))}
    </div>
  );
}
