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
  Megaphone,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ArrowRight,
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
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

// ─── Period Selector ──────────────────────────────────────────────────────────

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '24h', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'New Session', href: '/dashboard/sessions', icon: Smartphone, color: 'green' },
  { label: 'New Campaign', href: '/dashboard/campaigns', icon: Megaphone, color: 'purple' },
  { label: 'View Inbox', href: '/dashboard/inbox', icon: MessageSquare, color: 'green' },
  { label: 'Add Contact', href: '/dashboard/contacts', icon: Users, color: 'purple' },
] as const;

// ─── Pie Colors ───────────────────────────────────────────────────────────────

const PIE_COLORS = {
  delivered: 'hsl(134 61% 41%)',
  read: 'hsl(263 70% 56%)',
  failed: 'hsl(0 84% 60%)',
  pending: 'hsl(215 16% 47%)',
};

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
  const isNeutral = delta === undefined || delta === 0;

  return (
    <div className="glass card-hover rounded-[var(--radius)] p-5 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
          <Icon size={18} className="text-[hsl(var(--green))]" />
        </div>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded bg-[hsl(var(--muted))]" />
      ) : (
        <p className="text-2xl sm:text-3xl font-bold text-[hsl(var(--foreground))]">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-lg ml-1 text-[hsl(var(--muted-foreground))]">{suffix}</span>}
        </p>
      )}

      {/* Delta */}
      {delta !== undefined && !loading && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isPositive && 'text-[hsl(var(--green))]',
            isNegative && 'text-[hsl(var(--destructive))]',
            isNeutral && 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          {isPositive && <TrendingUp size={13} />}
          {isNegative && <TrendingDown size={13} />}
          {isNeutral && <Minus size={13} />}
          <span>
            {delta > 0 ? '+' : ''}
            {delta}% vs last period
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs text-[hsl(var(--green))] hover:underline">
          View all <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return <div className="h-[260px] w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />;
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const tenantId = tenant?.id ?? '';

  // ── Queries ──────────────────────────────────────────────────────────────────
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

  const overview = overviewData?.data;
  const timeSeries = timeSeriesData?.data ?? [];
  const delivery = deliveryData?.data;

  // Format timeseries dates for chart
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

  // Format delivery data for pie
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
            Good {getTimeOfDay()}, <span className="gradient-text"> {user?.firstName ?? 'there'} </span>
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Here&apos;s what&apos;s happening with {tenant?.name ?? 'your workspace'}
          </p>
        </div>

        {/* Period selector + refresh */}
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* ── Quick Actions ── */}
      <div>
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-2',
                  'rounded-[var(--radius)] border border-[hsl(var(--border))]',
                  'py-5 px-3 text-center',
                  'transition-all duration-150',
                  'hover:border-[hsl(var(--green))] hover:bg-[hsl(var(--green-dim))]',
                  'group',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    action.color === 'green' ? 'bg-[hsl(var(--green-dim))]' : 'bg-[hsl(var(--purple-dim))]',
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(action.color === 'green' ? 'text-[hsl(var(--green))]' : 'text-[hsl(var(--purple))]')}
                  />
                </div>
                <span className="text-xs font-medium text-[hsl(var(--foreground))]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart — spans 2 cols on large */}
        <div className="lg:col-span-2 glass rounded-[var(--radius)] p-5">
          <SectionHeader title="Message Activity" href="/dashboard/analytics" />
          {timeSeriesLoading ? (
            <ChartSkeleton />
          ) : chartData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(134 61% 41%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(134 61% 41%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(263 70% 56%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(263 70% 56%)" stopOpacity={0} />
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
                  fill="url(#colorSent)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="hsl(263 70% 56%)"
                  strokeWidth={2}
                  fill="url(#colorDelivered)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart — delivery rates */}
        <div className="glass rounded-[var(--radius)] p-5">
          <SectionHeader title="Delivery Breakdown" />
          {deliveryLoading ? (
            <ChartSkeleton />
          ) : pieData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
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
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Active Campaigns placeholder ── */}
      <div className="glass rounded-[var(--radius)] p-5">
        <SectionHeader title="Active Campaigns" href="/dashboard/campaigns" />
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <Megaphone size={32} className="text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No active campaigns — campaigns will appear here
          </p>
          <Link href="/dashboard/campaigns" className="btn-outline-green px-4 py-2 text-xs mt-2">
            Create campaign
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
