'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuthStore } from '@/store/authStore';
import { AuditAction, AuditLogEntry } from '@/types/audit-log';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Created',
  READ: 'Read',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  DOWNLOAD: 'Downloaded',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  SESSION_CONNECT: 'Session connected',
  SESSION_DISCONNECT: 'Session disconnected',
  CAMPAIGN_START: 'Campaign started',
  CAMPAIGN_STOP: 'Campaign stopped',
  API_KEY_CREATE: 'API key created',
  API_KEY_REVOKE: 'API key revoked',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'text-emerald-400 bg-emerald-500/10',
  READ: 'text-sky-400 bg-sky-500/10',
  UPDATE: 'text-amber-400 bg-amber-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
  DOWNLOAD: 'text-sky-400 bg-sky-500/10',
  LOGIN: 'text-emerald-400 bg-emerald-500/10',
  LOGOUT: 'text-slate-400 bg-slate-500/10',
  SESSION_CONNECT: 'text-emerald-400 bg-emerald-500/10',
  SESSION_DISCONNECT: 'text-amber-400 bg-amber-500/10',
  CAMPAIGN_START: 'text-purple-400 bg-purple-500/10',
  CAMPAIGN_STOP: 'text-amber-400 bg-amber-500/10',
  API_KEY_CREATE: 'text-sky-400 bg-sky-500/10',
  API_KEY_REVOKE: 'text-red-400 bg-red-500/10',
};

// Actions shown in the filter dropdown.
// API_KEY_CREATE and API_KEY_REVOKE are intentionally excluded for all roles —
// they are logged internally but not surfaced as a filterable action.
const DROPDOWN_ACTIONS: AuditAction[] = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'DOWNLOAD',
  'LOGIN',
  'LOGOUT',
  'SESSION_CONNECT',
  'SESSION_DISCONNECT',
  'CAMPAIGN_START',
  'CAMPAIGN_STOP',
];

const LIMIT = 25;

export default function AuditLogPage() {
  const role = useAuthStore(s => s.user?.role);
  const router = useRouter();

  // Redirect AGENTs away — belt-and-suspenders on top of the layout tab hide
  // and the backend @Roles guard.
  useEffect(() => {
    if (role === 'AGENT') {
      router.replace('/dashboard/settings');
    }
  }, [role, router]);

  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = {
    page,
    limit: LIMIT,
    action: action || undefined,
    from: from || undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  };

  const { data, isLoading } = useAuditLog(query);
  const entries = data?.data ?? [];
  const meta = data?.meta;

  const handleFilterChange = () => setPage(1);

  if (role === 'AGENT') return null;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold">
          <span className="gradient-text">Audit Log</span>
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
          A record of actions taken in your workspace
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="glass rounded-[var(--radius)] p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-[140px]">
          <label className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Action
          </label>
          <select
            value={action}
            onChange={e => {
              setAction(e.target.value as AuditAction | '');
              handleFilterChange();
            }}
            className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
          >
            <option value="">All actions</option>
            {DROPDOWN_ACTIONS.map(a => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            From
          </label>
          <Input
            type="date"
            value={from}
            onChange={e => {
              setFrom(e.target.value);
              handleFilterChange();
            }}
            className="h-9 text-xs w-36"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">To</label>
          <Input
            type="date"
            value={to}
            onChange={e => {
              setTo(e.target.value);
              handleFilterChange();
            }}
            className="h-9 text-xs w-36"
          />
        </div>

        {(action || from || to) && (
          <Button
            size="sm"
            onClick={() => {
              setAction('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))] h-9"
          >
            Clear
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="glass rounded-[var(--radius)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
              <Shield size={22} className="text-[hsl(var(--muted-foreground))]" />
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No audit events found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                {['Time', 'User', 'Action', 'Entity', 'IP'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] first:pl-5 last:pr-5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {entries.map(entry => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, meta.total)} of {meta.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="px-2">
              {page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const colorClass = ACTION_COLORS[entry.action] ?? 'text-slate-400 bg-slate-500/10';

  return (
    <tr className="hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
      <td className="pl-5 pr-4 py-3 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
        {format(new Date(entry.createdAt), 'MMM d, yyyy HH:mm')}
      </td>
      <td className="px-4 py-3">
        <div className="text-xs font-medium text-[hsl(var(--foreground))]">
          {entry.user.firstName} {entry.user.lastName}
        </div>
        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{entry.user.email}</div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', colorClass)}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="font-medium text-[hsl(var(--foreground))]">{entry.entityType}</span>
        {entry.entityId && <span className="ml-1 font-mono text-[10px]">{entry.entityId.slice(0, 8)}…</span>}
      </td>
      <td className="pl-4 pr-5 py-3 text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
        {entry.ipAddress ?? '—'}
      </td>
    </tr>
  );
}
