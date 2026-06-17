'use client';

import { Campaign } from '@/types/campaign';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Megaphone } from 'lucide-react';
import CampaignStatusBadge from './CampaignStatusBadge';
import CampaignProgress from './CampaignProgress';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export default function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]',
        'px-4 py-3.5 flex flex-col gap-3 transition-colors hover:bg-[hsl(var(--muted))]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]">
            <Megaphone size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{campaign.name}</p>
            {campaign.session && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">via {campaign.session.name}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <CampaignStatusBadge status={campaign.status} />
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      <CampaignProgress
        sentCount={campaign.sentCount}
        deliveredCount={campaign.deliveredCount}
        readCount={campaign.readCount}
        failedCount={campaign.failedCount}
        totalContacts={campaign.totalContacts}
      />
    </button>
  );
}
