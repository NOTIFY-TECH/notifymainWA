import { Session } from '@/types/session';

interface SessionsSummaryStripProps {
  sessions: Session[];
}

export function SessionsSummaryStrip({ sessions }: SessionsSummaryStripProps) {
  const stats = [
    { label: 'Total', value: sessions.length, color: 'text-[hsl(var(--foreground))]' },
    {
      label: 'Connected',
      value: sessions.filter(s => s.status === 'CONNECTED').length,
      color: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Pending',
      value: sessions.filter(s => s.status === 'PENDING' || s.status === 'QR_READY').length,
      color: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      label: 'Offline',
      value: sessions.filter(s => s.status === 'DISCONNECTED').length,
      color: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map(stat => (
        <div key={stat.label} className="glass card-hover rounded-[var(--radius)] px-4 py-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
