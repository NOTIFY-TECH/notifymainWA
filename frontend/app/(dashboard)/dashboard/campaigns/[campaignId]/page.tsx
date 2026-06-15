'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useCampaign, useCancelCampaign } from '@/hooks/useCampaigns';
import CampaignProgress from '@/components/campaigns/CampaignProgress';
import CampaignContactsTable from '@/components/campaigns/CampaignContactsTable';
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, XCircle, Loader2 } from 'lucide-react';

interface Props {
  params: Promise<{ campaignId: string }>;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CampaignDetailPage({ params }: Props) {
  const { campaignId } = use(params);
  const router = useRouter();

  const { data: campaign, isLoading, isError } = useCampaign(campaignId);
  const { mutate: cancel, isPending: cancelling } = useCancelCampaign(campaignId);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4 pt-2">
        <Skeleton className="h-8 w-36" />
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-6 border-t border-[hsl(var(--border))] flex flex-col gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError || !campaign) {
    return (
      <div className="max-w-3xl mx-auto pt-12 text-center">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Campaign not found</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 mb-4">This campaign may have been deleted.</p>
        <button
          onClick={() => router.push('/dashboard/campaigns')}
          className="text-xs text-[hsl(var(--green))] hover:underline"
        >
          Back to campaigns
        </button>
      </div>
    );
  }

  const canCancel = campaign.status === 'RUNNING' || campaign.status === 'SCHEDULED';

  // ── Page ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-10">
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/campaigns')}
        className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All campaigns
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
        {/* Title row */}
        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-[hsl(var(--foreground))] truncate">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {campaign.session?.name ?? 'Unknown session'}
              {campaign.session?.phoneNumber ? ` · ${campaign.session.phoneNumber}` : ''}
            </p>
          </div>

          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => cancel()}
              className="shrink-0 text-red-400 border-red-400/30 hover:bg-red-400/10 hover:text-red-400"
            >
              {cancelling ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <XCircle size={13} className="mr-1.5" />
                  Cancel
                </>
              )}
            </Button>
          )}
        </div>

        {/* Meta row */}
        <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex flex-wrap gap-x-6 gap-y-1.5">
          <MetaItem label="Created" value={formatDate(campaign.createdAt)} />
          {campaign.scheduledAt && <MetaItem label="Scheduled" value={formatDate(campaign.scheduledAt)} />}
          {campaign.startedAt && <MetaItem label="Started" value={formatDate(campaign.startedAt)} />}
          {campaign.completedAt && <MetaItem label="Completed" value={formatDate(campaign.completedAt)} />}
          <MetaItem label="Rate limit" value={`${campaign.rateLimitPerMin}/min`} />
        </div>

        {/* Progress */}
        <div className="px-5 py-4 border-t border-[hsl(var(--border))]">
          <CampaignProgress campaign={campaign} />
        </div>

        {/* Message preview */}
        <div className="px-5 py-4 border-t border-[hsl(var(--border))] flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Message
          </p>
          <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed">
            {campaign.messageTemplate}
          </p>
          {campaign.mediaUrl && (
            <a
              href={campaign.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[hsl(var(--green))] hover:underline mt-0.5 truncate"
            >
              {campaign.mediaUrl}
            </a>
          )}
        </div>
      </div>

      {/* Contacts table */}
      <CampaignContactsTable contacts={campaign.contacts} />
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{label}</span>
      <span className="text-xs text-[hsl(var(--foreground))]">{value}</span>
    </div>
  );
}
