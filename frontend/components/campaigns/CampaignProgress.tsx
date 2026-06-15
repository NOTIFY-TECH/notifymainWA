'use client';

import { CampaignDetail } from '@/types/campaign';

interface Props {
  campaign: CampaignDetail;
}

interface Stat {
  label: string;
  count: number;
  color: string;
}

export default function CampaignProgress({ campaign }: Props) {
  const { totalContacts, sentCount, deliveredCount, readCount, failedCount } = campaign;
  const total = totalContacts || 1; // avoid div/0

  const stats: Stat[] = [
    { label: 'Sent', count: sentCount, color: 'bg-blue-400/70' },
    { label: 'Delivered', count: deliveredCount, color: 'bg-[hsl(var(--green))]/70' },
    { label: 'Read', count: readCount, color: 'bg-[hsl(var(--green))]' },
    { label: 'Failed', count: failedCount, color: 'bg-red-400/70' },
  ];

  const sentPct = Math.min((sentCount / total) * 100, 100);
  const deliveredPct = Math.min((deliveredCount / total) * 100, 100);
  const readPct = Math.min((readCount / total) * 100, 100);
  const failedPct = Math.min((failedCount / total) * 100, 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Progress
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {sentCount} / {totalContacts} sent
        </p>
      </div>

      {/* Stacked progress bar */}
      <div className="relative h-2 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        {/* Failed (leftmost, below everything) */}
        <div
          className="absolute inset-y-0 left-0 bg-red-400/60 transition-all duration-500"
          style={{ width: `${failedPct}%` }}
        />
        {/* Sent */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-400/60 transition-all duration-500"
          style={{ width: `${sentPct}%` }}
        />
        {/* Delivered */}
        <div
          className="absolute inset-y-0 left-0 bg-[#22C55E]/60 transition-all duration-500"
          style={{ width: `${deliveredPct}%` }}
        />
        {/* Read (topmost, most advanced) */}
        <div
          className="absolute inset-y-0 left-0 bg-[#22C55E] transition-all duration-500"
          style={{ width: `${readPct}%` }}
        />
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-3">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</span>
            <span className="text-xs font-medium text-[hsl(var(--foreground))]">{s.count}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Total</span>
          <span className="text-xs font-medium text-[hsl(var(--foreground))]">{totalContacts}</span>
        </div>
      </div>
    </div>
  );
}
