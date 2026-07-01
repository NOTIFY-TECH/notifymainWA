'use client';

import { useState } from 'react';
import {
  useTenantProfile,
  useUpdateTenantProfile,
  useResendVerification,
  useOwnerAway,
  useCancelOwnerAway,
} from '@/hooks/useTenant';
import { useAuthStore } from '@/store/authStore';
import { TenantProfile } from '@/types/tenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Mail,
  Hash,
  Calendar,
  Users,
  MessageSquare,
  Smartphone,
  UserX,
  ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsProfilePage() {
  const { data: profile, isLoading } = useTenantProfile();

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  return <ProfileForm key={profile.id} profile={profile} />;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function ProfileForm({ profile }: { profile: TenantProfile }) {
  const currentUser = useAuthStore(s => s.user);
  const isOwner = currentUser?.role === 'TENANT_OWNER';
  const isAdmin = currentUser?.role === 'TENANT_ADMIN';

  const { mutateAsync: updateProfile, isPending: isSaving } = useUpdateTenantProfile();
  const { mutate: resendVerification, isPending: isResending } = useResendVerification();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isDirty = name !== profile.name || email !== profile.email;

  const handleSave = async () => {
    setError(null);
    setSavedMessage(null);
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      const result = await updateProfile({
        name: name !== profile.name ? name.trim() : undefined,
        email: email !== profile.email ? email.trim() : undefined,
      });
      setSavedMessage(
        result.verificationSent
          ? "Saved. Check the new email address for a confirmation link — your email won't change until it's verified."
          : 'Changes saved.',
      );
    } catch (err: unknown) {
      setError(extractApiError(err) ?? 'Failed to save changes. Please try again.');
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold">
          <span className="gradient-text">Workspace Profile</span>
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
          Manage your tenant name, contact email, and workspace details
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left col: editable fields ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profile card */}
          <div className="glass rounded-[var(--radius)] p-5 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                <Building2 size={15} className="text-[hsl(var(--green))]" />
              </div>
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Tenant profile</h2>
            </div>

            <div className="space-y-4">
              <Field label="Workspace name" htmlFor="tenant-name">
                <Input
                  id="tenant-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isOwner}
                  placeholder="Your company name"
                  className={cn(!isOwner && 'opacity-60 cursor-not-allowed')}
                />
              </Field>

              <Field label="Contact email" htmlFor="tenant-email">
                <Input
                  id="tenant-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={!isOwner}
                  placeholder="contact@yourcompany.com"
                  className={cn(!isOwner && 'opacity-60 cursor-not-allowed')}
                />
                {!isOwner && (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
                    Only the workspace owner can edit these fields.
                  </p>
                )}
              </Field>
            </div>

            {/* Pending verification banner */}
            {profile.pendingEmail && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-amber-400">Verification pending</p>
                  <p className="text-[11px] text-amber-400/70">
                    Confirmation link sent to{' '}
                    <span className="font-semibold text-amber-400">{profile.pendingEmail}</span>
                    {profile.emailVerifyExpiresAt && (
                      <> · expires {formatDistanceToNow(new Date(profile.emailVerifyExpiresAt), { addSuffix: true })}</>
                    )}
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => {
                      setSavedMessage(null);
                      resendVerification();
                    }}
                    disabled={isResending}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isResending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Resend
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/8 border border-red-500/20 px-4 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Success */}
            {savedMessage && (
              <div className="flex items-start gap-2.5 rounded-lg bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.2)] px-4 py-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--green))] shrink-0 mt-0.5" />
                <p className="text-xs text-[hsl(var(--green))]">{savedMessage}</p>
              </div>
            )}

            {isOwner && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="bg-[hsl(var(--green-dim))] border border-[hsl(var(--green)/0.25)] text-[hsl(var(--green))] hover:bg-[hsl(var(--green)/0.2)] min-w-[96px] gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Owner-away delegation card — Owner (full control) or Admin (read-only) */}
          {(isOwner || isAdmin) && <OwnerAwayCard profile={profile} isOwner={isOwner} />}
        </div>

        {/* ── Right col: read-only meta ── */}
        <div className="space-y-4">
          {/* Plan badge */}
          <div className="glass rounded-[var(--radius)] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                <ShieldCheck size={15} className="text-[hsl(var(--purple))]" />
              </div>
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Plan & limits</h2>
            </div>

            <div className="space-y-3">
              <MetaRow
                icon={ShieldCheck}
                iconClass="text-[hsl(var(--purple))]"
                label="Current plan"
                value={
                  <span className="badge-purple uppercase text-[10px] tracking-wider font-semibold">
                    {profile.plan}
                  </span>
                }
              />
              <MetaRow
                icon={Smartphone}
                iconClass="text-[hsl(var(--green))]"
                label="Sessions"
                value={`${profile.maxSessions} max`}
              />
              <MetaRow
                icon={MessageSquare}
                iconClass="text-[hsl(var(--green))]"
                label="Messages"
                value={profile.maxMessages.toLocaleString()}
              />
              <MetaRow
                icon={Users}
                iconClass="text-[hsl(var(--green))]"
                label="Contacts"
                value={profile.maxContacts.toLocaleString()}
              />
            </div>
          </div>

          {/* Workspace meta */}
          <div className="glass rounded-[var(--radius)] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                <Hash size={15} className="text-[hsl(var(--muted-foreground))]" />
              </div>
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Workspace info</h2>
            </div>

            <div className="space-y-3">
              <MetaRow
                icon={Hash}
                iconClass="text-[hsl(var(--muted-foreground))]"
                label="Slug"
                value={
                  <span className="font-mono text-[11px] bg-[hsl(var(--muted))] px-2 py-0.5 rounded text-[hsl(var(--foreground))]">
                    {profile.slug}
                  </span>
                }
              />
              <MetaRow
                icon={Mail}
                iconClass="text-[hsl(var(--muted-foreground))]"
                label="Status"
                value={
                  profile.isActive ? (
                    <span className="badge-green text-[10px]">Active</span>
                  ) : (
                    <span className="text-xs text-red-400">Inactive</span>
                  )
                }
              />
              <MetaRow
                icon={Calendar}
                iconClass="text-[hsl(var(--muted-foreground))]"
                label="Created"
                value={format(new Date(profile.createdAt), 'MMM d, yyyy')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Owner-away delegation card (NEW — RBAC hierarchy feature) ────────────────
//
// Owner: full toggle. Not away → "Mark as away" activates a 7-day
// delegation window (server-side, resets from now if called again while
// already active). Away → shows expiry + a "Cancel" button to end early.
//
// Admin: read-only. Only rendered at all while a window is active — Admin
// cannot activate, extend, or cancel delegation (owner-away/cancel is
// Owner-only server-side, and Admin self-deescalation was explicitly
// disallowed per the RBAC spec), so there's nothing actionable to show
// when no window is active.

function OwnerAwayCard({ profile, isOwner }: { profile: TenantProfile; isOwner: boolean }) {
  const { mutate: ownerAway, isPending: isActivating } = useOwnerAway();
  const { mutate: cancelOwnerAway, isPending: isCancelling } = useCancelOwnerAway();

  const isAway = !!profile.ownerAwayUntil && new Date(profile.ownerAwayUntil) > new Date();

  // Admin viewing while no window is active — nothing to show.
  if (!isOwner && !isAway) return null;

  return (
    <div className="glass rounded-[var(--radius)] p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
          <UserX size={15} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Owner-away delegation</h2>
          {isOwner && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Temporarily grant Admin access to billing and profile settings
            </p>
          )}
        </div>
      </div>

      {isAway ? (
        <div className="flex items-start gap-3 rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-xs font-medium text-amber-400">{isOwner ? 'You are marked away' : 'Owner is away'}</p>
            <p className="text-[11px] text-amber-400/70">
              Admin has delegated access until{' '}
              <span className="font-semibold text-amber-400">
                {format(new Date(profile.ownerAwayUntil as string), 'MMM d, yyyy, h:mm a')}
              </span>{' '}
              ({formatDistanceToNow(new Date(profile.ownerAwayUntil as string), { addSuffix: true })})
            </p>
          </div>
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelOwnerAway()}
              disabled={isCancelling}
              className="shrink-0 text-xs h-7"
            >
              {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'End now'}
            </Button>
          )}
        </div>
      ) : (
        isOwner && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] max-w-sm">
              While away, an Admin can edit company profile and billing settings on your behalf for up to 7 days.
              Destructive actions like deleting the workspace stay owner-only regardless.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => ownerAway()}
              disabled={isActivating}
              className="shrink-0 text-xs h-7 gap-1.5"
            >
              {isActivating ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
              Mark as away
            </Button>
          </div>
        )
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function MetaRow({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={13} className={cn('shrink-0', iconClass)} />
        <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{label}</span>
      </div>
      <div className="text-xs font-medium text-[hsl(var(--foreground))] shrink-0">{value}</div>
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
