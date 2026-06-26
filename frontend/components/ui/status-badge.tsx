'use client';

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusVariant =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'active'
  | 'inactive'
  | 'failed'
  | 'pending'
  | 'success';

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string; // override display text; defaults to capitalised status
  dot?: boolean; // show animated dot (default true for 'running'/'active')
  className?: string;
}

// ─── Token map ────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<StatusVariant, { pill: string; dot: string }> = {
  draft: {
    pill: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
    dot: 'bg-[hsl(var(--muted-foreground))]',
  },
  scheduled: { pill: 'bg-blue-500/10 text-blue-400 border-blue-500/25', dot: 'bg-blue-400' },
  running: {
    pill: 'bg-[hsl(var(--green))]/12 text-[hsl(var(--green))] border-[hsl(var(--green))]/30',
    dot: 'bg-[hsl(var(--green))]',
  },
  paused: { pill: 'bg-amber-500/10 text-amber-400 border-amber-500/25', dot: 'bg-amber-400' },
  completed: {
    pill: 'bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))] border-[hsl(var(--purple))]/30',
    dot: 'bg-[hsl(var(--purple))]',
  },
  cancelled: { pill: 'bg-red-500/10 text-red-400 border-red-500/25', dot: 'bg-red-400' },
  active: {
    pill: 'bg-[hsl(var(--green))]/12 text-[hsl(var(--green))] border-[hsl(var(--green))]/30',
    dot: 'bg-[hsl(var(--green))]',
  },
  inactive: {
    pill: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
    dot: 'bg-[hsl(var(--muted-foreground))]',
  },
  failed: { pill: 'bg-red-500/10 text-red-400 border-red-500/25', dot: 'bg-red-400' },
  pending: { pill: 'bg-amber-500/10 text-amber-400 border-amber-500/25', dot: 'bg-amber-400' },
  success: {
    pill: 'bg-[hsl(var(--green))]/12 text-[hsl(var(--green))] border-[hsl(var(--green))]/30',
    dot: 'bg-[hsl(var(--green))]',
  },
};

// Fallback for unknown/undefined status values
const FALLBACK_STYLES = {
  pill: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  dot: 'bg-[hsl(var(--muted-foreground))]',
};

// Statuses that get an animated pulse dot by default
const PULSE_STATUSES: StatusVariant[] = ['running', 'active'];

const DEFAULT_LABELS: Record<StatusVariant, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  active: 'Active',
  inactive: 'Inactive',
  failed: 'Failed',
  pending: 'Pending',
  success: 'Success',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusBadge({ status, label, dot, className }: StatusBadgeProps) {
  // Guard against unknown/undefined status values — falls back to neutral style
  const styles = VARIANT_STYLES[status] ?? FALLBACK_STYLES;
  const showDot = dot ?? PULSE_STATUSES.includes(status);
  const displayLabel = label ?? DEFAULT_LABELS[status] ?? String(status ?? '');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border',
        styles.pill,
        className,
      )}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              PULSE_STATUSES.includes(status) ? 'animate-ping' : '',
              styles.dot,
            )}
          />
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', styles.dot)} />
        </span>
      )}
      {displayLabel}
    </span>
  );
}
