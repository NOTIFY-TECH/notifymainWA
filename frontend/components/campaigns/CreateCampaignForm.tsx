'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCampaign, useUpdateCampaign, useUploadCampaignRecipients, campaignKeys } from '@/hooks/useCampaigns';
import { useConnectedSessions } from '@/hooks/useSessions';
import { useCampaignTemplates } from '@/hooks/useCampaignTemplates';
import { useQueryClient } from '@tanstack/react-query';
import ContactSelector from './ContactSelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { AlertTriangle, X, Link, CalendarClock, Rocket, Save, FileText, Check } from 'lucide-react';
import { CampaignDetail, ImportRecipientsResult } from '@/types/campaign';
import { CampaignTemplate } from '@/types/campaign-template';
import { useAuthStore } from '@/store/authStore';
import { messagesApi } from '@/services/messages-api';
import { campaignsApi } from '@/services/campaigns-api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

interface CreateCampaignFormProps {
  existingCampaign?: CampaignDetail;
  onSaved?: () => void;
}

const EMPTY = { name: '', sessionId: '', messageTemplate: '', scheduledAt: '' };
type SubmitStep = 'idle' | 'creating' | 'uploading' | 'launching' | 'saving' | 'done';

// ─── Shared style tokens ──────────────────────────────────────────────────────

/** Section card — the coloured left-border gives each section a visual identity */
const sectionCard = (accent: string) =>
  `rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] border-l-2 ${accent}`;

const fieldLabel = 'block text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5';

const inputClass =
  'h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm ' +
  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] ' +
  'focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] ' +
  'transition-colors hover:border-[hsl(var(--green)/0.35)]';

