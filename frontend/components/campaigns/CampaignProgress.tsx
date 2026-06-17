'use client';

import { cn } from '@/lib/utils';

interface CampaignProgressProps {
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  totalContacts: number;
  compact?: boolean;
}

export default function CampaignProgress({
  sentCount,
  deliveredCount,
  readCount,
  failedCount,
  totalContacts,
  compact = false,
}: CampaignProgressProps) {
  const total = totalContacts || 1;
  const readPct = (readCount / total) * 100;
  const deliveredPct = (deliveredCount / total) * 100;
  const sentPct = (sentCount / total) * 100;
  const failedPct = (failedCount / total) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div className="h-full bg-blue-400" style={{ width: `${readPct}%` }} />
        <div className="h-full bg-[hsl(var(--green))]" style={{ width: `${Math.max(deliveredPct - readPct, 0)}%` }} />
        <div
          className="h-full bg-[hsl(var(--green))]/40"
          style={{ width: `${Math.max(sentPct - deliveredPct, 0)}%` }}
        />
        <div className="h-full bg-red-400" style={{ width: `${failedPct}%` }} />
      </div>
      {!compact && (
        <div className="flex items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span>
            {sentCount} / {totalContacts} sent
          </span>
          {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
        </div>
      )}
    </div>
  );
}
