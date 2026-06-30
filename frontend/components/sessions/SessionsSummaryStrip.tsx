import { Session } from '@/types/session';
import { MonitorSmartphone, Wifi, Clock, WifiOff } from 'lucide-react';

interface SessionsSummaryStripProps {
  sessions: Session[];
}

const STATS = [
  {
    label: 'Total',
    key: 'total',
    icon: MonitorSmartphone,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    valueColor: 'text-[hsl(var(--foreground))]',
  },
  {
    label: 'Connected',
    key: 'connected',
    icon: Wifi,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    valueColor: 'text-emerald-600',
  },
  {
    label: 'Pending',
    key: 'pending',
    icon: Clock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    valueColor: 'text-amber-600',
  },
  {
    label: 'Offline',
    key: 'offline',
    icon: WifiOff,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-400',
    valueColor: 'text-red-500',
  },
] as const;

export function SessionsSummaryStrip({ sessions }: SessionsSummaryStripProps) {
  const values: Record<string, number> = {
    total: sessions.length,
    connected: sessions.filter(s => s.status === 'CONNECTED').length,
    pending: sessions.filter(s => s.status === 'PENDING' || s.status === 'QR_READY').length,
    offline: sessions.filter(s => s.status === 'DISCONNECTED').length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATS.map(stat => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.key}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-sm)] px-4 py-3"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.iconBg}`}>
              <Icon size={15} className={stat.iconColor} />
            </div>
            <div>
              <p className="text-[11px] font-[500] text-[hsl(var(--muted-foreground))]">{stat.label}</p>
              <p className={`text-[22px] font-[700] leading-tight ${stat.valueColor}`}>{values[stat.key]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
