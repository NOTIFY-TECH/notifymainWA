'use client';

import { useState } from 'react';
import {
  useCampaignTemplates,
  useCreateCampaignTemplate,
  useUpdateCampaignTemplate,
  useDeleteCampaignTemplate,
} from '@/hooks/useCampaignTemplates';
import { CampaignTemplate } from '@/types/campaign-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/authStore';
import { messagesApi } from '@/services/messages-api';
import { Plus, Pencil, Trash2, X, Image, FileText, Check } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mediaLabel(mediaType: string | null): string {
  if (!mediaType) return '';
  if (mediaType.startsWith('image/')) return 'Image';
  if (mediaType.startsWith('video/')) return 'Video';
  if (mediaType === 'application/pdf') return 'PDF';
  return 'Media';
}

const inputClass =
  'h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm ' +
  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] ' +
  'focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] ' +
  'transition-colors hover:border-[hsl(var(--green)/0.35)]';

// ─── Template Form (shared for create + edit) ─────────────────────────────────

interface TemplateFormProps {
  initial?: CampaignTemplate;
  onCancel: () => void;
  onSaved: () => void;
}

function TemplateForm({ initial, onCancel, onSaved }: TemplateFormProps) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [messageBody, setMessageBody] = useState(initial?.messageBody ?? '');
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? '');
  const [mediaType, setMediaType] = useState(initial?.mediaType ?? '');
  const [mediaMode, setMediaMode] = useState<'upload' | 'url'>(initial?.mediaUrl ? 'url' : 'upload');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(
    initial?.mediaType?.startsWith('image/') ? initial.mediaUrl : null,
  );
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: create, isPending: creating } = useCreateCampaignTemplate();
  const { mutateAsync: update, isPending: updating } = useUpdateCampaignTemplate(initial?.id ?? '');
  const isPending = creating || updating || mediaUploading;

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

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) return setError('Template name is required.');
    if (!messageBody.trim()) return setError('Message body is required.');

    try {
      if (isEdit) {
        await update({
          name: name.trim(),
          messageBody: messageBody.trim(),
          mediaUrl: mediaUrl.trim() || null,
          mediaType: mediaType || null,
        });
      } else {
        await create({
          name: name.trim(),
          messageBody: messageBody.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType: mediaType || undefined,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;
      setError(typeof msg === 'string' ? msg : 'Failed to save template.');
    }
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] border-l-2 border-l-[hsl(var(--green))] bg-[hsl(var(--card))] p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{isEdit ? 'Edit template' : 'New template'}</p>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Template name <span className="text-red-400 normal-case">*</span>
        </label>
        <Input placeholder="e.g. Diwali Offer" value={name} onChange={e => setName(e.target.value)} />
      </div>

      {/* Message body */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Message <span className="text-red-400 normal-case">*</span>
        </label>
        <textarea
          rows={4}
          placeholder="Write your message here… use {{name}} for personalisation."
          value={messageBody}
          onChange={e => setMessageBody(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))] resize-none"
        />
      </div>

      {/* Media — upload or URL, matching CreateCampaignForm */}
      <div className="rounded-xl border border-[hsl(var(--border))] border-l-2 border-l-amber-500 bg-[hsl(var(--card))] p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Media{' '}
            <span className="normal-case tracking-normal font-normal text-[hsl(var(--muted-foreground))]">
              (optional)
            </span>
          </label>
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

        {mediaMode === 'upload' ? (
          <div className="relative">
            <label
              htmlFor="ct-media-file"
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
              id="ct-media-file"
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
            id="ct-media-url"
            placeholder="https://… image, video, or PDF URL"
            value={mediaUrl}
            className={inputClass}
            onChange={e => {
              const url = e.target.value;
              setMediaUrl(url);
              const lower = url.toLowerCase();
              if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) setMediaType('image/jpeg');
              else if (lower.match(/\.mp4$/)) setMediaType('video/mp4');
              else if (lower.match(/\.pdf$/)) setMediaType('application/pdf');
              else setMediaType('');
            }}
          />
        )}

        {mediaType && <p className="text-[11px] text-[hsl(var(--green))] mt-2">Detected: {mediaLabel(mediaType)}</p>}

        {mediaPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaPreview}
            alt="Preview"
            className="mt-3 rounded-lg max-h-16 object-cover border border-[hsl(var(--border))]"
          />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
        >
          {isPending ? (mediaUploading ? 'Uploading…' : 'Saving…') : isEdit ? 'Save changes' : 'Create template'}
        </Button>
      </div>
    </div>
  );
}

// ─── Template Row ─────────────────────────────────────────────────────────────

interface TemplateRowProps {
  template: CampaignTemplate;
  onEdit: () => void;
}

function TemplateRow({ template, onEdit }: TemplateRowProps) {
  const { mutate: remove, isPending } = useDeleteCampaignTemplate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4 flex items-start gap-4">
      {/* Icon */}
      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center">
        {template.mediaUrl ? (
          <Image className="w-4 h-4 text-[hsl(var(--green))]" />
        ) : (
          <FileText className="w-4 h-4 text-[hsl(var(--green))]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{template.name}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">{template.messageBody}</p>
        {template.mediaUrl && (
          <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            {mediaLabel(template.mediaType)} attached
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        {confirmDelete ? (
          <>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Delete?</span>
            <button
              onClick={() => remove(template.id)}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
            >
              <Check className="w-3 h-3" />
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              aria-label="Edit template"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              aria-label="Delete template"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { data: templates = [], isLoading } = useCampaignTemplates();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Campaign Templates</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Reusable message templates you can apply when creating a campaign.
          </p>
        </div>
        {!showCreate && (
          <Button
            size="sm"
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
            }}
            className="gap-1.5 bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
          >
            <Plus className="w-3.5 h-3.5" />
            New template
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && <TemplateForm onCancel={() => setShowCreate(false)} onSaved={() => setShowCreate(false)} />}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center">
          <FileText className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No templates yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 mb-4">
            Create a template to quickly fill in campaign messages.
          </p>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="gap-1.5 bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Create first template
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map(t =>
            editingId === t.id ? (
              <TemplateForm
                key={t.id}
                initial={t}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <TemplateRow
                key={t.id}
                template={t}
                onEdit={() => {
                  setEditingId(t.id);
                  setShowCreate(false);
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
