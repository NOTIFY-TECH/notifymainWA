'use client';

import { CampaignStatus } from '@/types/campaign';
import { cn } from '@/lib/utils';

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  DRAFT: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  SCHEDULED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  RUNNING: 'bg-[#22C55E]/15 text-[hsl(var(--green))] border-[#22C55E]/30',
  PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))] border-[hsl(var(--purple))]/30',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
