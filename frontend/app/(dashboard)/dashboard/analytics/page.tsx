'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { analyticsApi } from '@/services/analytics-api';
import { AnalyticsPeriod } from '@/types/analytics';
import {
  MessageSquare,
  Users,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  MessagesSquare,
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
import { format, parseISO, formatDistanceToNow } from 'date-fns';

// ─── Period Selector ──────────────────────────────────────────────────────────

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '24h', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// ─── Colors ───────────────────────────────────────────────────────────────────

const PIE_COLORS = {
  delivered: 'hsl(134 61% 41%)',
  read: 'hsl(263 70% 56%)',
  failed: 'hsl(0 84% 60%)',
  pending: 'hsl(215 16% 47%)',
};

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-[hsl(var(--green-dim))] text-[hsl(var(--green))]',
  READ: 'bg-[hsl(var(--purple-dim))] text-[hsl(var(--purple))]',
  FAILED: 'bg-red-500/10 text-red-400',
  SENT: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  PENDING: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, period: AnalyticsPeriod): string {
  try {
    return format(parseISO(dateStr), period === '24h' ? 'HH:mm' : 'MMM d');
  } catch {
    return dateStr;
  }
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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
    <div className="glass card-hover rounded-[var(--radius)] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
          <Icon size={18} className="text-[hsl(var(--green))]" />
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded bg-[hsl(var(--muted))]" />
      ) : (
        <p className="text-2xl sm:text-3xl font-bold text-[hsl(var(--foreground))]">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-lg ml-1 text-[hsl(var(--muted-foreground))]">{suffix}</span>}
        </p>
      )}

      {delta !== undefined && !loading && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isPositive && 'text-[hsl(var(--green))]',
            isNegative && 'text-[hsl(var(--destructive))]',
            !isPositive && !isNegative && 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          {isPositive && <TrendingUp size={13} />}
          {isNegative && <TrendingDown size={13} />}
          {!isPositive && !isNegative && <Minus size={13} />}
          <span>
            {delta > 0 ? '+' : ''}
            {delta}% vs last period
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <div className="w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" style={{ height }} />;
}

function EmptyChart({ height = 280 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]" style={{ height }}>
      No data for this period
    </div>
  );
}

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────

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
    <div className="glass rounded-[var(--radius)] p-3 text-xs space-y-1 shadow-xl">
      <p className="font-medium text-[hsl(var(--foreground))] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[hsl(var(--muted-foreground))] capitalize">{p.name}:</span>
          <span className="font-medium text-[hsl(var(--foreground))]">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Activity Panel ─────────────────────────────────────────────────────
// Single merged panel — replaces the former "Recent Conversations" +
// "Recent Messages" pair, which both queried the exact same getRecentMessages
// feed and only differed by client-side dedup, causing the same info to show
// twice. This panel dedupes by contact (most recent message per contact) so
// each row is a distinct conversation, while still showing the full message
// detail (direction, body, status, time) that the old "Recent Messages" panel
// had. Full-width — no more two half-width columns showing overlapping data.

function RecentActivityPanel({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'recent-messages', tenantId],
    queryFn: () => analyticsApi.getRecentMessages(tenantId, 30),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const messages = data?.data ?? [];

  // Deduplicate by displayName — keep only the most recent message per contact
  const activity = (() => {
    const seen = new Set<string>();
    const result: typeof messages = [];
    for (const msg of messages) {
      if (seen.has(msg.displayName)) continue;
      seen.add(msg.displayName);
      result.push(msg);
      if (result.length >= 12) break;
    }
    return result;
  })();

  return (
    <div className="glass rounded-[var(--radius)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Recent Activity</h2>
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]/60">Auto-refreshes every 30s</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <MessagesSquare size={32} className="text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No activity yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-[hsl(var(--border))]">
          {activity.map(item => {
            const isInbound = item.direction === 'INBOUND';
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3 sm:border-b sm:border-[hsl(var(--border))] last:border-b-0"
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase',
                    isInbound
                      ? 'bg-[hsl(var(--green))]/10 text-[hsl(var(--green))]'
                      : 'bg-[hsl(var(--purple))]/10 text-[hsl(var(--purple))]',
                  )}
                >
                  {item.displayName.charAt(0)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                      {item.displayName}
                    </span>
                    <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]/60">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isInbound ? (
                      <ArrowDownLeft size={11} className="shrink-0 text-[hsl(var(--green))]" />
                    ) : (
                      <ArrowUpRight size={11} className="shrink-0 text-[hsl(var(--purple))]" />
                    )}
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {item.body || <span className="italic">Media message</span>}
                    </p>
                  </div>
                </div>

                {/* Outbound status badge */}
                {!isInbound && item.status && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      STATUS_STYLES[item.status] ?? STATUS_STYLES['PENDING'],
                    )}
                  >
                    {item.status.toLowerCase()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { tenant } = useAuthStore();
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const tenantId = tenant?.id ?? '';

  const {
    data: overviewData,
    isLoading: overviewLoading,
    refetch,
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

  const overview = overviewData?.data;
  const timeSeries = timeSeriesData?.data ?? [];
  const delivery = deliveryData?.data;

  const chartData = timeSeries.map(point => ({
    ...point,
    date: formatDate(point.date, period),
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
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            <span className="gradient-text">Analytics</span>
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Message performance and delivery insights for {tenant?.name ?? 'your workspace'}
          </p>
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
            onClick={() => refetch()}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
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

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeseries */}
        <div className="lg:col-span-2 glass rounded-[var(--radius)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Message Activity</h2>
            <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(134_61%_41%)]" />
                Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(263_70%_56%)]" />
                Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(0_84%_60%)]" />
                Failed
              </span>
            </div>
          </div>
          {timeSeriesLoading ? (
            <ChartSkeleton />
          ) : chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(134 61% 41%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(134 61% 41%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(263 70% 56%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(263 70% 56%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 16%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="hsl(134 61% 41%)"
                  strokeWidth={2}
                  fill="url(#gradSent)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="hsl(263 70% 56%)"
                  strokeWidth={2}
                  fill="url(#gradDelivered)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="hsl(0 84% 60%)"
                  strokeWidth={2}
                  fill="url(#gradFailed)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Delivery Breakdown */}
        <div className="glass rounded-[var(--radius)] p-5">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Delivery Breakdown</h2>
          {deliveryLoading ? (
            <ChartSkeleton />
          ) : pieData.length === 0 ? (
            <EmptyChart />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
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
                      background: 'hsl(215 28% 9%)',
                      border: '1px solid hsl(215 28% 16%)',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
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

      {/* ── Recent Activity — single merged panel, full width ── */}
      <RecentActivityPanel tenantId={tenantId} />
    </div>
  );
}
