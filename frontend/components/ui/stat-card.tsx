'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatCardAccent = 'green' | 'purple' | 'neutral' | 'red' | 'amber' | 'blue';

interface StatCardProps {
  label: string; // small uppercase label, e.g. "MESSAGES SENT"
  value: string | number; // hero number, e.g. "12,840" or 94
  sub?: string; // optional supporting line below value, e.g. "of 15,000 total"
  icon?: LucideIcon;
  accent?: StatCardAccent; // which color the icon + value get
  trend?: {
    value: string; // e.g. "+12%" or "−3"
    direction: 'up' | 'down' | 'flat';
  };
  className?: string;
}

// ─── Token map ────────────────────────────────────────────────────────────────

const ACCENT_STYLES: Record<StatCardAccent, { icon: string; iconBg: string; value: string }> = {
  green: {
    icon: 'text-[hsl(var(--green))]',
    iconBg: 'bg-[hsl(var(--green))]/10',
    value: 'text-[hsl(var(--foreground))]',
  },
  purple: {
    icon: 'text-[hsl(var(--purple))]',
    iconBg: 'bg-[hsl(var(--purple))]/10',
    value: 'text-[hsl(var(--foreground))]',
  },
  neutral: {
    icon: 'text-[hsl(var(--muted-foreground))]',
    iconBg: 'bg-[hsl(var(--muted))]',
    value: 'text-[hsl(var(--foreground))]',
  },
  red: { icon: 'text-red-400', iconBg: 'bg-red-500/10', value: 'text-[hsl(var(--foreground))]' },
  amber: { icon: 'text-amber-400', iconBg: 'bg-amber-500/10', value: 'text-[hsl(var(--foreground))]' },
  blue: { icon: 'text-blue-400', iconBg: 'bg-blue-500/10', value: 'text-[hsl(var(--foreground))]' },
};

const TREND_STYLES = {
  up: 'text-[hsl(var(--green))]',
  down: 'text-red-400',
  flat: 'text-[hsl(var(--muted-foreground))]',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, sub, icon: Icon, accent = 'neutral', trend, className }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border border-[hsl(var(--border))]',
        'bg-[hsl(var(--card))] px-5 py-4',
        className,
      )}
    >
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
        {Icon && (
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', styles.iconBg)}>
            <Icon size={14} className={styles.icon} />
          </span>
        )}
      </div>

      {/* Hero value */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={cn('text-2xl font-bold leading-none tracking-tight', styles.value)}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {sub && <span className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{sub}</span>}
        </div>
        {trend && (
          <span className={cn('text-xs font-medium tabular-nums', TREND_STYLES[trend.direction])}>{trend.value}</span>
        )}
      </div>
    </div>
  );
}
