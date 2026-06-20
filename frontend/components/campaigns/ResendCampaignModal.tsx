'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRetryFailedCampaign, useCloneCampaign } from '@/hooks/useCampaigns';
import { CampaignStatus } from '@/types/campaign';

interface ResendCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignStatus: CampaignStatus;
  failedCount: number;
}

export default function ResendCampaignModal({
  open,
  onOpenChange,
  campaignId,
  campaignStatus,
  failedCount,
}: ResendCampaignModalProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'retry' | 'clone' | null>(null);

  const retryFailed = useRetryFailedCampaign(campaignId);
  const cloneCampaign = useCloneCampaign(campaignId);

  const canRetry = campaignStatus === 'COMPLETED' && failedCount > 0;
  const isBusy = retryFailed.isPending || cloneCampaign.isPending;

  const handleRetry = () => {
    setPendingAction('retry');
    retryFailed.mutate(undefined, {
      onSuccess: () => onOpenChange(false),
      onSettled: () => setPendingAction(null),
    });
  };

  const handleClone = () => {
    setPendingAction('clone');
    cloneCampaign.mutate(undefined, {
      onSuccess: result => {
        onOpenChange(false);
        // Redirect to the new DRAFT's detail page with ?addRecipients=1 so
        // the AddRecipientsModal opens automatically on arrival — without this
        // the user lands on a zero-contact DRAFT with no obvious next step.
        router.push(`/dashboard/campaigns/${result.data.id}?addRecipients=1`);
      },
      onSettled: () => setPendingAction(null),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resend campaign</DialogTitle>
          <DialogDescription>
            Choose how you&apos;d like to resend this campaign. Each option leads to a different outcome.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {/* Retry failed contacts */}
          <button
            type="button"
            onClick={handleRetry}
            disabled={!canRetry || isBusy}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] px-3.5 py-3 text-left transition-colors',
              canRetry && !isBusy ? 'hover:bg-[hsl(var(--muted))] cursor-pointer' : 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--purple))]/12 text-[hsl(var(--purple))]">
              {pendingAction === 'retry' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">Retry failed contacts</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {campaignStatus !== 'COMPLETED'
                  ? 'Only available for completed campaigns.'
                  : failedCount > 0
                    ? `Re-sends to ${failedCount} failed recipient${failedCount === 1 ? '' : 's'} on this campaign.`
                    : 'No failed recipients to retry.'}
              </p>
            </div>
          </button>

          {/* Clone as new campaign */}
          <button
            type="button"
            onClick={handleClone}
            disabled={isBusy}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] px-3.5 py-3 text-left transition-colors',
              !isBusy ? 'hover:bg-[hsl(var(--muted))] cursor-pointer' : 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--green))]/12 text-[hsl(var(--green))]">
              {pendingAction === 'clone' ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">Clone as new campaign</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Creates a new draft with the same message and media. You&apos;ll pick recipients fresh.
              </p>
            </div>
          </button>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
