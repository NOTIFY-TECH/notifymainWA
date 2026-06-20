'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCampaign, useUpdateCampaign, useUploadCampaignRecipients } from '@/hooks/useCampaigns';
import { useConnectedSessions } from '@/hooks/useSessions';
import ContactSelector from './ContactSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { CampaignDetail, ImportRecipientsResult } from '@/types/campaign';
import { useAuthStore } from '@/store/authStore';
import { messagesApi } from '@/services/messages-api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convert an ISO datetime string (from the DB) to the format datetime-local
// inputs expect: "YYYY-MM-DDTHH:mm". The input silently clears if it receives
// a full ISO string with seconds/timezone, so we slice to 16 chars.
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateCampaignFormProps {
  // When provided, the form operates in edit mode:
  //   - All fields are pre-filled from existingCampaign
  //   - Submit calls PATCH instead of POST
  //   - The recipient selector is hidden — recipients are managed separately
  //     via the "Add recipients" button on the campaign detail page
  //   - onSaved() is called after a successful update so the parent (the
  //     detail page's inline edit panel) can close itself
  existingCampaign?: CampaignDetail;
  onSaved?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY = {
  name: '',
  sessionId: '',
  messageTemplate: '',
  scheduledAt: '',
};

type SubmitStep = 'idle' | 'creating' | 'uploading' | 'saving' | 'done';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateCampaignForm({ existingCampaign, onSaved }: CreateCampaignFormProps) {
  const isEditMode = !!existingCampaign;
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────────────────────
  // Initializer functions run once on mount only, so the pre-fill from
  // existingCampaign is stable and won't re-run on re-renders.

  const [form, setForm] = useState(() =>
    isEditMode
      ? {
          name: existingCampaign.name,
          sessionId: existingCampaign.sessionId,
          messageTemplate: existingCampaign.messageTemplate,
          // Convert ISO → datetime-local format before handing to the input
          scheduledAt: toDatetimeLocalValue(existingCampaign.scheduledAt),
        }
      : EMPTY,
  );

  const [rateLimitPerMin, setRateLimitPerMin] = useState(() => existingCampaign?.rateLimitPerMin ?? 30);

  // Media — in edit mode default to 'url' mode with the existing URL pre-filled.
  // We don't know if the original was uploaded or pasted, but url mode works
  // correctly for both since the stored value is always a full URL either way.
  const [mediaUrl, setMediaUrl] = useState<string>(() => existingCampaign?.mediaUrl ?? '');
  const [mediaType, setMediaType] = useState<string>(() => existingCampaign?.mediaType ?? '');
  const [mediaMode, setMediaMode] = useState<'upload' | 'url'>(() => (existingCampaign?.mediaUrl ? 'url' : 'upload'));
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  // Recipients — only used in create mode; ignored in edit mode
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<ImportRecipientsResult | null>(null);

  // ── Hooks ─────────────────────────────────────────────────────────────────

  const { data: sessions, isLoading: sessionsLoading } = useConnectedSessions();
  const { mutateAsync: createCampaign } = useCreateCampaign();
  // existingCampaign.id is guaranteed non-null when isEditMode — fallback to ''
  // is only to satisfy the type and will never be called in create mode.
  const { mutateAsync: updateCampaign } = useUpdateCampaign(existingCampaign?.id ?? '');
  const { mutateAsync: uploadRecipients } = useUploadCampaignRecipients();

  // ── Derived ───────────────────────────────────────────────────────────────

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const isPending =
    submitStep === 'creating' || submitStep === 'uploading' || submitStep === 'saving' || mediaUploading;

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Campaign name is required.';
    if (!form.sessionId) return 'Please select a WhatsApp session.';
    if (!form.messageTemplate.trim()) return 'Message is required.';
    // Recipient check skipped in edit mode — managed separately
    if (!isEditMode && selectedIds.length === 0 && selectedTags.length === 0 && !csvFile)
      return 'Add recipients — pick contacts, select tags, or upload a CSV.';
    return null;
  };

  // ── Media upload ──────────────────────────────────────────────────────────

  const handleMediaUpload = async (file: File) => {
    setMediaUploading(true);
    setMediaUrl('');
    setMediaType('');
    setMediaPreview(null);
    setError(null);
    try {
      const tenantId = useAuthStore.getState().tenant?.id ?? '';
      const data = await messagesApi.uploadMedia(tenantId, file);
      setMediaUrl(data.url);
      setMediaType(data.mediaType ?? '');
      if (data.mediaType?.startsWith('image/')) setMediaPreview(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Media upload failed.');
    } finally {
      setMediaUploading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    setImportWarning(null);

    const validationError = validate();
    if (validationError) return setError(validationError);

    // ── Edit mode: single PATCH ────────────────────────────────────────────
    if (isEditMode) {
      try {
        setSubmitStep('saving');
        await updateCampaign({
          name: form.name.trim(),
          sessionId: form.sessionId,
          messageTemplate: form.messageTemplate.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType: mediaType || undefined,
          // scheduledAt semantics (from UpdateCampaignRequest):
          //   string  → set a new schedule
          //   null    → explicitly clear the schedule (user emptied the input)
          //   Note: undefined means "don't touch", but we show the field so
          //   the user can actively clear it — map empty string → null.
          scheduledAt: form.scheduledAt ? form.scheduledAt : null,
          rateLimitPerMin,
        });
        setSubmitStep('idle');
        onSaved?.();
      } catch (err: unknown) {
        setSubmitStep('idle');
        setError(extractApiError(err) ?? 'Failed to save changes. Please try again.');
      }
      return;
    }

    // ── Create mode: POST then optional CSV upload ─────────────────────────
    let campaignId: string;

    try {
      setSubmitStep('creating');
      const campaign = await createCampaign({
        name: form.name.trim(),
        sessionId: form.sessionId,
        messageTemplate: form.messageTemplate.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
        mediaType: mediaType || undefined,
        contactIds: selectedIds.length > 0 ? selectedIds : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        scheduledAt: form.scheduledAt || undefined,
        rateLimitPerMin,
      });
      campaignId = campaign.data.id;
    } catch (err: unknown) {
      setSubmitStep('idle');
      setError(extractApiError(err) ?? 'Failed to create campaign. Please try again.');
      return;
    }

    if (csvFile) {
      try {
        setSubmitStep('uploading');
        const result = await uploadRecipients({ campaignId, file: csvFile });
        if (result.skipped > 0 || result.errors.length > 0) {
          setImportWarning(result);
          setSubmitStep('done');
          await delay(3000);
        }
      } catch (err: unknown) {
        setSubmitStep('idle');
        setError(
          `Campaign created, but recipient upload failed: ${extractApiError(err) ?? 'unknown error'}. ` +
            `You can find your campaign in the campaigns list.`,
        );
        await delay(3000);
        router.push(`/dashboard/campaigns/${campaignId}`);
        return;
      }
    }

    router.push(`/dashboard/campaigns/${campaignId}`);
  };

  // ── Recipient summary (create mode only) ──────────────────────────────────

  const previewText = form.messageTemplate.trim().slice(0, 120);
  const recipientCount = selectedIds.length;
  const recipientSummary = [
    recipientCount > 0 ? `${recipientCount} contact${recipientCount !== 1 ? 's' : ''}` : null,
    selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''}` : null,
    csvFile ? `CSV: ${csvFile.name}` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  // ── Shared sub-sections ───────────────────────────────────────────────────
  // Extracted so they can be placed in different grid positions depending on mode
  // without duplicating the JSX.

  const rateAndScheduleFields = (
    <>
      {/* Rate limit */}
      <div className="space-y-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Send rate</Label>
          <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{rateLimitPerMin} / min</span>
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
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          Higher rates may increase spam risk. 20–30/min is safe for most accounts.
        </p>
      </div>

      {/* Schedule */}
      <div className="space-y-1.5 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <Label htmlFor="cc-schedule" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Schedule <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>
        </Label>
        <Input id="cc-schedule" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {isEditMode ? 'Clear to send immediately once launched.' : 'Leave blank to send immediately.'}
        </p>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ════════════════════════════════════════════════════════════════════
          CREATE MODE layout — mirrors the original two-column grid exactly:
            Left:  name / session / message / media / preview
            Right: rate / schedule / recipients
          ════════════════════════════════════════════════════════════════════ */}
      {!isEditMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            <CoreFields
              form={form}
              set={set}
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              mediaMode={mediaMode}
              mediaUploading={mediaUploading}
              mediaPreview={mediaPreview}
              setForm={setForm}
              setMediaUrl={setMediaUrl}
              setMediaType={setMediaType}
              setMediaMode={setMediaMode}
              setMediaPreview={setMediaPreview}
              onMediaUpload={handleMediaUpload}
            />
            {/* Message preview */}
            {form.messageTemplate.trim() && (
              <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3">
                <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                  Preview
                  {recipientSummary && <span className="normal-case font-normal ml-1">— {recipientSummary}</span>}
                </p>
                <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">
                  {previewText}
                  {form.messageTemplate.trim().length > 120 ? '…' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {rateAndScheduleFields}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Recipients <span className="text-red-400">*</span>
              </Label>
              <ContactSelector
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                csvFile={csvFile}
                onCsvFileChange={setCsvFile}
                selectedTags={selectedTags}
                onSelectedTagsChange={setSelectedTags}
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          EDIT MODE layout — compact two-column grid in a single container:
            Left:  name / session / message / media
            Right: rate / schedule / recipients note
          No CSV upload, no recipient selector. onSaved closes the panel.
          ════════════════════════════════════════════════════════════════════ */}
      {isEditMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            <CoreFields
              form={form}
              set={set}
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              mediaMode={mediaMode}
              mediaUploading={mediaUploading}
              mediaPreview={mediaPreview}
              setForm={setForm}
              setMediaUrl={setMediaUrl}
              setMediaType={setMediaType}
              setMediaMode={setMediaMode}
              setMediaPreview={setMediaPreview}
              onMediaUpload={handleMediaUpload}
            />
            {/* Message preview */}
            {form.messageTemplate.trim() && (
              <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3">
                <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                  Preview
                </p>
                <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">
                  {previewText}
                  {form.messageTemplate.trim().length > 120 ? '…' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {rateAndScheduleFields}
            {/* Recipients note */}
            <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-0.5">Recipients</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Use the <span className="text-[hsl(var(--foreground))]">Add recipients</span> button on this campaign to
                manage who receives it. Recipients can&apos;t be changed here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Warnings & errors ── */}
      {importWarning && (
        <div className="rounded-[var(--radius)] bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400 font-medium">
              {importWarning.created} recipient{importWarning.created !== 1 ? 's' : ''} added
              {importWarning.skipped > 0 && `, ${importWarning.skipped} skipped`}
            </p>
          </div>
          {importWarning.errors.length > 0 && (
            <ul className="pl-5 flex flex-col gap-0.5 mt-1">
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
          <p className="text-[11px] text-amber-400/70 mt-0.5">Redirecting to campaign…</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] bg-red-500/10 border border-red-500/20 px-4 py-3">
          <X className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex justify-end gap-2 pt-2 border-t border-[hsl(var(--border))]">
        <Button variant="outline" size="sm" onClick={isEditMode ? onSaved : () => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-[hsl(var(--purple-dim))] border border-[hsl(var(--purple)/0.25)] text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple)/0.2)] min-w-[130px]"
        >
          {isEditMode
            ? submitStep === 'saving'
              ? 'Saving…'
              : 'Save changes'
            : submitStep === 'creating'
              ? 'Creating…'
              : submitStep === 'uploading'
                ? 'Uploading…'
                : 'Create campaign'}
        </Button>
      </div>
    </div>
  );
}

// ─── CoreFields ───────────────────────────────────────────────────────────────
// Extracted to avoid duplicating the name/session/message/media block in both
// create and edit branches. Pure presentational — no hooks, no state.

interface Session {
  id: string;
  name: string;
  phoneNumber?: string | null; // matches @/types/session Session.phoneNumber
}

interface CoreFieldsProps {
  form: { name: string; sessionId: string; messageTemplate: string; scheduledAt: string };
  set: (
    field: 'name' | 'sessionId' | 'messageTemplate' | 'scheduledAt',
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  sessions: Session[] | undefined;
  sessionsLoading: boolean;
  mediaUrl: string;
  mediaType: string;
  mediaMode: 'upload' | 'url';
  mediaUploading: boolean;
  mediaPreview: string | null;
  setForm: React.Dispatch<
    React.SetStateAction<{ name: string; sessionId: string; messageTemplate: string; scheduledAt: string }>
  >;
  setMediaUrl: (v: string) => void;
  setMediaType: (v: string) => void;
  setMediaMode: (v: 'upload' | 'url') => void;
  setMediaPreview: (v: string | null) => void;
  onMediaUpload: (file: File) => void;
}

function CoreFields({
  form,
  set,
  sessions,
  sessionsLoading,
  mediaUrl,
  mediaType,
  mediaMode,
  mediaUploading,
  mediaPreview,
  setForm,
  setMediaUrl,
  setMediaType,
  setMediaMode,
  setMediaPreview,
  onMediaUpload,
}: CoreFieldsProps) {
  return (
    <>
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="cc-name" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Campaign name <span className="text-red-400">*</span>
        </Label>
        <Input id="cc-name" placeholder="Diwali sale announcement" value={form.name} onChange={set('name')} />
      </div>

      {/* Session */}
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
          rows={5}
          placeholder="Write your broadcast message…"
          value={form.messageTemplate}
          onChange={set('messageTemplate')}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none"
        />
      </div>

      {/* Media */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Media <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>
          </Label>
          <div className="flex text-[11px] gap-2">
            <button
              type="button"
              onClick={() => {
                setMediaMode('upload');
                setMediaUrl('');
                setMediaType('');
                setMediaPreview(null);
              }}
              className={`px-2 py-0.5 rounded ${mediaMode === 'upload' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => {
                setMediaMode('url');
                setMediaUrl('');
                setMediaType('');
                setMediaPreview(null);
              }}
              className={`px-2 py-0.5 rounded ${mediaMode === 'url' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
            >
              URL
            </button>
          </div>
        </div>

        {mediaMode === 'upload' ? (
          <div className="relative">
            <label
              htmlFor="cc-media-file"
              className={`flex items-center justify-center gap-2 h-20 rounded-md border border-dashed border-[hsl(var(--border))] cursor-pointer hover:border-[hsl(var(--green)/0.5)] transition-colors text-xs text-[hsl(var(--muted-foreground))] ${mediaUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {mediaUploading ? (
                'Uploading…'
              ) : mediaUrl ? (
                <span className="text-[hsl(var(--green))]">✓ {mediaType || 'file'} uploaded</span>
              ) : (
                <>
                  <span>Drop a file or click to browse</span>
                  <span className="text-[10px] opacity-60">JPG, PNG, MP4, PDF</span>
                </>
              )}
            </label>
            <input
              id="cc-media-file"
              type="file"
              accept="image/jpeg,image/png,video/mp4,application/pdf"
              className="sr-only"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onMediaUpload(file);
              }}
            />
            {mediaUrl && (
              <button
                type="button"
                onClick={() => {
                  setMediaUrl('');
                  setMediaType('');
                  setMediaPreview(null);
                }}
                className="absolute top-1.5 right-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <Input
            id="cc-media-url"
            placeholder="https://… image, video, or PDF URL"
            value={mediaUrl}
            onChange={e => {
              setMediaUrl(e.target.value);
              const url = e.target.value.toLowerCase();
              if (url.match(/\.(jpg|jpeg|png|gif|webp)$/)) setMediaType('image/jpeg');
              else if (url.match(/\.mp4$/)) setMediaType('video/mp4');
              else if (url.match(/\.pdf$/)) setMediaType('application/pdf');
              else setMediaType('');
            }}
          />
        )}

        {mediaPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaPreview}
            alt="Media preview"
            className="mt-1 rounded-md max-h-28 object-cover border border-[hsl(var(--border))]"
          />
        )}
      </div>
    </>
  );
}
