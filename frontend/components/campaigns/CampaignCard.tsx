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

// ─── Left accent border by status ────────────────────────────────────────────

const STATUS_ACCENT: Record<CampaignStatus, string> = {
  RUNNING: 'border-l-[hsl(var(--green))]',
  SCHEDULED: 'border-l-blue-400',
  COMPLETED: 'border-l-violet-400',
  PAUSED: 'border-l-amber-400',
  CANCELLED: 'border-l-red-400',
  DRAFT: 'border-l-slate-300',
};

// ─── Icon chip tint by status ─────────────────────────────────────────────────

const STATUS_ICON: Record<CampaignStatus, { bg: string; text: string }> = {
  RUNNING: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  SCHEDULED: { bg: 'bg-blue-50', text: 'text-blue-500' },
  COMPLETED: { bg: 'bg-violet-50', text: 'text-violet-500' },
  PAUSED: { bg: 'bg-amber-50', text: 'text-amber-500' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-400' },
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-400' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const accent = STATUS_ACCENT[campaign.status];
  const icon = STATUS_ICON[campaign.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
        'border-l-[3px]',
        accent,
        'px-4 py-3.5 flex flex-col gap-3',
        'shadow-[var(--shadow-sm)]',
        'hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-150',
      )}
    >
      {/* ── Top row: icon + name + badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Status-tinted icon chip */}
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', icon.bg, icon.text)}>
            <Megaphone size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-[600] text-[hsl(var(--foreground))] truncate">{campaign.name}</p>
            {campaign.session && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">via {campaign.session.name}</p>
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

      {/* ── Progress bar + counts ── */}
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
