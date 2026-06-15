'use client';

import { CampaignContact, CampaignContactStatus } from '@/types/campaign';

interface Props {
  contacts: CampaignContact[];
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: CampaignContactStatus }) {
  const map: Record<CampaignContactStatus, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' },
    SENT: { label: 'Sent', className: 'bg-blue-400/10 text-blue-400' },
    DELIVERED: { label: 'Delivered', className: 'bg-[#22C55E]/10 text-[hsl(var(--green))]' },
    READ: { label: 'Read', className: 'bg-[#22C55E]/20 text-[hsl(var(--green))] font-semibold' },
    FAILED: { label: 'Failed', className: 'bg-red-400/10 text-red-400' },
    OPTED_OUT: { label: 'Opted out', className: 'bg-yellow-400/10 text-yellow-500' },
  };
  const { label, className } = map[status] ?? map.PENDING;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${className}`}>{label}</span>;
}

// Resolve the most relevant timestamp for a contact
function resolvedTimestamp(c: CampaignContact): string {
  return formatTime(c.readAt ?? c.deliveredAt ?? c.sentAt ?? c.failedAt);
}

export default function CampaignContactsTable({ contacts }: Props) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] px-5 py-10 text-center">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No contacts attached to this campaign.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Recipients · {contacts.length}
        </p>
      </div>

      <div className="divide-y divide-[hsl(var(--border))]">
        {contacts.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
            {/* Avatar */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-semibold uppercase text-[hsl(var(--foreground))]">
              {c.phoneNumber.slice(-2)}
            </div>

            {/* Phone */}
            <p className="text-xs font-medium text-[hsl(var(--foreground))] flex-1 truncate">{c.phoneNumber}</p>

            {/* Retry count (only if > 0) */}
            {c.retryCount > 0 && (
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">×{c.retryCount}</span>
            )}

            {/* Error message tooltip-style */}
            {c.errorMessage && (
              <span title={c.errorMessage} className="text-[11px] text-red-400 max-w-[120px] truncate">
                {c.errorMessage}
              </span>
            )}

            {/* Timestamp */}
            <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0 w-14 text-right">
              {resolvedTimestamp(c)}
            </span>

            {/* Status badge */}
            <StatusBadge status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
