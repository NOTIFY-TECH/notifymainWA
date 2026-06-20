'use client';

import { Campaign, CampaignStatus } from '@/types/campaign';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Megaphone } from 'lucide-react';
import { StatusBadge, StatusVariant } from '@/components/ui/status-badge';
import CampaignProgress from './CampaignProgress';

// ─── Status map ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<CampaignStatus, StatusVariant> = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
        'px-4 py-3.5 flex flex-col gap-3',
        'transition-colors hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--border))]/60',
      )}
    >
      {/* Top row: icon + name + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))]">
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
          <StatusBadge status={STATUS_MAP[campaign.status]} />
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Progress bar + counts */}
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
