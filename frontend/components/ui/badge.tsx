import * as React from 'react';
import { cn } from '@/lib/utils';

/* ── Variant map ── */
const variantClasses = {
  default: 'badge-draft',
  draft: 'badge-draft',
  scheduled: 'badge-scheduled',
  running: 'badge-running',
  paused: 'badge-paused',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  green: 'badge-green',
  purple: 'badge-purple',
} as const;

export type BadgeVariant = keyof typeof variantClasses;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', dot = false, className, children, ...props }, ref) => (
    <span ref={ref} className={cn('badge', variantClasses[variant], dot && 'badge-dot', className)} {...props}>
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';

/* ── Convenience: Campaign Status Badge ── */
const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const CAMPAIGN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export interface CampaignStatusBadgeProps {
  status: string;
  dot?: boolean;
  className?: string;
}

const CampaignStatusBadge: React.FC<CampaignStatusBadgeProps> = ({ status, dot = true, className }) => (
  <Badge variant={CAMPAIGN_STATUS_VARIANT[status] ?? 'default'} dot={dot} className={className}>
    {CAMPAIGN_STATUS_LABELS[status] ?? status}
  </Badge>
);

export { Badge, CampaignStatusBadge };