const selectClass =
  'h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm ' +
  'text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] ' +
  'transition-colors hover:border-[hsl(var(--green)/0.35)]';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateCampaignForm({ existingCampaign, onSaved }: CreateCampaignFormProps) {
  const isEditMode = !!existingCampaign;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(() =>
    isEditMode
      ? {
          name: existingCampaign.name,
          sessionId: existingCampaign.sessionId,
          messageTemplate: existingCampaign.messageTemplate,
          scheduledAt: toDatetimeLocalValue(existingCampaign.scheduledAt),
        }
      : EMPTY,
  );

  const [rateLimitPerMin, setRateLimitPerMin] = useState(existingCampaign?.rateLimitPerMin ?? 30);
  const [mediaUrl, setMediaUrl] = useState(existingCampaign?.mediaUrl ?? '');
  const [mediaType, setMediaType] = useState(existingCampaign?.mediaType ?? '');
  const [mediaMode, setMediaMode] = useState<'upload' | 'url'>(existingCampaign?.mediaUrl ? 'url' : 'upload');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState(existingCampaign?.linkUrl ?? '');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<ImportRecipientsResult | null>(null);

  const { data: sessions, isLoading: sessionsLoading } = useConnectedSessions();
  const { data: templates } = useCampaignTemplates();
  const { mutateAsync: createCampaign } = useCreateCampaign();
  const { mutateAsync: updateCampaign } = useUpdateCampaign(existingCampaign?.id ?? '');
  const { mutateAsync: uploadRecipients } = useUploadCampaignRecipients();

  // ── Template selector state ───────────────────────────────────────────────
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [pendingTemplate, setPendingTemplate] = useState<CampaignTemplate | null>(null);

  const applyTemplate = (template: CampaignTemplate) => {
    setForm(prev => ({ ...prev, messageTemplate: template.messageBody }));
    setMediaUrl(template.mediaUrl ?? '');
    setMediaType(template.mediaType ?? '');
    setMediaMode(template.mediaUrl ? 'url' : 'upload');
    setMediaPreview(null);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = templates?.find(t => t.id === templateId);
    if (!template) return;

    const hasExistingContent = form.messageTemplate.trim().length > 0 || !!mediaUrl;
    if (hasExistingContent) {
      setPendingTemplate(template);
    } else {
      applyTemplate(template);
    }
  };

  const confirmApplyTemplate = () => {
    if (pendingTemplate) applyTemplate(pendingTemplate);
    setPendingTemplate(null);
  };

  const cancelApplyTemplate = () => {
    setPendingTemplate(null);
    setSelectedTemplateId('');
  };

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const isPending =
    submitStep === 'creating' ||
    submitStep === 'uploading' ||
    submitStep === 'launching' ||
    submitStep === 'saving' ||
    mediaUploading;

  const hasMedia = !!mediaUrl && mediaType !== 'text/link';
  const hasNoRecipients = !isEditMode && selectedIds.length === 0 && selectedTags.length === 0 && !csvFile;

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Campaign name is required.';
    if (!form.sessionId) return 'Please select a WhatsApp session.';
    if (!form.messageTemplate.trim()) return 'Message is required.';
    if (linkUrl.trim() && !linkUrl.trim().match(/^https?:\/\/.+/))
      return 'Link URL must start with http:// or https://';
    if (hasNoRecipients) return 'Add recipients — pick contacts, select tags, or upload a CSV.';
    return null;
  };

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

  const handleSubmit = async (launchAfterCreate = false) => {
    setError(null);
    setImportWarning(null);
    const validationError = validate();
    if (validationError) return setError(validationError);

    const resolvedLinkUrl = hasMedia && linkUrl.trim() ? linkUrl.trim() : undefined;

    if (isEditMode) {
      try {
        setSubmitStep('saving');
        await updateCampaign({
          name: form.name.trim(),
          sessionId: form.sessionId,
          messageTemplate: form.messageTemplate.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType: mediaType || undefined,
          linkUrl: resolvedLinkUrl ?? null,
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

    let campaignId: string;
    const tenantId = useAuthStore.getState().tenant?.id ?? '';

    try {
      setSubmitStep('creating');
      const campaign = await createCampaign({
        name: form.name.trim(),
        sessionId: form.sessionId,
        messageTemplate: form.messageTemplate.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
        mediaType: mediaType || undefined,
        linkUrl: resolvedLinkUrl,
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
          `Campaign created, but recipient upload failed: ${extractApiError(err) ?? 'unknown error'}. You can find your campaign in the campaigns list.`,
        );
        await delay(3000);
        router.push(`/dashboard/campaigns/${campaignId}`);
        return;
      }
    }

    if (launchAfterCreate) {
      try {
        setSubmitStep('launching');
        await campaignsApi.launch(tenantId, campaignId);
        queryClient.invalidateQueries({ queryKey: campaignKeys.all(tenantId) });
      } catch (err: unknown) {
        setSubmitStep('idle');
        setError(
          `Campaign created, but launch failed: ${extractApiError(err) ?? 'unknown error'}. You can launch it from the campaign page.`,
        );
        await delay(3000);
        router.push(`/dashboard/campaigns/${campaignId}`);
        return;
      }
    }

    router.push(`/dashboard/campaigns/${campaignId}`);
  };

  const recipientSummary = [
    selectedIds.length > 0 ? `${selectedIds.length} contact${selectedIds.length !== 1 ? 's' : ''}` : null,
    selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''}` : null,
    csvFile ? `CSV: ${csvFile.name}` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-0">
      {/* ══════════════════════════════════════════════════════════════════
          TOP BAR — title · schedule · actions
          ══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-4 pb-5 flex-wrap">
        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-0.5">
            Marketing
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))] leading-none">
            {isEditMode ? `Edit — ${existingCampaign.name}` : 'New campaign'}
          </h1>
        </div>

        {/* Schedule picker */}
        <div className="flex items-center gap-2 shrink-0">
          <CalendarClock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] hidden sm:block">Schedule</span>
          <DateTimePicker
            value={form.scheduledAt}
            onChange={v => setForm(prev => ({ ...prev, scheduledAt: v }))}
            placeholder="Send immediately"
            className="w-48"
          />
        </div>

        {/* Divider */}
        <div className="h-7 w-px bg-[hsl(var(--border))] shrink-0" />

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={isEditMode ? onSaved : () => router.back()}
            disabled={isPending}
            className="h-9 px-4 text-xs"
          >
            Cancel
          </Button>

          {!isEditMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isPending}
              className="h-9 px-4 text-xs gap-1.5 min-w-[120px]"
            >
              <Save className="w-3.5 h-3.5" />
              {submitStep === 'creating' ? 'Creating…' : submitStep === 'uploading' ? 'Uploading…' : 'Save as Draft'}
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleSubmit(!isEditMode)}
            disabled={isPending || (!isEditMode && hasNoRecipients)}
            title={!isEditMode && hasNoRecipients ? 'Add recipients before launching' : undefined}
            className="h-9 px-4 text-xs gap-1.5 min-w-[130px] bg-[hsl(var(--purple-dim))] border border-[hsl(var(--purple)/0.35)] text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple)/0.22)] disabled:opacity-40"
          >
            <Rocket className="w-3.5 h-3.5" />
            {isEditMode
              ? submitStep === 'saving'
                ? 'Saving…'
                : 'Save changes'
              : submitStep === 'creating'
                ? 'Creating…'
                : submitStep === 'uploading'
                  ? 'Uploading…'
                  : submitStep === 'launching'
                    ? 'Launching…'
                    : 'Save & Launch'}
          </Button>
        </div>
      </div>

      {/* Errors / warnings */}
      {error && (
        <div className="shrink-0 mb-4 flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3">
          <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {importWarning && (
        <div className="shrink-0 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-400 font-medium">
              {importWarning.created} recipient{importWarning.created !== 1 ? 's' : ''} added
              {importWarning.skipped > 0 && `, ${importWarning.skipped} skipped`}
            </p>
          </div>
          {importWarning.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-xs text-amber-400/70 pl-6">
              Row {e.row}: {e.reason}
            </p>
          ))}
        </div>
      )}

      {/* Template overwrite confirmation */}
      {pendingTemplate && (
        <div className="shrink-0 mb-4 flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-400">
              Apply template <span className="font-semibold">{pendingTemplate.name}</span>? This will replace your
              current message{pendingTemplate.mediaUrl ? ' and media' : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={confirmApplyTemplate}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors"
            >
              <Check className="w-3 h-3" />
              Apply
            </button>
            <button
              onClick={cancelApplyTemplate}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          BODY — two columns
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* ① Campaign identity — green left border */}
          <div className={`shrink-0 ${sectionCard('border-l-[hsl(var(--green))]')} p-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cc-name" className={fieldLabel}>
                  Campaign name <span className="text-red-400 normal-case">*</span>
                </label>
                <Input
                  id="cc-name"
                  placeholder="Diwali sale announcement"
                  value={form.name}
                  onChange={set('name')}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="cc-session" className={fieldLabel}>
                  Send from <span className="text-red-400 normal-case">*</span>
                </label>
                <select
                  id="cc-session"
                  value={form.sessionId}
                  onChange={e => setForm(prev => ({ ...prev, sessionId: e.target.value }))}
                  disabled={sessionsLoading}
                  className={selectClass}
                >
                  <option value="">{sessionsLoading ? 'Loading…' : 'Select a session'}</option>
                  {sessions?.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.phoneNumber ? ` (${s.phoneNumber})` : ''}
                    </option>
                  ))}
                </select>
                {!sessionsLoading && sessions?.length === 0 && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">No connected sessions.</p>
                )}
              </div>
            </div>
          </div>

          {/* ② Message — grows to fill */}
          <div className={`flex-1 min-h-0 ${sectionCard('border-l-[hsl(var(--green)/0.5)]')} flex flex-col p-4 gap-2`}>
            <label htmlFor="cc-message" className={fieldLabel}>
              Message <span className="text-red-400 normal-case">*</span>
            </label>
            {!!templates?.length && (
              <div className="shrink-0 flex items-center gap-2 rounded-lg border border-[hsl(var(--green)/0.3)] bg-[hsl(var(--green-dim))] px-3 py-2 mb-1">
                <FileText className="w-4 h-4 text-[hsl(var(--green))] shrink-0" />
                <span className="text-xs font-medium text-[hsl(var(--foreground))] whitespace-nowrap">
                  Apply a saved template
                </span>
                <select
                  value={selectedTemplateId}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="flex-1 h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 text-xs font-medium text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] cursor-pointer"
                >
                  <option value="">Choose a template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              id="cc-message"
              placeholder="Write your broadcast message…"
              value={form.messageTemplate}
              onChange={set('messageTemplate')}
              className="flex-1 min-h-0 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none leading-relaxed transition-colors hover:border-[hsl(var(--green)/0.35)]"
            />
            {(recipientSummary || (hasMedia && linkUrl.trim())) && (
              <div className="flex items-center gap-3 mt-0.5">
                {recipientSummary && (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">→ {recipientSummary}</span>
                )}
                {hasMedia && linkUrl.trim() && (
                  <span className="text-[10px] text-[hsl(var(--green))] flex items-center gap-1">
                    <Link className="w-2.5 h-2.5" /> Link card will follow
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ③ Media — amber/orange left border to distinguish it */}
          <div className={`shrink-0 ${sectionCard('border-l-amber-500')} p-4`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <label className={fieldLabel + ' mb-0'}>
                Media{' '}
                <span className="normal-case tracking-normal font-normal text-[hsl(var(--muted-foreground))]">
                  (optional)
                </span>
              </label>
              {/* Segmented Upload / URL toggle */}
              <div className="flex gap-0.5 bg-[hsl(var(--muted))] rounded-lg p-0.5">
                {(['upload', 'url'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setMediaMode(mode);
                      setMediaUrl('');
                      setMediaType('');
                      setMediaPreview(null);
                    }}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all capitalize ${
                      mediaMode === mode
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload zone or URL input */}
            {mediaMode === 'upload' ? (
              <div className="relative">
                <label
                  htmlFor="cc-media-file"
                  className={`flex items-center justify-center gap-2.5 h-11 rounded-lg border border-dashed text-xs transition-colors cursor-pointer ${
                    mediaUploading
                      ? 'opacity-50 pointer-events-none border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                      : mediaUrl
                        ? 'border-[hsl(var(--green)/0.4)] bg-[hsl(var(--green-dim))] text-[hsl(var(--green))]'
                        : 'border-amber-500/30 text-[hsl(var(--muted-foreground))] hover:border-amber-500/60 hover:text-[hsl(var(--foreground))] hover:bg-amber-500/5'
                  }`}
                >
                  {mediaUploading ? (
                    'Uploading…'
                  ) : mediaUrl ? (
                    `✓ ${mediaType || 'file'} uploaded`
                  ) : (
                    <>
                      <span>Drop a file or click to browse</span>
                      <span className="opacity-40 text-[10px]">JPG PNG MP4 PDF</span>
                    </>
                  )}
                </label>
                <input
                  id="cc-media-file"
                  type="file"
                  accept="image/jpeg,image/png,video/mp4,application/pdf"
                  className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleMediaUpload(f);
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
                    className="absolute top-2 right-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <input
                id="cc-media-url"
                placeholder="https://… image, video, or PDF URL"
                value={mediaUrl}
                className={inputClass}
                onChange={e => {
                  setMediaUrl(e.target.value);
                  const url = e.target.value.toLowerCase();
                  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/)) setMediaType('image/jpeg');
                  else if (url.match(/\.mp4$/)) setMediaType('video/mp4');
                  else if (url.match(/\.pdf$/)) setMediaType('application/pdf');
                  else setMediaType('text/link');
                }}
              />
            )}

            {/* Link URL — only when media is attached */}
            {hasMedia && (
              <div className="flex items-center gap-2 mt-2.5">
                <Link className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <input
                  id="cc-link-url"
                  placeholder="https://yourwebsite.com/offer (WhatsApp card, optional)"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  className={inputClass + ' h-8 text-xs'}
                />
              </div>
            )}

            {mediaPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaPreview}
                alt="Preview"
                className="mt-3 rounded-lg max-h-16 object-cover border border-[hsl(var(--border))]"
              />
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* ④ Recipients — purple left border, fills available height */}
          <div
            className={`flex-1 min-h-0 ${sectionCard('border-l-[hsl(var(--purple))]')} flex flex-col overflow-hidden`}
          >
            {/* Section label sits above ContactSelector */}
            <div className="shrink-0 px-4 pt-4 pb-0">
              <span className={fieldLabel}>
                Recipients <span className="text-red-400 normal-case">*</span>
              </span>
            </div>

            {isEditMode ? (
              <div className="px-4 pb-4 pt-2">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Use the <span className="text-[hsl(var(--foreground))]">Add recipients</span> button on this campaign
                  to manage recipients. They can&apos;t be changed here.
                </p>
              </div>
            ) : (
              /* ContactSelector fills the rest of this card's height */
              <div className="flex-1 min-h-0 overflow-hidden">
                <ContactSelector
                  selectedIds={selectedIds}
                  onSelectedIdsChange={setSelectedIds}
                  csvFile={csvFile}
                  onCsvFileChange={setCsvFile}
                  selectedTags={selectedTags}
                  onSelectedTagsChange={setSelectedTags}
                />
              </div>
            )}
          </div>

          {/* ⑤ Send rate — subtle left border */}
          <div className={`shrink-0 ${sectionCard('border-l-[hsl(var(--muted-foreground)/0.4)]')} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <span className={fieldLabel + ' mb-0'}>Send rate</span>
              <span className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">
                {rateLimitPerMin}
                <span className="text-xs font-normal text-[hsl(var(--muted-foreground))] ml-0.5">/ min</span>
              </span>
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
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">
              20–30/min is safe for most accounts. Higher rates may increase spam risk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
