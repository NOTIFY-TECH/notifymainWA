'use client';

import { CampaignContact } from '@/types/campaign';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, Ban } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface CampaignContactTableProps {
  contacts: CampaignContact[];
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CampaignContact['status'] }) {
  switch (status) {
    case 'PENDING':
      return <Clock size={12} className="text-[hsl(var(--muted-foreground))]" />;
    case 'SENT':
      return <Check size={12} className="text-slate-400" />;
    case 'DELIVERED':
      return <CheckCheck size={12} className="text-[hsl(var(--green))]" />;
    case 'READ':
      return <CheckCheck size={12} className="text-blue-400" />;
    case 'FAILED':
      return <AlertCircle size={12} className="text-red-400" />;
    case 'OPTED_OUT':
      return <Ban size={12} className="text-[hsl(var(--muted-foreground))]" />;
    default:
      return null;
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<CampaignContact['status'], string> = {
  PENDING: 'bg-slate-100 text-slate-500',
  SENT: 'bg-slate-100 text-slate-500',
  DELIVERED: 'bg-emerald-50 text-emerald-600',
  READ: 'bg-blue-50 text-blue-500',
  FAILED: 'bg-red-50 text-red-500',
  OPTED_OUT: 'bg-slate-100 text-slate-400',
};

const STATUS_LABEL: Record<CampaignContact['status'], string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  READ: 'Read',
  FAILED: 'Failed',
  OPTED_OUT: 'Opted out',
};

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function timestampFor(contact: CampaignContact): string | null {
  return contact.readAt ?? contact.deliveredAt ?? contact.sentAt ?? contact.failedAt ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CampaignContactTable({ contacts }: CampaignContactTableProps) {
  if (contacts.length === 0) {
    return <p className="text-[12px] text-[hsl(var(--muted-foreground))] py-4">No recipients</p>;
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border))] overflow-hidden shadow-[var(--shadow-sm)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted))]">
            <TableHead className="text-[10px] font-[600] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">
              Phone
            </TableHead>
            <TableHead className="text-[10px] font-[600] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">
              Status
            </TableHead>
            <TableHead className="text-[10px] font-[600] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">
              Updated
            </TableHead>
            <TableHead className="text-[10px] font-[600] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">
              Error
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map(contact => {
            const ts = timestampFor(contact);
            return (
              <TableRow key={contact.id} className="hover:bg-[hsl(var(--muted))]/50">
                <TableCell className="text-[13px] font-[500] text-[hsl(var(--foreground))]">
                  {contact.phoneNumber}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-[600]',
                      STATUS_BADGE[contact.status],
                    )}
                  >
                    <StatusIcon status={contact.status} />
                    {STATUS_LABEL[contact.status]}
                  </span>
                </TableCell>
                <TableCell className="text-[12px] text-[hsl(var(--muted-foreground))]">
                  {ts ? format(new Date(ts), 'MMM d, HH:mm') : '—'}
                </TableCell>
                <TableCell className="text-[12px] text-red-400 max-w-[200px] truncate whitespace-normal">
                  {contact.errorMessage ?? ''}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
