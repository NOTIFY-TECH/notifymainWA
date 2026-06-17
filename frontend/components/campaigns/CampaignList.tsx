'use client';

import { Campaign } from '@/types/campaign';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]">
          <Megaphone size={20} />
        </div>
        <p className="text-sm text-[hsl(var(--foreground))]">
          {hasFilters ? 'No campaigns match your filters' : 'No campaigns yet'}
        </p>
        {!hasFilters && (
          <Button
            size="sm"
            onClick={onCreate}
            className="inline-flex items-center gap-2 bg-[hsl(var(--purple))]/20 border border-[hsl(var(--purple))]/30 text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple))]/30"
          >
            <Plus className="w-4 h-4" />
            New campaign
          </Button>
        )}
      </div>
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
