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
  ChevronRight,
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
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
];

const PIE_COLORS = {
  delivered: '#16a34a',
  read: '#7c3aed',
  failed: '#ef4444',
  pending: '#cbd5e1',
};

const CAMPAIGN_STATUS: Record<string, { bg: string; text: string; dot: string }> = {
  RUNNING: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  SCHEDULED: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
  COMPLETED: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-300' },
};

// ─── Chart tooltip ────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();
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

  const { data: scheduledData, isLoading: scheduledLoading } = useQuery({
    queryKey: ['campaigns', 'scheduled', tenantId],
    queryFn: () => campaignsApi.list(tenantId, { status: 'SCHEDULED', limit: 5 }),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['campaigns', 'recent', tenantId],
    queryFn: () => campaignsApi.list(tenantId, { limit: 5 }),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const overview = overviewData?.data;
  const delivery = deliveryData?.data;
  const timeSeries = timeSeriesData?.data ?? [];

  const scheduledCampaigns = scheduledData?.data ?? [];
  const recentCampaigns = recentData?.data ?? [];
  const campaignsLoading = scheduledLoading || recentLoading;
  const scheduledIds = new Set(scheduledCampaigns.map(c => c.id));
  const displayedCampaigns = [...scheduledCampaigns, ...recentCampaigns.filter(c => !scheduledIds.has(c.id))].slice(
    0,
    6,
  );

  const chartData = timeSeries.map(pt => ({
    ...pt,
    date: (() => {
      try {
        return format(parseISO(pt.date), period === '24h' ? 'HH:mm' : 'MMM d');
      } catch {
        return pt.date;
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

  const totalDelivery = pieData.reduce((s, d) => s + d.value, 0);

  // ── KPI data ──────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Total Messages',
      value: overview?.totalMessages ?? 0,
      delta: overview?.messagesDelta,
      icon: MessageSquare,
      hero: true, // solid green card
    },
    {
      label: 'Total Contacts',
      value: overview?.totalContacts ?? 0,
      delta: overview?.contactsDelta,
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Active Sessions',
      value: overview?.activeSessions ?? 0,
      icon: Smartphone,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
    },
    {
      label: 'Delivery Rate',
      value: `${overview?.deliveryRate ?? 0}%`,
      icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
    },
  ];

  const quickActions = [
    {
      label: 'Sessions',
      sub: 'Manage devices',
      href: '/dashboard/sessions',
      icon: Smartphone,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      cardBg: 'bg-blue-50/80',
    },
    {
      label: 'Campaigns',
      sub: 'Broadcast messages',
      href: '/dashboard/campaigns',
      icon: Megaphone,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-500',
      cardBg: 'bg-violet-50/80',
    },
    {
      label: 'Inbox',
      sub: 'View conversations',
      href: '/dashboard/inbox',
      icon: MessageSquare,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      cardBg: 'bg-emerald-50/80',
    },
    {
      label: 'Contacts',
      sub: 'CRM & contacts',
      href: '/dashboard/contacts',
      icon: Users,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      cardBg: 'bg-amber-50/80',
    },
  ];

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-[600] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            {tenant?.name ?? 'Workspace'}
          </p>
          <h1 className="text-[20px] font-[700] tracking-tight text-[hsl(var(--foreground))] mt-0.5">
            Good {getTimeOfDay()}, <span className="text-[hsl(var(--green))]">{user?.firstName ?? 'there'}</span> 👋
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[11.5px] font-[500] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shadow-[var(--shadow-sm)]"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const isPositive = kpi.delta !== undefined && kpi.delta > 0;
          const isNegative = kpi.delta !== undefined && kpi.delta < 0;

          if (kpi.hero) {
            // ── Hero card — solid green ──
            return (
              <div
                key={i}
                className="relative col-span-2 xl:col-span-1 rounded-[var(--radius-lg)] p-5 overflow-hidden bg-[hsl(var(--green))] text-white shadow-[0_4px_20px_hsl(142_71%_35%/0.3)]"
              >
                {/* Decorative circles */}
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -right-2 h-32 w-32 rounded-full bg-white/5" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-[600] uppercase tracking-[0.08em] text-white/70">{kpi.label}</p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                      <Icon size={14} className="text-white" />
                    </div>
                  </div>
                  {overviewLoading ? (
                    <div className="h-8 w-20 animate-pulse rounded-lg bg-white/20 mb-3" />
                  ) : (
                    <p className="text-[32px] font-[700] tracking-tight leading-none mb-3">
                      {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                    </p>
                  )}
                  {kpi.delta !== undefined && !overviewLoading && (
                    <div className="flex items-center gap-1 text-[11.5px] font-[500] text-white/80">
                      {isPositive && <TrendingUp size={11} />}
                      {isNegative && <TrendingDown size={11} />}
                      {!isPositive && !isNegative && <Minus size={11} />}
                      <span>
                        {kpi.delta > 0 ? '+' : ''}
                        {kpi.delta}% vs last period
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ── Regular white card ──
          return (
            <div
              key={i}
              className="rounded-[var(--radius-lg)] p-5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-sm)] flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-[600] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
                  {kpi.label}
                </p>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', kpi.iconBg)}>
                  <Icon size={14} className={kpi.iconColor} />
                </div>
              </div>
              {overviewLoading ? (
                <div className="h-8 w-20 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
              ) : (
                <p className="text-[28px] font-[700] tracking-tight leading-none text-[hsl(var(--foreground))]">
                  {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                </p>
              )}
              {kpi.delta !== undefined && !overviewLoading && (
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
                    {kpi.delta > 0 ? '+' : ''}
                    {kpi.delta}% vs last period
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                'group relative flex flex-col justify-between gap-8 rounded-[var(--radius-lg)] p-4 overflow-hidden',
                'border border-transparent shadow-[var(--shadow-sm)]',
                'hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-150',
                action.cardBg,
              )}
            >
              {/* Icon top-right */}
              <div className="flex items-center justify-between">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 shadow-sm')}>
                  <Icon size={16} className={action.iconColor} />
                </div>
                <ChevronRight
                  size={13}
                  className={cn('opacity-40 group-hover:opacity-80 transition-opacity', action.iconColor)}
                />
              </div>
              {/* Label bottom */}
              <div>
                <p className="text-[13.5px] font-[700] text-[hsl(var(--foreground))]">{action.label}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{action.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)]">
          {/* Chart header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))]">Message Activity</h2>
              <p className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-0.5">Sent vs delivered over time</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Period tabs */}
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
              <Link
                href="/dashboard/analytics"
                className="flex items-center gap-1 text-[11.5px] font-[500] text-[hsl(var(--green))] hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                Full report <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
              <span className="text-[11.5px] text-[hsl(var(--muted-foreground))]">Sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
              <span className="text-[11.5px] text-[hsl(var(--muted-foreground))]">Delivered</span>
            </div>
          </div>

          {timeSeriesLoading ? (
            <div className="h-[200px] animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
          ) : chartData.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]">
              <MessageSquare size={22} className="opacity-20" />
              <p className="text-[13px]">No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 2, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 16% 91%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10.5, fill: 'hsl(220 12% 62%)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10.5, fill: 'hsl(220 12% 62%)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(220 16% 88%)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#gSent)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#gDelivered)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Delivery donut */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)] flex flex-col">
          <div className="mb-4">
            <h2 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))]">Delivery</h2>
            <p className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-0.5">Breakdown by status</p>
          </div>

          {deliveryLoading ? (
            <div className="flex-1 animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))] min-h-[160px]" />
          ) : pieData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-[hsl(var(--muted-foreground))]">
              No data
            </div>
          ) : (
            <>
              {/* Donut with center label */}
              <div className="relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.key} fill={PIE_COLORS[entry.key as keyof typeof PIE_COLORS]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={v => [Number(v).toLocaleString(), '']}
                      contentStyle={{
                        background: 'hsl(0 0% 100%)',
                        border: '1px solid hsl(220 16% 88%)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
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

              {/* Legend */}
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

      {/* ── Campaigns ────────────────────────────────────────────────────────── */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))]">Campaigns</h2>
            <p className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-0.5">Scheduled &amp; recent activity</p>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-1 text-[12px] font-[500] text-[hsl(var(--green))] hover:opacity-80 transition-opacity"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        <div className="p-5">
          {campaignsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
              ))}
            </div>
          ) : displayedCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
                <Megaphone size={18} className="text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[13px] font-[500] text-[hsl(var(--foreground))]">No campaigns yet</p>
                <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Scheduled and recent campaigns appear here
                </p>
              </div>
              <Link
                href="/dashboard/campaigns"
                className="mt-1 px-4 py-2 rounded-lg bg-[hsl(var(--green-dim))] text-[hsl(var(--green))] text-[12.5px] font-[500] hover:opacity-80 transition-opacity"
              >
                Create campaign
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayedCampaigns.map(campaign => {
                const total = campaign.totalContacts ?? 0;
                const sent = campaign.sentCount ?? 0;
                const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
                const isScheduled = campaign.status === 'SCHEDULED';
                const style = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS['DRAFT'];

                return (
                  <Link
                    key={campaign.id}
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="group flex flex-col gap-3 p-4 rounded-[var(--radius)] border border-[hsl(var(--border))] hover:border-[hsl(var(--green))/30%] hover:shadow-[var(--shadow-sm)] transition-all duration-150 bg-[hsl(var(--background))]"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            isScheduled ? 'bg-violet-50' : 'bg-emerald-50',
                          )}
                        >
                          {isScheduled ? (
                            <Clock size={14} className="text-violet-500" />
                          ) : (
                            <PlayCircle size={14} className="text-emerald-500" />
                          )}
                        </div>
                        <p className="text-[12.5px] font-[600] text-[hsl(var(--foreground))] truncate">
                          {campaign.name}
                        </p>
                      </div>
                      {/* Status badge */}
                      <div className={cn('shrink-0 flex items-center gap-1.5 rounded-full px-2 py-0.5', style.bg)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                        <span className={cn('text-[10px] font-[600] uppercase tracking-[0.04em]', style.text)}>
                          {campaign.status.toLowerCase()}
                        </span>
                      </div>
                    </div>

                    {/* Bottom: progress or schedule */}
                    {isScheduled && campaign.scheduledAt ? (
                      <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">
                        Scheduled: {format(parseISO(campaign.scheduledAt), 'MMM d, HH:mm')}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
                          <span>{sent.toLocaleString()} sent</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[hsl(var(--green))] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
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
