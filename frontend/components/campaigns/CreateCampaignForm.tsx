'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCampaign, useUpdateCampaign, useUploadCampaignRecipients, campaignKeys } from '@/hooks/useCampaigns';
import { useConnectedSessions } from '@/hooks/useSessions';
import { useCampaignTemplates } from '@/hooks/useCampaignTemplates';
import { useQueryClient } from '@tanstack/react-query';
import ContactSelector from './ContactSelector';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
  AlertTriangle,
  X,
  Link,
  CalendarClock,
  Rocket,
  Save,
  FileText,
  Check,
  Smartphone,
  MessageSquare,
  Paperclip,
  Users,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { CampaignDetail, ImportRecipientsResult } from '@/types/campaign';
import { CampaignTemplate } from '@/types/campaign-template';
import { useAuthStore } from '@/store/authStore';
import { messagesApi } from '@/services/messages-api';
import { campaignsApi } from '@/services/campaigns-api';
import { cn } from '@/lib/utils';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateCampaignFormProps {
  existingCampaign?: CampaignDetail;
  onSaved?: () => void;
}

const EMPTY = { name: '', sessionId: '', messageTemplate: '', scheduledAt: '' };
type SubmitStep = 'idle' | 'creating' | 'uploading' | 'launching' | 'saving' | 'done';
type MobileTab = 'message' | 'media' | 'recipients';

// ─── Style tokens ─────────────────────────────────────────────────────────────

const fieldLabel =
  'block text-[10px] font-[700] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))] mb-1.5';

const inputCls =
  'h-9 w-full rounded-[var(--radius-sm)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-[13px] ' +
  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] ' +
  'focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]/60 ' +
  'transition-colors';

const selectCls =
  'h-9 w-full rounded-[var(--radius-sm)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-[13px] ' +
  'text-[hsl(var(--foreground))] ' +
  'focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]/60 ' +
  'transition-colors';

const card =
  'rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] overflow-hidden';

// ─── SectionHeader — declared outside to avoid react-hooks/static-components ──

interface SectionHeaderProps {
  icon: React.ElementType;
  label: string;
  chipBg: string;
  chipText: string;
  topBarBg: string;
  right?: React.ReactNode;
}

