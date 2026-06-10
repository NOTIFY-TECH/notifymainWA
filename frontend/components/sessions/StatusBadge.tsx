import { Wifi, WifiOff, Clock, Loader2, QrCode } from 'lucide-react';
import { SessionStatus } from '@/types/session';

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CONNECTED: {
    label: 'Connected',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    icon: <Wifi className="w-3.5 h-3.5" />,
  },
  DISCONNECTED: {
    label: 'Disconnected',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    icon: <WifiOff className="w-3.5 h-3.5" />,
  },
  PENDING: {
    label: 'Pending',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  LOADING: {
    label: 'Loading',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
  QR_READY: {
    label: 'Scan QR',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    icon: <QrCode className="w-3.5 h-3.5" />,
  },
  INITIALIZING: {
    label: 'Initializing',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DISCONNECTED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
