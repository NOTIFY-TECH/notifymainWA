'use client';

import { cn } from '@/lib/utils';
import { CampaignStatus } from '@/types/campaign';

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
  className?: string;
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  },
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  RUNNING: {
    label: 'Running',
    className: 'bg-[#22C55E]/15 text-[hsl(var(--green))] border-[#22C55E]/30',
  },
  PAUSED: {
    label: 'Paused',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-[#22C55E]/10 text-[hsl(var(--green))] border-[#22C55E]/20',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
};

export default function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className,
      )}
    >
      {/* Pulsing dot for RUNNING only */}
      {status === 'RUNNING' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--green))] opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[hsl(var(--green))]" />
        </span>
      )}
      {config.label}
    </span>
  );
}