function SectionHeader({ icon: Icon, label, chipBg, chipText, topBarBg, right }: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] shrink-0 ${topBarBg}`}
    >
      <div className="flex items-center gap-2">
        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${chipBg}`}>
          <Icon size={12} className={chipText} />
        </div>
        <span className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[hsl(var(--foreground))]">
          {label}
        </span>
      </div>
      {right}
    </div>
  );
}

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
  const [mobileTab, setMobileTab] = useState<MobileTab>('message');

  const { data: sessions, isLoading: sessionsLoading } = useConnectedSessions();
  const { data: templates } = useCampaignTemplates();
  const { mutateAsync: createCampaign } = useCreateCampaign();
  const { mutateAsync: updateCampaign } = useUpdateCampaign(existingCampaign?.id ?? '');
  const { mutateAsync: uploadRecipients } = useUploadCampaignRecipients();

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
    if (hasExistingContent) setPendingTemplate(template);
    else applyTemplate(template);
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
  const hasMediaAttached = !!mediaUrl;
  const hasRecipientsSelected = selectedIds.length > 0 || selectedTags.length > 0 || !!csvFile;

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
        setError(extractApiError(err) ?? 'Failed to save changes.');
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
      setError(extractApiError(err) ?? 'Failed to create campaign.');
      return;
    }

    if (csvFile) {
      try {
        console.log('csvFile:', csvFile?.name, csvFile?.type, csvFile?.size);
        setSubmitStep('uploading');
        const result = await uploadRecipients({ campaignId, file: csvFile });
        if (result.skipped > 0 || result.errors.length > 0) {
          setImportWarning(result);
          setSubmitStep('done');
          await delay(3000);
        }
      } catch (err: unknown) {
        setSubmitStep('idle');
        setError(`Campaign created, but recipient upload failed: ${extractApiError(err) ?? 'unknown error'}.`);
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
        setError(`Campaign created, but launch failed: ${extractApiError(err) ?? 'unknown error'}.`);
        await delay(3000);
        router.push(`/dashboard/campaigns/${campaignId}`);
        return;
      }
    }

    router.push(`/dashboard/campaigns/${campaignId}`);
  };

  // ── Shared JSX blocks (plain variables, NOT components) ───────────────────
  // These are JSX expressions, not components — no props, no hooks.
  // `fill` variants are separate variables to avoid react-hooks/static-components.

  // ① Details card — always shrink-0
  const detailsCard = (
    <div className={`${card} shrink-0`}>
      <SectionHeader
        icon={Smartphone}
        label="Campaign details"
        chipBg="bg-blue-50"
        chipText="text-blue-500"
        topBarBg="bg-blue-50/40"
      />
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="cc-name" className={fieldLabel}>
            Name <span className="text-red-400 normal-case font-normal">*</span>
          </label>
          <input
            id="cc-name"
            placeholder="e.g. Diwali Sale 2025"
            value={form.name}
            onChange={set('name')}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="cc-session" className={fieldLabel}>
            Send from <span className="text-red-400 normal-case font-normal">*</span>
          </label>
          <select
            id="cc-session"
            value={form.sessionId}
            onChange={e => setForm(prev => ({ ...prev, sessionId: e.target.value }))}
            disabled={sessionsLoading}
            className={selectCls}
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
  );

  // Template picker node (reused inside message card header)
  const templatePicker = !!templates?.length ? (
    <div className="flex items-center gap-1.5">
      <FileText size={11} className="text-[hsl(var(--green))] shrink-0" />
      <select
        value={selectedTemplateId}
        onChange={e => handleTemplateChange(e.target.value)}
        className="h-7 w-48 rounded-md border border-purple-300 bg-purple-500 px-2 text-[11px] font-[600] text-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]/40 cursor-pointer"
      >
        <option value="">Pick a Template</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  // ② Message card — filling variant (desktop left col + mobile message tab)
  const messageFill = (
    <div className={`${card} flex-1 min-h-0 flex flex-col`}>
      <SectionHeader
        icon={MessageSquare}
        label="Message"
        chipBg="bg-[hsl(var(--green-subtle))]"
        chipText="text-[hsl(var(--green))]"
        topBarBg="bg-[hsl(var(--green-subtle))]/60"
        right={templatePicker}
      />
      <div className="p-4 flex-1 min-h-0 flex flex-col gap-2">
        <textarea
          id="cc-message"
          placeholder={'Write your broadcast message here…\n\nHi {name}, we have an exciting offer for you! 🎉'}
          value={form.messageTemplate}
          onChange={set('messageTemplate')}
          className="w-full flex-1 min-h-0 rounded-[var(--radius-sm)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-3 text-[13px] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]/40 focus:border-[hsl(var(--green))]/60 resize-none leading-relaxed transition-colors"
        />
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums shrink-0">
          {form.messageTemplate.length} characters
        </p>
      </div>
    </div>
  );

  // ③ Media card — always shrink-0
  const mediaToggle = (
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
          className={cn(
            'px-2.5 py-1 rounded-md text-[10px] font-[700] transition-all capitalize',
            mediaMode === mode
              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {mode === 'upload' ? 'Upload' : 'URL'}
        </button>
      ))}
    </div>
  );

  const mediaCard = (
    <div className={`${card} shrink-0`}>
      <SectionHeader
        icon={Paperclip}
        label="Media"
        chipBg="bg-amber-50"
        chipText="text-amber-500"
        topBarBg="bg-amber-50/40"
        right={mediaToggle}
      />
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          Optional — attach an image, video, or PDF to your message.
        </p>
        {mediaMode === 'upload' ? (
          <div className="relative">
            <label
              htmlFor="cc-media-file"
              className={cn(
                'flex flex-col items-center justify-center gap-2 py-5 rounded-[var(--radius)] border-2 border-dashed cursor-pointer transition-all',
                mediaUploading
                  ? 'opacity-50 pointer-events-none border-[hsl(var(--border))]'
                  : mediaUrl
                    ? 'border-[hsl(var(--green))]/50 bg-[hsl(var(--green-subtle))]'
                    : 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/50',
              )}
            >
              {mediaUploading ? (
                <>
                  <Upload size={18} className="text-[hsl(var(--muted-foreground))] animate-pulse" />
                  <p className="text-[12px] text-[hsl(var(--muted-foreground))]">Uploading…</p>
                </>
              ) : mediaUrl ? (
                <>
                  {mediaPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="max-h-16 rounded-lg object-cover border border-[hsl(var(--border))]"
                    />
                  ) : (
                    <ImageIcon size={18} className="text-[hsl(var(--green))]" />
                  )}
                  <p className="text-[12px] font-[600] text-[hsl(var(--green))]">✓ {mediaType || 'File'} uploaded</p>
                </>
              ) : (
                <>
                  <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Upload size={16} className="text-amber-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-[500] text-[hsl(var(--foreground))]">
                      Drop a file or click to browse
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">JPG · PNG · MP4 · PDF</p>
                  </div>
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
                className="absolute top-2 right-2 p-1 rounded-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ) : (
          <input
            id="cc-media-url"
            placeholder="https://… image, video, or PDF URL"
            value={mediaUrl}
            className={inputCls}
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
        {hasMedia && (
          <div className="flex items-center gap-2">
            <Link size={12} className="text-[hsl(var(--muted-foreground))] shrink-0" />
            <input
              id="cc-link-url"
              placeholder="Optional link URL (e.g. https://yoursite.com/offer)"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className={inputCls + ' h-8 text-[12px]'}
            />
          </div>
        )}
      </div>
    </div>
  );

  // ④ Recipients card — filling variant
  const recipientsFill = (
    <div className={`${card} flex-1 min-h-0 flex flex-col`}>
      <SectionHeader
        icon={Users}
        label="Recipients"
        chipBg="bg-violet-50"
        chipText="text-violet-500"
        topBarBg="bg-violet-50/40"
      />
      {isEditMode ? (
        <div className="px-4 py-5">
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
            Use the <span className="font-[600] text-[hsl(var(--foreground))]">Add recipients</span> button on this
            campaign to manage recipients. They can&apos;t be changed here.
          </p>
        </div>
      ) : (
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
  );

  // ⑤ Send rate — slim strip
  const sendRateStrip = (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] shrink-0">
      <span className="text-[10px] font-[700] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))] shrink-0">
        Send rate
      </span>
      <input
        type="range"
        min={10}
        max={60}
        step={1}
        value={rateLimitPerMin}
        onChange={e => setRateLimitPerMin(Number(e.target.value))}
        className="flex-1 accent-[hsl(var(--green))]"
      />
      <span className="text-[13px] font-[700] tabular-nums text-[hsl(var(--foreground))] shrink-0 w-16 text-right">
        {rateLimitPerMin}
        <span className="text-[11px] font-[400] text-[hsl(var(--muted-foreground))]"> / min</span>
      </span>
    </div>
  );

  // Action bar
  const actionBar = (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] shrink-0 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CalendarClock size={13} className="text-[hsl(var(--muted-foreground))] shrink-0" />
        <span className="text-[11px] font-[500] text-[hsl(var(--muted-foreground))] shrink-0 hidden sm:block">
          Schedule
        </span>
        <DateTimePicker
          value={form.scheduledAt}
          onChange={v => setForm(prev => ({ ...prev, scheduledAt: v }))}
          placeholder="Send immediately"
          className="w-40 text-[12px]"
        />
      </div>
      <div className="h-5 w-px bg-[hsl(var(--border))] shrink-0 hidden sm:block" />
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={isEditMode ? onSaved : () => router.back()}
          disabled={isPending}
          className="h-8 px-3 text-[12px] font-[500]"
        >
          Cancel
        </Button>
        {!isEditMode && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isPending}
            className="h-8 px-3 text-[12px] font-[500] gap-1.5 min-w-[110px]"
          >
            <Save size={12} />
            {submitStep === 'creating' ? 'Creating…' : submitStep === 'uploading' ? 'Uploading…' : 'Save as Draft'}
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => handleSubmit(!isEditMode)}
          disabled={isPending || (!isEditMode && hasNoRecipients)}
          title={!isEditMode && hasNoRecipients ? 'Add recipients before launching' : undefined}
          className="h-8 px-3 text-[12px] font-[600] gap-1.5 min-w-[120px] bg-[hsl(var(--purple))] text-white hover:opacity-90 shadow-sm disabled:opacity-40"
        >
          <Rocket size={12} />
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
  );

  // Alerts
  const alerts = (
    <>
      {error && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-red-500/10 border border-red-500/25 px-4 py-3 shrink-0">
          <X size={13} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-400">{error}</p>
        </div>
      )}
      {importWarning && (
        <div className="rounded-[var(--radius)] bg-amber-500/10 border border-amber-500/25 px-4 py-3 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-[13px] text-amber-400 font-[500]">
              {importWarning.created} recipient{importWarning.created !== 1 ? 's' : ''} added
              {importWarning.skipped > 0 && `, ${importWarning.skipped} skipped`}
            </p>
          </div>
          {importWarning.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-[11px] text-amber-400/70 pl-5">
              Row {e.row}: {e.reason}
            </p>
          ))}
        </div>
      )}
      {pendingTemplate && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-amber-500/10 border border-amber-500/25 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-[13px] text-amber-400">
              Apply <span className="font-[600]">{pendingTemplate.name}</span>? Replaces current message
              {pendingTemplate.mediaUrl ? ' and media' : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={confirmApplyTemplate}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-[600] bg-amber-500/15 border border-amber-500/30 text-amber-500 hover:bg-amber-500/25 transition-colors"
            >
              <Check size={10} /> Apply
            </button>
            <button
              onClick={cancelApplyTemplate}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );

  // Mobile tab bar
  const MOBILE_TABS: { id: MobileTab; label: string; icon: React.ElementType; activeCls: string; dot: boolean }[] = [
    {
      id: 'message',
      label: 'Message',
      icon: MessageSquare,
      activeCls: 'bg-[hsl(var(--green))] text-white',
      dot: false,
    },
    { id: 'media', label: 'Media', icon: Paperclip, activeCls: 'bg-amber-500 text-white', dot: hasMediaAttached },
    {
      id: 'recipients',
      label: 'Recipients',
      icon: Users,
      activeCls: 'bg-violet-500 text-white',
      dot: hasRecipientsSelected,
    },
  ];

  const mobileTabBar = (
    <div className="flex gap-1.5 p-1 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] shrink-0">
      {MOBILE_TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = mobileTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={cn(
              'relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-sm)] text-[12px] font-[600] transition-all',
              isActive
                ? tab.activeCls
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
            )}
          >
            <Icon size={13} />
            {tab.label}
            {tab.dot && !isActive && (
              <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-[hsl(var(--green))]" />
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-10.5rem)]">
      {actionBar}
      {alerts}

      {/* ── DESKTOP (lg+): two columns, fills height ── */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4 flex-1 min-h-0">
        {/* Left */}
        <div className="flex flex-col gap-4 min-h-0">
          {detailsCard}
          {messageFill}
          {mediaCard}
        </div>
        {/* Right */}
        <div className="flex flex-col gap-4 min-h-0">
          {recipientsFill}
          {sendRateStrip}
        </div>
      </div>

      {/* ── MOBILE (<lg): tabbed, single panel fills height ── */}
      <div className="flex lg:hidden flex-col gap-3 flex-1 min-h-0">
        {mobileTabBar}
        <div className="flex-1 min-h-0">
          {mobileTab === 'message' && (
            <div className="flex flex-col gap-3 h-full min-h-0">
              {detailsCard}
              {messageFill}
            </div>
          )}
          {mobileTab === 'media' && (
            <div className="flex flex-col gap-3 h-full min-h-0 overflow-y-auto">{mediaCard}</div>
          )}
          {mobileTab === 'recipients' && (
            <div className="flex flex-col gap-3 h-full min-h-0">
              {recipientsFill}
              {sendRateStrip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
