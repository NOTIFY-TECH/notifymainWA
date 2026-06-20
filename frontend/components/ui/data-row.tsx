'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataRowProps {
  // Left: avatar-style icon
  icon: LucideIcon;
  iconAccent?: 'green' | 'purple' | 'neutral' | 'red' | 'amber' | 'blue';

  // Center: two-line text
  primary: string;
  secondary?: string;

  // Right: status + meta
  badge?: React.ReactNode; // pass a <StatusBadge /> or any node
  meta?: string; // small timestamp / count below the badge

  // Interaction
  onClick?: () => void;
  className?: string;
}

// ─── Token map ────────────────────────────────────────────────────────────────

const ICON_ACCENT_STYLES: Record<string, { wrap: string; icon: string }> = {
  green: { wrap: 'bg-[hsl(var(--green))]/12', icon: 'text-[hsl(var(--green))]' },
  purple: { wrap: 'bg-[hsl(var(--purple))]/12', icon: 'text-[hsl(var(--purple))]' },
  neutral: { wrap: 'bg-[hsl(var(--muted))]', icon: 'text-[hsl(var(--muted-foreground))]' },
  red: { wrap: 'bg-red-500/10', icon: 'text-red-400' },
  amber: { wrap: 'bg-amber-500/10', icon: 'text-amber-400' },
  blue: { wrap: 'bg-blue-500/10', icon: 'text-blue-400' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DataRow({
  icon: Icon,
  iconAccent = 'purple',
  primary,
  secondary,
  badge,
  meta,
  onClick,
  className,
}: DataRowProps) {
  const iconStyles = ICON_ACCENT_STYLES[iconAccent];

  const inner = (
    <>
      {/* Left: icon */}
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', iconStyles.wrap)}>
        <Icon size={15} className={iconStyles.icon} />
      </span>

      {/* Center: two-line text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{primary}</p>
        {secondary && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{secondary}</p>}
      </div>

      {/* Right: badge + meta */}
      {(badge || meta) && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {badge}
          {meta && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{meta}</span>}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-2.5 px-4 py-3.5 text-left',
          'rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
          'transition-colors hover:bg-[hsl(var(--muted))]',
          className,
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-4 py-3.5',
        'rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
        className,
      )}
    >
      {inner}
    </div>
  );
}
