'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCampaign, useCancelCampaign } from '@/hooks/useCampaigns';
import CampaignStatusBadge from '@/components/campaigns/CampaignStatusBadge';
import CampaignProgress from '@/components/campaigns/CampaignProgress';
import CampaignContactTable from '@/components/campaigns/CampaignContactsTable';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Megaphone, Ban } from 'lucide-react';
import { format } from 'date-fns';

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;

  const { data: campaign, isLoading } = useCampaign(campaignId);
  const cancelCampaign = useCancelCampaign(campaignId);

  const handleCancel = () => {
    if (confirm('Cancel this campaign? Pending messages will not be sent.')) {
      cancelCampaign.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-sm text-[hsl(var(--foreground))]">Campaign not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/campaigns')}>
          Back to campaigns
        </Button>
      </div>
    );
  }

  const canCancel = campaign.status === 'RUNNING' || campaign.status === 'SCHEDULED';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/campaigns')}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]">
          <Megaphone size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-[hsl(var(--foreground))] truncate">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
            {campaign.session ? `via ${campaign.session.name}` : ''}
            {campaign.session && ' · '}
            Created {format(new Date(campaign.createdAt), 'MMM d, yyyy · HH:mm')}
          </p>
        </div>

        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelCampaign.isPending}
            className="inline-flex items-center gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <Ban className="w-3.5 h-3.5" />
            {cancelCampaign.isPending ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>

      {/* Message preview */}
      <div className="rounded-lg bg-[hsl(var(--muted))] px-4 py-3">
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-1">Message</p>
        <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{campaign.messageTemplate}</p>
        {campaign.mediaUrl && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5 truncate">Media: {campaign.mediaUrl}</p>
        )}
      </div>

      {/* Progress */}
      <div className="rounded-lg border border-[hsl(var(--border))] px-4 py-3.5">
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">Progress</p>
        <CampaignProgress
          sentCount={campaign.sentCount}
          deliveredCount={campaign.deliveredCount}
          readCount={campaign.readCount}
          failedCount={campaign.failedCount}
          totalContacts={campaign.totalContacts}
        />
      </div>

      {/* Per-contact status table */}
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">
          Recipients ({campaign.contacts.length})
        </p>
        <CampaignContactTable contacts={campaign.contacts} />
      </div>
    </div>
  );
}
