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
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
];

// ─── Colors ───────────────────────────────────────────────────────────────────

const PIE_COLORS = {
  delivered: '#16a34a',
  read: '#7c3aed',
  failed: '#ef4444',
  pending: '#cbd5e1',
};

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-[hsl(var(--green-dim))] text-[hsl(var(--green))]',
  READ: 'bg-[hsl(var(--purple-dim))] text-[hsl(var(--purple))]',
  FAILED: 'bg-red-50 text-red-500',
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
  hero,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number | string;
  delta?: number;
  icon: React.ElementType;
  loading?: boolean;
  suffix?: string;
  hero?: boolean;
  iconBg?: string;
  iconColor?: string;
}) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  if (hero) {
    return (
      <div className="relative rounded-[var(--radius-lg)] p-5 overflow-hidden bg-[hsl(var(--green))] text-white shadow-[0_4px_20px_hsl(142_71%_35%/0.3)]">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -right-2 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-[600] uppercase tracking-[0.08em] text-white/70">{label}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <Icon size={14} className="text-white" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-white/20 mb-3" />
          ) : (
            <p className="text-[32px] font-[700] tracking-tight leading-none mb-3">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {suffix && <span className="text-lg ml-1 text-white/70">{suffix}</span>}
            </p>
          )}
          {delta !== undefined && !loading && (
            <div className="flex items-center gap-1 text-[11.5px] font-[500] text-white/80">
              {isPositive && <TrendingUp size={11} />}
              {isNegative && <TrendingDown size={11} />}
              {!isPositive && !isNegative && <Minus size={11} />}
              <span>
                {delta > 0 ? '+' : ''}
                {delta}% vs last period
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] p-5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-sm)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-[600] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg ?? 'bg-[hsl(var(--muted))]')}>
          <Icon size={14} className={iconColor ?? 'text-[hsl(var(--green))]'} />
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-20 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
      ) : (
        <p className="text-[28px] font-[700] tracking-tight leading-none text-[hsl(var(--foreground))]">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-lg ml-1 text-[hsl(var(--muted-foreground))]">{suffix}</span>}
        </p>
      )}

      {delta !== undefined && !loading && (
        <div
          className={cn(
            'flex items-center gap-1 text-[11.5px] font-[500]',
            isPositive && 'text-emerald-500',
            isNegative && 'text-red-500',
            !isPositive && !isNegative && 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          {isPositive && <TrendingUp size={11} />}
          {isNegative && <TrendingDown size={11} />}
          {!isPositive && !isNegative && <Minus size={11} />}
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
    <div
      className="flex flex-col items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]"
      style={{ height }}
    >
      <MessageSquare size={22} className="opacity-20" />
      <p className="text-[13px]">No data for this period</p>
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
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-[12px] shadow-[var(--shadow-lg)] space-y-1">
      <p className="font-[600] text-[hsl(var(--foreground))] mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[hsl(var(--muted-foreground))] capitalize">{p.name}:</span>
          <span className="font-[600] text-[hsl(var(--foreground))]">{p.value.toLocaleString()}</span>
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
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))]">Recent Activity</h2>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
            <MessagesSquare size={18} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-[13px] font-[500] text-[hsl(var(--foreground))]">No activity yet</p>
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
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-[600] uppercase',
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
                    <span className="text-[12.5px] font-[600] text-[hsl(var(--foreground))] truncate">
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
                    <p className="text-[12px] text-[hsl(var(--muted-foreground))] truncate">
                      {item.body || <span className="italic">Media message</span>}
                    </p>
                  </div>
                </div>

                {/* Outbound status badge */}
                {!isInbound && item.status && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-[600] uppercase tracking-[0.04em]',
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

  const totalDelivery = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-[700] tracking-tight text-[hsl(var(--foreground))]">
            <span className="gradient-text">Analytics</span>
          </h1>
          <p className="text-[12.5px] text-[hsl(var(--muted-foreground))] mt-0.5">
            Message performance and delivery insights for {tenant?.name ?? 'your workspace'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[hsl(var(--muted))] rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11.5px] font-[500] transition-all duration-150',
                  period === p.value
                    ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-[var(--shadow-sm)]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shadow-[var(--shadow-sm)]"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Total Messages"
          value={overview?.totalMessages ?? 0}
          delta={overview?.messagesDelta}
          icon={MessageSquare}
          loading={overviewLoading}
          hero
        />
        <KpiCard
          label="Total Contacts"
          value={overview?.totalContacts ?? 0}
          delta={overview?.contactsDelta}
          icon={Users}
          loading={overviewLoading}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
        <KpiCard
          label="Active Sessions"
          value={overview?.activeSessions ?? 0}
          icon={Smartphone}
          loading={overviewLoading}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
        <KpiCard
          label="Delivery Rate"
          value={overview?.deliveryRate ?? 0}
          icon={TrendingUp}
          loading={overviewLoading}
          suffix="%"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeseries */}
        <div className="lg:col-span-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))]">Message Activity</h2>
            <div className="flex items-center gap-3 text-[11.5px] text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
                Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
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
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10.5, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10.5, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#gradSent)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#gradDelivered)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradFailed)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Delivery Breakdown */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)] flex flex-col">
          <h2 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))] mb-4">Delivery Breakdown</h2>
          {deliveryLoading ? (
            <ChartSkeleton height={200} />
          ) : pieData.length === 0 ? (
            <EmptyChart height={200} />
          ) : (
            <>
              {/* Donut with center label */}
              <div className="relative flex items-center justify-center">
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
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.key} fill={PIE_COLORS[entry.key as keyof typeof PIE_COLORS]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={value => [Number(value).toLocaleString(), '']}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: 'var(--shadow-md)',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[20px] font-[700] text-[hsl(var(--foreground))] leading-none">
                    {totalDelivery.toLocaleString()}
                  </p>
                  <p className="text-[10.5px] text-[hsl(var(--muted-foreground))] mt-1">total</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {pieData.map(entry => {
                  const pct = totalDelivery > 0 ? Math.round((entry.value / totalDelivery) * 100) : 0;
                  return (
                    <div key={entry.key} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[entry.key as keyof typeof PIE_COLORS] }}
                        />
                        <span className="text-[hsl(var(--muted-foreground))]">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5 tabular-nums">
                        <span className="font-[500] text-[hsl(var(--foreground))]">{entry.value.toLocaleString()}</span>
                        <span className="text-[hsl(var(--muted-foreground))] w-7 text-right">{pct}%</span>
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
