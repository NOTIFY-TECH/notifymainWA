'use client';

import { CampaignContact } from '@/types/campaign';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, Ban } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface CampaignContactTableProps {
  contacts: CampaignContact[];
}

function StatusIcon({ status }: { status: CampaignContact['status'] }) {
  switch (status) {
    case 'PENDING':
      return <Clock size={13} className="text-[hsl(var(--muted-foreground))]" />;
    case 'SENT':
      return <Check size={13} className="text-[hsl(var(--muted-foreground))]" />;
    case 'DELIVERED':
      return <CheckCheck size={13} className="text-[hsl(var(--green))]" />;
    case 'READ':
      return <CheckCheck size={13} className="text-blue-400" />;
    case 'FAILED':
      return <AlertCircle size={13} className="text-red-400" />;
    case 'OPTED_OUT':
      return <Ban size={13} className="text-[hsl(var(--muted-foreground))]" />;
    default:
      return null;
  }
}

function timestampFor(contact: CampaignContact): string | null {
  return contact.readAt ?? contact.deliveredAt ?? contact.sentAt ?? contact.failedAt ?? null;
}

export default function CampaignContactTable({ contacts }: CampaignContactTableProps) {
  if (contacts.length === 0) {
    return <p className="text-xs text-[hsl(var(--muted-foreground))] py-4">No recipients</p>;
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px] text-[hsl(var(--muted-foreground))]">Phone</TableHead>
            <TableHead className="text-[11px] text-[hsl(var(--muted-foreground))]">Status</TableHead>
            <TableHead className="text-[11px] text-[hsl(var(--muted-foreground))]">Updated</TableHead>
            <TableHead className="text-[11px] text-[hsl(var(--muted-foreground))]">Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map(contact => {
            const ts = timestampFor(contact);
            return (
              <TableRow key={contact.id}>
                <TableCell className="text-[hsl(var(--foreground))]">{contact.phoneNumber}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={contact.status} />
                    <span
                      className={cn(
                        'text-xs',
                        contact.status === 'FAILED' ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]',
                      )}
                    >
                      {contact.status.charAt(0) + contact.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                  {ts ? format(new Date(ts), 'MMM d, HH:mm') : '—'}
                </TableCell>
                <TableCell className="text-xs text-red-400 max-w-[200px] truncate whitespace-normal">
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
