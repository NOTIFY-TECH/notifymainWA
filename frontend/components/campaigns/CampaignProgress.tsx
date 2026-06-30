'use client';

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
      {/* Segmented progress bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        {/* Read — blue, leftmost / highest priority */}
        <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${readPct}%` }} />
        {/* Delivered (not yet read) — green */}
        <div
          className="h-full bg-[hsl(var(--green))] transition-all duration-500"
          style={{ width: `${Math.max(deliveredPct - readPct, 0)}%` }}
        />
        {/* Sent (not yet delivered) — green/40 */}
        <div
          className="h-full bg-[hsl(var(--green))]/40 transition-all duration-500"
          style={{ width: `${Math.max(sentPct - deliveredPct, 0)}%` }}
        />
        {/* Failed — red */}
        <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${failedPct}%` }} />
      </div>

      {/* Counts row */}
      {!compact && (
        <div className="flex items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span className="tabular-nums">
            {sentCount.toLocaleString()} / {totalContacts.toLocaleString()} sent
          </span>
          {readCount > 0 && <span className="text-blue-400 tabular-nums">{readCount.toLocaleString()} read</span>}
          {failedCount > 0 && <span className="text-red-400 tabular-nums">{failedCount.toLocaleString()} failed</span>}
        </div>
      )}
    </div>
  );
}
