'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { analyticsApi } from '@/services/analytics-api';
import { campaignsApi } from '@/services/campaigns-api';
import { AnalyticsPeriod } from '@/types/analytics';
import {
  MessageSquare,
  Users,
  Smartphone,
  Megaphone,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ArrowRight,
  PlayCircle,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '24h', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

const QUICK_ACTIONS = [
  { label: 'New Session', href: '/dashboard/sessions', icon: Smartphone, color: 'green' },
  { label: 'New Campaign', href: '/dashboard/campaigns', icon: Megaphone, color: 'purple' },
  { label: 'View Inbox', href: '/dashboard/inbox', icon: MessageSquare, color: 'green' },
  { label: 'Add Contact', href: '/dashboard/contacts', icon: Users, color: 'purple' },
] as const;

const PIE_COLORS = {
  delivered: 'hsl(134 61% 41%)',
  read: 'hsl(263 70% 56%)',
  failed: 'hsl(0 84% 60%)',
  pending: 'hsl(215 16% 47%)',
};

// ─── Campaign status badge styles ─────────────────────────────────────────────

const CAMPAIGN_STATUS_STYLES: Record<string, string> = {
  RUNNING: 'bg-[hsl(var(--green-dim))] text-[hsl(var(--green))]',
  SCHEDULED: 'bg-[hsl(var(--purple-dim))] text-[hsl(var(--purple))]',
  COMPLETED: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  FAILED: 'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  DRAFT: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  loading,
  suffix,
}: {
  label: string;
  value: number | string;
  delta?: number;
  icon: React.ElementType;
  loading?: boolean;
  suffix?: string;
}) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
          <Icon size={15} className="text-[hsl(var(--green))]" />
        </div>
      </div>

      {loading ? (
        <div className="h-9 w-28 animate-pulse rounded bg-[hsl(var(--muted))]" />
      ) : (
        <p className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-base ml-1 font-normal text-[hsl(var(--muted-foreground))]">{suffix}</span>}
        </p>
      )}

      {delta !== undefined && !loading && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            isPositive && 'text-[hsl(var(--green))]',
            isNegative && 'text-[hsl(var(--destructive))]',
            !isPositive && !isNegative && 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          {isPositive && <TrendingUp size={12} />}
          {isNegative && <TrendingDown size={12} />}
          {!isPositive && !isNegative && <Minus size={12} />}
          <span>
            {delta > 0 ? '+' : ''}
            {delta}% vs last period
          </span>
        </div>
      )}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs shadow-xl space-y-1">
      <p className="font-medium text-[hsl(var(--foreground))] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[hsl(var(--muted-foreground))] capitalize">{p.name}:</span>
          <span className="font-medium text-[hsl(var(--foreground))]">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[240px] w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const tenantId = tenant?.id ?? '';

  const {
    data: overviewData,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['analytics', 'overview', tenantId, period],
    queryFn: () => analyticsApi.getOverview(tenantId, period),
    enabled: !!tenantId,
  });

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['analytics', 'timeseries', tenantId, period],
    queryFn: () => analyticsApi.getMessageTimeSeries(tenantId, period),
    enabled: !!tenantId,
  });

  const { data: deliveryData, isLoading: deliveryLoading } = useQuery({
    queryKey: ['analytics', 'delivery', tenantId, period],
    queryFn: () => analyticsApi.getDeliveryRates(tenantId, period),
    enabled: !!tenantId,
  });

  // ── Scheduled campaigns ─────────────────────────────────────────────────────
  const { data: scheduledData, isLoading: scheduledLoading } = useQuery({
    queryKey: ['campaigns', 'scheduled', tenantId],
    queryFn: () => campaignsApi.list(tenantId, { status: 'SCHEDULED', limit: 5 }),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  // ── Most recent campaigns (any status) — used to fill out the panel ───────
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['campaigns', 'recent', tenantId],
    queryFn: () => campaignsApi.list(tenantId, { limit: 5 }),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const overview = overviewData?.data;
  const timeSeries = timeSeriesData?.data ?? [];
  const delivery = deliveryData?.data;

  const scheduledCampaigns = scheduledData?.data ?? [];
  const recentCampaigns = recentData?.data ?? [];
  const campaignsLoading = scheduledLoading || recentLoading;

  const scheduledIds = new Set(scheduledCampaigns.map(c => c.id));
  const fillerCampaigns = recentCampaigns.filter(c => !scheduledIds.has(c.id));
  const displayedCampaigns = [...scheduledCampaigns, ...fillerCampaigns].slice(0, 5);

  const chartData = timeSeries.map(point => ({
    ...point,
    date: (() => {
      try {
        return format(parseISO(point.date), period === '24h' ? 'HH:mm' : 'MMM d');
      } catch {
        return point.date;
      }
    })(),
  }));

  const pieData = delivery
    ? [
        { name: 'Delivered', value: delivery.delivered, key: 'delivered' },
        { name: 'Read', value: delivery.read, key: 'read' },
        { name: 'Failed', value: delivery.failed, key: 'failed' },
        { name: 'Pending', value: delivery.pending, key: 'pending' },
      ].filter(d => d.value > 0)
    : [];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
            {tenant?.name ?? 'Workspace'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Good {getTimeOfDay()}, <span className="gradient-text">{user?.firstName ?? 'there'}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[var(--radius)] border border-[hsl(var(--border))] overflow-hidden">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-[hsl(var(--green))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetchOverview()}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Messages"
          value={overview?.totalMessages ?? 0}
          delta={overview?.messagesDelta}
          icon={MessageSquare}
          loading={overviewLoading}
        />
        <KpiCard
          label="Total Contacts"
          value={overview?.totalContacts ?? 0}
          delta={overview?.contactsDelta}
          icon={Users}
          loading={overviewLoading}
        />
        <KpiCard
          label="Active Sessions"
          value={overview?.activeSessions ?? 0}
          icon={Smartphone}
          loading={overviewLoading}
        />
        <KpiCard
          label="Delivery Rate"
          value={overview?.deliveryRate ?? 0}
          icon={TrendingUp}
          loading={overviewLoading}
          suffix="%"
        />
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-3',
                  'rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
                  'py-6 px-3 text-center',
                  'transition-all duration-150',
                  'hover:border-[hsl(var(--green)/0.5)] hover:bg-[hsl(var(--green-dim))]',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    action.color === 'green' ? 'bg-[hsl(var(--green-dim))]' : 'bg-[hsl(var(--purple-dim))]',
                  )}
                >
                  <Icon
                    size={18}
                    className={action.color === 'green' ? 'text-[hsl(var(--green))]' : 'text-[hsl(var(--purple))]'}
                  />
                </div>
                <span className="text-xs font-medium text-[hsl(var(--foreground))]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeseries */}
        <div className="lg:col-span-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Message Activity</h2>
            <Link
              href="/dashboard/analytics"
              className="flex items-center gap-1 text-xs text-[hsl(var(--green))] hover:underline"
            >
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {timeSeriesLoading ? (
            <ChartSkeleton />
          ) : chartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(134 61% 41%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(134 61% 41%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(263 70% 56%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(263 70% 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 14%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'hsl(215 16% 40%)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215 16% 40%)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="hsl(134 61% 41%)"
                  strokeWidth={1.5}
                  fill="url(#colorSent)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="hsl(263 70% 56%)"
                  strokeWidth={1.5}
                  fill="url(#colorDelivered)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Delivery pie */}
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Delivery Breakdown</h2>
          {deliveryLoading ? (
            <ChartSkeleton />
          ) : pieData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              No data for this period
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.key} fill={PIE_COLORS[entry.key as keyof typeof PIE_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={value => [Number(value).toLocaleString(), '']}
                    contentStyle={{
                      background: 'hsl(215 28% 11%)',
                      border: '1px solid hsl(215 28% 16%)',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Manual legend — number + percentage per row, matching analytics page */}
              <div className="mt-2 space-y-2">
                {pieData.map(entry => {
                  const total = pieData.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                  return (
                    <div key={entry.key} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[entry.key as keyof typeof PIE_COLORS] }}
                        />
                        <span className="text-[hsl(var(--muted-foreground))]">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[hsl(var(--foreground))]">
                          {entry.value.toLocaleString()}
                        </span>
                        <span className="text-[hsl(var(--muted-foreground))] w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Scheduled + Recent Campaigns ── */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Campaigns</h2>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-1 text-xs text-[hsl(var(--green))] hover:underline"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {campaignsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
            ))}
          </div>
        ) : displayedCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
              <Megaphone size={18} className="text-[hsl(var(--muted-foreground))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">No campaigns yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Scheduled and recent campaigns will appear here
              </p>
            </div>
            <Link href="/dashboard/campaigns" className="btn-outline-green px-4 py-2 text-xs mt-1">
              Create campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {displayedCampaigns.map(campaign => {
              const total = campaign.totalContacts ?? 0;
              const sent = campaign.sentCount ?? 0;
              const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
              const isScheduled = campaign.status === 'SCHEDULED';

              return (
                <Link
                  key={campaign.id}
                  href={`/dashboard/campaigns/${campaign.id}`}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      isScheduled ? 'bg-[hsl(var(--purple-dim))]' : 'bg-[hsl(var(--green-dim))]',
                    )}
                  >
                    {isScheduled ? (
                      <Clock size={16} className="text-[hsl(var(--purple))]" />
                    ) : (
                      <PlayCircle size={16} className="text-[hsl(var(--green))]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                        {campaign.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {isScheduled && campaign.scheduledAt
                          ? format(parseISO(campaign.scheduledAt), 'MMM d, HH:mm')
                          : `${sent.toLocaleString()} / ${total.toLocaleString()}`}
                      </span>
                    </div>
                    {!isScheduled && (
                      <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[hsl(var(--green))] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      CAMPAIGN_STATUS_STYLES[campaign.status] ?? CAMPAIGN_STATUS_STYLES['DRAFT'],
                    )}
                  >
                    {campaign.status.toLowerCase()}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
