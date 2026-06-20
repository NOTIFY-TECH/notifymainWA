'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useCampaign, useCancelCampaign, useLaunchCampaign } from '@/hooks/useCampaigns';

import ResendCampaignModal from '@/components/campaigns/ResendCampaignModal';
import AddRecipientsModal from '@/components/campaigns/AddRecipientsModal';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { StatusBadge, StatusVariant } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import CampaignProgress from '@/components/campaigns/CampaignProgress';
import CampaignContactTable from '@/components/campaigns/CampaignContactsTable';
import { Button } from '@/components/ui/button';

import {
  ArrowLeft,
  Loader2,
  Megaphone,
  Ban,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  RotateCcw,
  UserPlus,
  Pencil,
  Rocket,
} from 'lucide-react';

import { format } from 'date-fns';
import { CampaignStatus } from '@/types/campaign';

// ─── Status map ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<CampaignStatus, StatusVariant> = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const searchParams = useSearchParams();

  // ── All hooks must be declared before any early return ───────────────────
  // (React requires stable hook call order across renders.)

  const { data: campaign, isLoading } = useCampaign(campaignId);
  const cancelCampaign = useCancelCampaign(campaignId);
  const launchCampaign = useLaunchCampaign(campaignId);

  const [resendModalOpen, setResendModalOpen] = useState(false);

  // Auto-open Add Recipients modal when redirected from a clone (?addRecipients=1)
  const [addRecipientsOpen, setAddRecipientsOpen] = useState(() => searchParams.get('addRecipients') === '1');

  // Edit panel — inline form below the header
  const [editOpen, setEditOpen] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCancel = () => {
    if (confirm('Cancel this campaign? Pending messages will not be sent.')) {
      cancelCampaign.mutate();
    }
  };

  const handleLaunch = () => {
    if (
      confirm(
        campaign?.scheduledAt
          ? `Schedule this campaign for ${format(new Date(campaign.scheduledAt), 'MMM d, yyyy · HH:mm')}?`
          : 'Launch this campaign now? It will start sending immediately.',
      )
    ) {
      launchCampaign.mutate();
    }
  };

  // ── Early returns (after all hooks) ──────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access to it."
        accent="neutral"
        action={{
          label: 'Back to campaigns',
          onClick: () => router.push('/dashboard/campaigns'),
          icon: ArrowLeft,
        }}
      />
    );
  }

  // ── Derived flags ─────────────────────────────────────────────────────────
  // Plain const derivations, not hooks — safe after early returns.

  const canCancel = campaign.status === 'RUNNING' || campaign.status === 'SCHEDULED';
  const canResend = campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED';
  const canEdit = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
  const canAddRecipients = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
  // Launch requires recipients — an empty campaign would instantly flip to COMPLETED
  // having sent nothing. Backend enforces this too, but we disable the button
  // early to surface a clear reason in the UI.
  const canLaunch = canEdit && campaign.totalContacts > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/campaigns')}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))]">
          <Megaphone size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-[hsl(var(--foreground))] truncate">{campaign.name}</h1>
            <StatusBadge status={STATUS_MAP[campaign.status]} />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
            {campaign.session ? `via ${campaign.session.name}` : ''}
            {campaign.session && ' · '}
            Created {format(new Date(campaign.createdAt), 'MMM d, yyyy · HH:mm')}
          </p>
        </div>

        {/* Action buttons — right-aligned, order: Edit / Add recipients / Launch / Resend / Cancel */}

        {/* Edit — DRAFT/SCHEDULED only */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(prev => !prev)}
            className={`inline-flex items-center gap-2 ${editOpen ? 'bg-[hsl(var(--muted))]' : ''}`}
          >
            <Pencil className="w-3.5 h-3.5" />
            {editOpen ? 'Close edit' : 'Edit'}
          </Button>
        )}

        {/* Add recipients — DRAFT/SCHEDULED only */}
        {canAddRecipients && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddRecipientsOpen(true)}
            className="inline-flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add recipients
          </Button>
        )}

        {/* Launch — DRAFT/SCHEDULED with at least one recipient */}
        {canEdit && (
          <Button
            size="sm"
            onClick={handleLaunch}
            disabled={!canLaunch || launchCampaign.isPending}
            title={!canLaunch && campaign.totalContacts === 0 ? 'Add recipients before launching' : undefined}
            className="inline-flex items-center gap-2 bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] disabled:opacity-40"
          >
            {launchCampaign.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            {launchCampaign.isPending ? 'Launching…' : campaign.scheduledAt ? 'Schedule' : 'Launch'}
          </Button>
        )}

        {/* Resend — COMPLETED/CANCELLED only */}
        {canResend && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResendModalOpen(true)}
            className="inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resend
          </Button>
        )}

        {/* Cancel — RUNNING/SCHEDULED only */}
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

      {/* ── Inline edit panel ── */}
      {editOpen && canEdit && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Edit campaign</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Recipients are managed separately via &ldquo;Add recipients&rdquo;
            </p>
          </div>
          <CreateCampaignForm existingCampaign={campaign} onSaved={() => setEditOpen(false)} />
        </div>
      )}

      {/* ── Modals ── */}
      <ResendCampaignModal
        open={resendModalOpen}
        onOpenChange={setResendModalOpen}
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        failedCount={campaign.failedCount}
      />
      <AddRecipientsModal open={addRecipientsOpen} onOpenChange={setAddRecipientsOpen} campaignId={campaign.id} />

      {/* ── Message preview ── */}
      <div className="rounded-lg bg-[hsl(var(--muted))] px-4 py-3">
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-1">Message</p>
        <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{campaign.messageTemplate}</p>
        {campaign.mediaUrl && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5 truncate">Media: {campaign.mediaUrl}</p>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Sent"
          value={campaign.sentCount}
          sub={`of ${campaign.totalContacts} total`}
          icon={Send}
          accent="purple"
        />
        <StatCard label="Delivered" value={campaign.deliveredCount} icon={CheckCheck} accent="green" />
        <StatCard label="Read" value={campaign.readCount} icon={Eye} accent="blue" />
        <StatCard
          label="Failed"
          value={campaign.failedCount}
          icon={XCircle}
          accent={campaign.failedCount > 0 ? 'red' : 'neutral'}
        />
      </div>

      {/* ── Progress bar ── */}
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

      {/* ── Per-contact status table ── */}
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">
          Recipients ({campaign.contacts.length})
        </p>
        <CampaignContactTable contacts={campaign.contacts} />
      </div>
    </div>
  );
}
