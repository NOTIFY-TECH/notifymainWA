'use client';

import { useMyAgentsPerformance } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { TrendingUp, Loader2, Users, Lock, MessageSquare, CheckCircle2, Megaphone } from 'lucide-react';

// ─── Access-denied state ───────────────────────────────────────────────────────
// Mirrors TeamAccessDenied's styling in settings/team/page.tsx. This page is
// its own top-level route (not under Settings → Team, which is Admin/Owner
// only), so it needs its own gate for every non-Manager role.

function PerformanceAccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
        <Lock size={16} className="text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">You don&apos;t have access to this page</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
          Team performance is only available to Managers, scoped to their own agents.
        </p>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TeamPerformancePage() {
  const role = useAuthStore(s => s.user?.role);

  if (role !== 'MANAGER') {
    return <PerformanceAccessDenied />;
  }

  return <TeamPerformanceContent />;
}

function TeamPerformanceContent() {
  const { data: agents, isLoading } = useMyAgentsPerformance();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/12 text-blue-400">
          <TrendingUp size={16} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[hsl(var(--foreground))]">Team Performance</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {agents ? `${agents.length} agent${agents.length !== 1 ? 's' : ''} reporting to you` : '—'}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : !agents?.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users size={32} className="text-[hsl(var(--muted-foreground))] opacity-40" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No agents assigned to you yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.4]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Agent
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare size={11} />
                    Messages sent
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Conversations handled
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={11} />
                    Resolved
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1.5">
                    <Megaphone size={11} />
                    Campaigns created
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, idx) => (
                <tr
                  key={agent.id}
                  className={`border-b border-[hsl(var(--border))] last:border-0 ${idx % 2 === 0 ? '' : 'bg-[hsl(var(--muted))/0.2]'}`}
                >
                  {/* Agent */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-semibold">
                        {agent.name
                          .split(' ')
                          .map(p => p[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate flex items-center gap-1.5">
                          {agent.name}
                          {!agent.isActive && (
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-normal">
                              (inactive)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{agent.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-[hsl(var(--foreground))] tabular-nums">{agent.messagesSent}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[hsl(var(--foreground))] tabular-nums">
                      {agent.conversationsHandled}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[hsl(var(--foreground))] tabular-nums">
                      {agent.conversationsResolved}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[hsl(var(--foreground))] tabular-nums">{agent.campaignsCreated}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
