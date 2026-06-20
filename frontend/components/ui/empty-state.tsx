'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  accent?: 'green' | 'purple' | 'neutral';
  size?: 'sm' | 'md'; // sm for inline/card use, md for full-page
  className?: string;
}

// ─── Token map ────────────────────────────────────────────────────────────────

const ACCENT_STYLES = {
  green: {
    iconWrap: 'bg-[hsl(var(--green))]/12 text-[hsl(var(--green))]',
    btn: 'bg-[hsl(var(--green))]/15 border border-[hsl(var(--green))]/30 text-[hsl(var(--green))] hover:bg-[hsl(var(--green))]/25',
  },
  purple: {
    iconWrap: 'bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))]',
    btn: 'bg-[hsl(var(--purple))]/15 border border-[hsl(var(--purple))]/30 text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple))]/25',
  },
  neutral: { iconWrap: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]', btn: '' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  accent = 'purple',
  size = 'md',
  className,
}: EmptyStateProps) {
  const styles = ACCENT_STYLES[accent];
  const iconSize = size === 'sm' ? 16 : 20;
  const wrapSize = size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  const py = size === 'sm' ? 'py-10' : 'py-16';

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', py, className)}>
      <div className={cn('flex shrink-0 items-center justify-center rounded-full', wrapSize, styles.iconWrap)}>
        <Icon size={iconSize} />
      </div>

      <div className="flex flex-col gap-1">
        <p className={cn('font-medium text-[hsl(var(--foreground))]', size === 'sm' ? 'text-sm' : 'text-sm')}>
          {title}
        </p>
        {description && <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">{description}</p>}
      </div>

      {action && (
        <Button size="sm" onClick={action.onClick} className={cn('mt-1 inline-flex items-center gap-2', styles.btn)}>
          {action.icon && <action.icon size={14} />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
