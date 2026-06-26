'use client';

import { useState } from 'react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useRenameApiKey } from '@/hooks/useApiKeys';
import { useAuthStore } from '@/store/authStore';
import { CreatedApiKey, ApiKey } from '@/types/api-key';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Key, Plus, Trash2, Copy, Check, Loader2, ShieldAlert, Clock, Pencil, X, Eye } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const currentUser = useAuthStore(s => s.user);
  const isOwner = currentUser?.role === 'TENANT_OWNER';

  const { data: keys, isLoading } = useApiKeys();
  const { mutateAsync: createKey, isPending: isCreating } = useCreateApiKey();
  const { mutate: revokeKey } = useRevokeApiKey();
  const { mutate: renameKey } = useRenameApiKey();

  // Generate modal state
  const [showGenerate, setShowGenerate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Newly created key — shown once
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamePending, setRenamePending] = useState(false);

  const handleGenerate = async () => {
    setGenerateError(null);
    if (!newKeyName.trim()) {
      setGenerateError('Key name is required.');
      return;
    }
    try {
      const result = await createKey({
        name: newKeyName.trim(),
        expiresAt: newKeyExpiry ? new Date(newKeyExpiry).toISOString() : undefined,
      });
      setCreatedKey(result.data);
      setShowGenerate(false);
      setNewKeyName('');
      setNewKeyExpiry('');
    } catch {
      setGenerateError('Failed to generate key. Please try again.');
    }
  };

  const handleCopy = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = (keyId: string) => {
    revokeKey(keyId);
    setRevokingId(null);
  };

  const handleRenameSubmit = (keyId: string) => {
    if (!renameValue.trim()) return;
    setRenamePending(true);
    renameKey(
      { keyId, data: { name: renameValue.trim() } },
      {
        onSettled: () => {
          setRenamePending(false);
          setRenamingId(null);
          setRenameValue('');
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            <span className="gradient-text">API Keys</span>
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Authenticate programmatic access to your workspace
          </p>
        </div>
        {isOwner && !createdKey && (
          <Button
            size="sm"
            onClick={() => setShowGenerate(true)}
            className="bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] gap-1.5 shrink-0"
          >
            <Plus size={14} />
            Generate key
          </Button>
        )}
      </div>

      {/* ── One-time key reveal ── */}
      {createdKey && (
        <div className="glass rounded-[var(--radius)] p-5 space-y-4 border border-[hsl(var(--green)/0.25)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--green-dim))]">
              <Eye size={15} className="text-[hsl(var(--green))]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Copy your new API key</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                This is the only time it will be shown. Store it somewhere safe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-[hsl(var(--muted))] px-4 py-2.5 text-xs font-mono text-[hsl(var(--foreground))] break-all select-all">
              {createdKey.rawKey}
            </code>
            <button
              onClick={handleCopy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              aria-label="Copy key"
            >
              {copied ? <Check size={14} className="text-[hsl(var(--green))]" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setCreatedKey(null)}
              className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))] gap-1.5"
            >
              <Check size={13} />
              Done, I&apos;ve saved it
            </Button>
          </div>
        </div>
      )}

      {/* ── Generate modal (inline) ── */}
      {showGenerate && (
        <div className="glass rounded-[var(--radius)] p-5 space-y-4 border border-[hsl(var(--border))]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                <Key size={15} className="text-[hsl(var(--green))]" />
              </div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">New API key</p>
            </div>
            <button
              onClick={() => {
                setShowGenerate(false);
                setGenerateError(null);
                setNewKeyName('');
                setNewKeyExpiry('');
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Key name
              </label>
              <Input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="e.g. Production integration"
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Expiry <span className="normal-case font-normal text-[hsl(var(--muted-foreground))]">(optional)</span>
              </label>
              <Input
                type="date"
                value={newKeyExpiry}
                onChange={e => setNewKeyExpiry(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          {generateError && <p className="text-xs text-red-400">{generateError}</p>}

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() => {
                setShowGenerate(false);
                setGenerateError(null);
              }}
              className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isCreating}
              className="bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] min-w-[110px] gap-1.5"
            >
              {isCreating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate key'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Keys table ── */}
      <div className="glass rounded-[var(--radius)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : !keys?.length ? (
          <EmptyState isOwner={isOwner} onGenerate={() => setShowGenerate(true)} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                {['Name', 'Key', 'Last used', 'Expires', 'Created', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] first:pl-5 last:pr-5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {keys.map(key => (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  isOwner={isOwner}
                  isRenaming={renamingId === key.id}
                  renameValue={renameValue}
                  renamePending={renamePending}
                  isConfirmingRevoke={revokingId === key.id}
                  onRenameStart={() => {
                    setRenamingId(key.id);
                    setRenameValue(key.name);
                  }}
                  onRenameChange={setRenameValue}
                  onRenameSubmit={() => handleRenameSubmit(key.id)}
                  onRenameCancel={() => {
                    setRenamingId(null);
                    setRenameValue('');
                  }}
                  onRevokeRequest={() => setRevokingId(key.id)}
                  onRevokeConfirm={() => handleRevoke(key.id)}
                  onRevokeCancel={() => setRevokingId(null)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Security note ── */}
      <div className="flex items-start gap-2.5 rounded-lg bg-[hsl(var(--muted))] px-4 py-3">
        <ShieldAlert size={14} className="text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
          API keys grant full programmatic access to your workspace. Never share them publicly or commit them to version
          control. Revoke any key you suspect has been compromised.
        </p>
      </div>
    </div>
  );
}

// ─── Key Row ──────────────────────────────────────────────────────────────────

function KeyRow({
  apiKey,
  isOwner,
  isRenaming,
  renameValue,
  renamePending,
  isConfirmingRevoke,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onRevokeRequest,
  onRevokeConfirm,
  onRevokeCancel,
}: {
  apiKey: ApiKey;
  isOwner: boolean;
  isRenaming: boolean;
  renameValue: string;
  renamePending: boolean;
  isConfirmingRevoke: boolean;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onRevokeRequest: () => void;
  onRevokeConfirm: () => void;
  onRevokeCancel: () => void;
}) {
  const isExpired = apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false;

  return (
    <tr className="group hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
      {/* Name */}
      <td className="pl-5 pr-4 py-3">
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRenameSubmit();
                if (e.key === 'Escape') onRenameCancel();
              }}
              className="h-7 text-xs py-0 w-40"
              autoFocus
            />
            <button
              onClick={onRenameSubmit}
              disabled={renamePending}
              className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--green))] hover:bg-[hsl(var(--green-dim))] transition-colors"
            >
              {renamePending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            </button>
            <button
              onClick={onRenameCancel}
              className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-[hsl(var(--foreground))]">{apiKey.name}</span>
            {isOwner && (
              <button
                onClick={onRenameStart}
                className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all"
                aria-label="Rename key"
              >
                <Pencil size={11} />
              </button>
            )}
          </div>
        )}
      </td>

      {/* Key prefix */}
      <td className="px-4 py-3">
        <code className="text-[11px] font-mono bg-[hsl(var(--muted))] px-2 py-0.5 rounded text-[hsl(var(--foreground))]">
          {apiKey.keyPrefix}…
        </code>
      </td>

      {/* Last used */}
      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        {apiKey.lastUsedAt ? (
          formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })
        ) : (
          <span className="italic">Never</span>
        )}
      </td>

      {/* Expires */}
      <td className="px-4 py-3">
        {apiKey.expiresAt ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium',
              isExpired ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]',
            )}
          >
            <Clock size={11} className="shrink-0" />
            {isExpired ? 'Expired' : format(new Date(apiKey.expiresAt), 'MMM d, yyyy')}
          </span>
        ) : (
          <span className="text-xs text-[hsl(var(--muted-foreground))] italic">No expiry</span>
        )}
      </td>

      {/* Created */}
      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
      </td>

      {/* Actions */}
      <td className="pl-4 pr-5 py-3">
        {isOwner &&
          (isConfirmingRevoke ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-400 font-medium">Revoke?</span>
              <button
                onClick={onRevokeConfirm}
                className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={onRevokeCancel}
                className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={onRevokeRequest}
              className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-all"
              aria-label="Revoke key"
            >
              <Trash2 size={13} />
            </button>
          ))}
      </td>
    </tr>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ isOwner, onGenerate }: { isOwner: boolean; onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
        <Key size={22} className="text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">No API keys yet</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
          {isOwner
            ? 'Generate a key to authenticate programmatic access to your workspace.'
            : 'Only the workspace owner can manage API keys.'}
        </p>
      </div>
      {isOwner && (
        <Button
          size="sm"
          onClick={onGenerate}
          className="bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] gap-1.5 mt-1"
        >
          <Plus size={13} />
          Generate your first key
        </Button>
      )}
    </div>
  );
}
