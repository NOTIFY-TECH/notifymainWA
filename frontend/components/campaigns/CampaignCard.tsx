'use client';

import Link from 'next/link';
import { Campaign } from '@/types/campaign';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Users, Send, CheckCheck, Eye, XCircle, Zap } from 'lucide-react';
import CampaignStatusBadge from './CampaignStatusBadge';

interface CampaignCardProps {
  campaign: Campaign;
  tenantId: string;
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Icon size={12} className="shrink-0" />
      <span className="tabular-nums">{value.toLocaleString()}</span>
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ campaign }: { campaign: Campaign }) {
  const total = campaign.totalContacts;
  if (!total) return null;

  const sentPct = Math.round((campaign.sentCount / total) * 100);
  const deliveredPct = Math.round((campaign.deliveredCount / total) * 100);
  const readPct = Math.round((campaign.readCount / total) * 100);
  const failedPct = Math.round((campaign.failedCount / total) * 100);

  return (
    <div className="mt-3">
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-[hsl(var(--muted))]">
        {/* Stacked: read > delivered > sent > failed */}
        <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${readPct}%` }} />
        <div
          className="h-full bg-[hsl(var(--green))] transition-all duration-500"
          style={{ width: `${Math.max(0, deliveredPct - readPct)}%` }}
        />
        <div
          className="h-full bg-[#22C55E]/40 transition-all duration-500"
          style={{ width: `${Math.max(0, sentPct - deliveredPct)}%` }}
        />
        <div className="h-full bg-red-400/60 transition-all duration-500" style={{ width: `${failedPct}%` }} />
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
        {sentPct}% sent · {total.toLocaleString()} contacts
      </p>
    </div>
  );
}

// ─── CampaignCard ─────────────────────────────────────────────────────────────

export default function CampaignCard({ campaign, tenantId }: CampaignCardProps) {
  const showProgress = campaign.status === 'RUNNING' || campaign.status === 'COMPLETED' || campaign.status === 'PAUSED';

  const timeLabel = (() => {
    if (campaign.completedAt)
      return `Completed ${formatDistanceToNow(new Date(campaign.completedAt), { addSuffix: true })}`;
    if (campaign.startedAt) return `Started ${formatDistanceToNow(new Date(campaign.startedAt), { addSuffix: true })}`;
    if (campaign.scheduledAt) return `Scheduled for ${new Date(campaign.scheduledAt).toLocaleString()}`;
    return `Created ${formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}`;
  })();

  return (
    <Link
      href={`/dashboard/campaigns/${campaign.id}`}
      className={cn(
        'block rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]',
        'px-4 py-4 transition-colors hover:bg-[hsl(var(--muted))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--green))]',
      )}
    >
      {/* Top row — name + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{campaign.name}</p>
          {campaign.session && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
              via {campaign.session.name}
              {campaign.session.phoneNumber ? ` · ${campaign.session.phoneNumber}` : ''}
            </p>
          )}
        </div>
        <CampaignStatusBadge status={campaign.status} className="shrink-0 mt-0.5" />
      </div>

      {/* Progress bar (running/completed/paused) */}
      {showProgress && <ProgressBar campaign={campaign} />}

      {/* Stats row */}
      {showProgress && (
        <div className="mt-2.5 flex items-center gap-4 text-xs font-medium text-[hsl(var(--foreground))]">
          <Stat icon={Users} value={campaign.totalContacts} label="total" />
          <Stat icon={Send} value={campaign.sentCount} label="sent" />
          <Stat icon={CheckCheck} value={campaign.deliveredCount} label="delivered" />
          <Stat icon={Eye} value={campaign.readCount} label="read" />
          {campaign.failedCount > 0 && (
            <Stat icon={XCircle} value={campaign.failedCount} label="failed" className="text-red-500" />
          )}
        </div>
      )}

      {/* Scheduled / draft — show contact count + rate limit */}
      {!showProgress && campaign.totalContacts > 0 && (
        <div className="mt-2.5 flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {campaign.totalContacts.toLocaleString()} contacts
          </span>
          <span className="flex items-center gap-1">
            <Zap size={12} />
            {campaign.rateLimitPerMin}/min
          </span>
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-2.5 text-[10px] text-[hsl(var(--muted-foreground))]">{timeLabel}</p>
    </Link>
  );
}
