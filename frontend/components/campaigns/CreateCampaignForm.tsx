'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCampaign, useUploadCampaignRecipients } from '@/hooks/useCampaigns';
import { useConnectedSessions } from '@/hooks/useSessions';
import ContactSelector from './ContactSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { ImportRecipientsResult } from '@/types/campaign';

const EMPTY = {
  name: '',
  sessionId: '',
  messageTemplate: '',
  mediaUrl: '',
  scheduledAt: '',
};

// ─── Submit state machine ─────────────────────────────────────────────────────
// Tracks which step of the two-step create → upload flow we're in,
// so the UI can show meaningful progress rather than a generic spinner.
type SubmitStep = 'idle' | 'creating' | 'uploading' | 'done';

export default function CreateCampaignForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rateLimitPerMin, setRateLimitPerMin] = useState(30);
  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [error, setError] = useState<string | null>(null);
  // Non-blocking warning shown after a successful upload with skipped rows.
  // Does not prevent navigation — user can proceed to the campaign detail.
  const [importWarning, setImportWarning] = useState<ImportRecipientsResult | null>(null);

  const { data: sessions, isLoading: sessionsLoading } = useConnectedSessions();
  const { mutateAsync: createCampaign } = useCreateCampaign();
  const { mutateAsync: uploadRecipients } = useUploadCampaignRecipients();

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const isPending = submitStep === 'creating' || submitStep === 'uploading';

  // ─── Validation ─────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Campaign name is required.';
    if (!form.sessionId) return 'Please select a WhatsApp session.';
    if (!form.messageTemplate.trim()) return 'Message is required.';
    // At least one recipient source must be provided
    if (selectedIds.length === 0 && !csvFile) {
      return 'Add recipients — pick contacts or upload a CSV.';
    }
    return null;
  };

  // ─── Submit: step 1 create, step 2 upload CSV if present ────────────────────

  const handleSubmit = async () => {
    setError(null);
    setImportWarning(null);

    const validationError = validate();
    if (validationError) return setError(validationError);

    let campaignId: string;

    // ── Step 1: create campaign ───────────────────────────────────────────────
    try {
      setSubmitStep('creating');
      const campaign = await createCampaign({
        name: form.name.trim(),
        sessionId: form.sessionId,
        messageTemplate: form.messageTemplate.trim(),
        mediaUrl: form.mediaUrl.trim() || undefined,
        // Only send contactIds if the user picked contacts — omit the field
        // entirely when CSV-only so the backend doesn't validate an empty array.
        contactIds: selectedIds.length > 0 ? selectedIds : undefined,
        scheduledAt: form.scheduledAt || undefined,
        rateLimitPerMin,
      });
      campaignId = campaign.data.id;
    } catch (err: unknown) {
      setSubmitStep('idle');
      setError(extractApiError(err) ?? 'Failed to create campaign. Please try again.');
      return;
    }

    // ── Step 2: upload CSV recipients if a file was provided ──────────────────
    if (csvFile) {
      try {
        setSubmitStep('uploading');
        const result = await uploadRecipients({ campaignId, file: csvFile });

        // Surface a non-blocking warning if any rows were skipped or errored,
        // but do not block navigation — partial success is still success.
        if (result.skipped > 0 || result.errors.length > 0) {
          setImportWarning(result);
          setSubmitStep('done');
          // Give the user a moment to read the warning before navigating.
          // If they want to stay they can dismiss and navigate manually,
          // but auto-navigate after a short delay keeps the flow smooth
          // for the common case where skips are minor (duplicates).
          await delay(3000);
        }
      } catch (err: unknown) {
        // CSV upload failure is non-fatal — the campaign was already created
        // successfully. Warn the user rather than showing a hard error, and
        // still navigate to the campaign detail so they can retry the upload
        // (once that UI exists) or manually add contacts.
        setSubmitStep('idle');
        setError(
          `Campaign created, but recipient upload failed: ${extractApiError(err) ?? 'unknown error'}. ` +
            `You can find your campaign in the campaigns list.`,
        );
        // Still navigate after a beat so the user can act on the campaign
        await delay(3000);
        router.push(`/dashboard/campaigns/${campaignId}`);
        return;
      }
    }

    router.push(`/dashboard/campaigns/${campaignId}`);
  };

  const previewText = form.messageTemplate.trim().slice(0, 100);
  const recipientCount = selectedIds.length; // CSV count unknown until upload resolves

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="cc-name" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Campaign name <span className="text-red-400">*</span>
        </Label>
        <Input id="cc-name" placeholder="Diwali sale announcement" value={form.name} onChange={set('name')} />
      </div>

      {/* Session picker */}
      <div className="space-y-1.5">
        <Label htmlFor="cc-session" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Send from <span className="text-red-400">*</span>
        </Label>
        <select
          id="cc-session"
          value={form.sessionId}
          onChange={e => setForm(prev => ({ ...prev, sessionId: e.target.value }))}
          disabled={sessionsLoading}
          className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
        >
          <option value="">{sessionsLoading ? 'Loading sessions…' : 'Select a connected session'}</option>
          {sessions?.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} {s.phoneNumber ? `(${s.phoneNumber})` : ''}
            </option>
          ))}
        </select>
        {!sessionsLoading && sessions?.length === 0 && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            No connected sessions. Connect a WhatsApp session first.
          </p>
        )}
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <Label htmlFor="cc-message" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Message <span className="text-red-400">*</span>
        </Label>
        <textarea
          id="cc-message"
          rows={4}
          placeholder="Write your broadcast message…"
          value={form.messageTemplate}
          onChange={set('messageTemplate')}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none"
        />
      </div>

      {/* Media URL */}
      <div className="space-y-1.5">
        <Label htmlFor="cc-media" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Media URL
        </Label>
        <Input
          id="cc-media"
          placeholder="https://… (optional image)"
          value={form.mediaUrl}
          onChange={set('mediaUrl')}
        />
      </div>

      {/* Rate limit slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Send rate</Label>
          <span className="text-xs text-[hsl(var(--foreground))]">{rateLimitPerMin} / min</span>
        </div>
        <input
          type="range"
          min={10}
          max={60}
          step={1}
          value={rateLimitPerMin}
          onChange={e => setRateLimitPerMin(Number(e.target.value))}
          className="w-full accent-[hsl(var(--green))]"
        />
      </div>

      {/* Schedule */}
      <div className="space-y-1.5">
        <Label htmlFor="cc-schedule" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Schedule (optional)
        </Label>
        <Input id="cc-schedule" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Leave blank to send immediately</p>
      </div>

      {/* Contact selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Recipients <span className="text-red-400">*</span>
        </Label>
        <ContactSelector
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          csvFile={csvFile}
          onCsvFileChange={setCsvFile}
        />
      </div>

      {/* Message preview */}
      {form.messageTemplate.trim() && (
        <div className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2.5">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-1">
            Preview
            {recipientCount > 0 && (
              <>
                {' '}
                — {recipientCount} contact{recipientCount !== 1 ? 's' : ''} selected
              </>
            )}
            {csvFile && (
              <>
                {' '}
                {recipientCount > 0 ? '+' : '—'} CSV: {csvFile.name}
              </>
            )}
          </p>
          <p className="text-xs text-[hsl(var(--foreground))]">
            {previewText}
            {form.messageTemplate.trim().length > 100 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Import warning — non-blocking, shown after partial CSV upload success */}
      {importWarning && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400 font-medium">
              {importWarning.created} recipient{importWarning.created !== 1 ? 's' : ''} added
              {importWarning.skipped > 0 && `, ${importWarning.skipped} skipped`}
            </p>
          </div>
          {importWarning.errors.length > 0 && (
            <ul className="pl-5 flex flex-col gap-0.5">
              {importWarning.errors.slice(0, 5).map((e, i) => (
                <li key={i} className="text-[11px] text-amber-400/80">
                  Row {e.row}: {e.reason}
                </li>
              ))}
              {importWarning.errors.length > 5 && (
                <li className="text-[11px] text-amber-400/60">…and {importWarning.errors.length - 5} more</li>
              )}
            </ul>
          )}
          <p className="text-[11px] text-amber-400/70">Redirecting to campaign…</p>
        </div>
      )}

      {/* Hard error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <X className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-[hsl(var(--purple))]/20 border border-[hsl(var(--purple))]/30 text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple))]/30 min-w-[120px]"
        >
          {submitStep === 'creating' ? 'Creating…' : submitStep === 'uploading' ? 'Uploading…' : 'Create campaign'}
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractApiError(err: unknown): string | undefined {
  if (err instanceof Error && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    return typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : undefined;
  }
  return undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
