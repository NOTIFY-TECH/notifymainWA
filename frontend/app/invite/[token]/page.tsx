'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useValidateInviteToken, useAcceptInvite } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { setAccessToken } from '@/services/api';
import { ROLE_LABELS } from '@/types/team';
import { Eye, EyeOff, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  // ── Validate token on mount ───────────────────────────────────────────────
  const { data: invite, isLoading: validating, error: tokenError } = useValidateInviteToken(token);

  // ── Form state ────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { mutateAsync: acceptInvite, isPending } = useAcceptInvite(token);
  const setAuth = useAuthStore(s => s.setAuth);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError(null);
    if (!firstName.trim()) return setFormError('First name is required.');
    if (!lastName.trim()) return setFormError('Last name is required.');
    if (password.length < 8) return setFormError('Password must be at least 8 characters.');

    try {
      const result = await acceptInvite({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });

      const { accessToken, user, tenant } = result.data;

      // Store the access token in memory (same pattern as login).
      // The refresh token is no longer in this response body at all — it's
      // set server-side as an httpOnly `refresh_token` cookie by
      // TeamController.acceptInvite, the same way AuthController's
      // login/signup/refresh routes do it. Nothing to do with it here.
      setAccessToken(accessToken);

      // Hydrate the auth store. `tenant` now carries the full shape
      // (slug/plan/isActive/createdAt) directly from acceptInvite's response
      // — no more hand-built defaults like slug: '' or plan: 'BASIC'.
      const now = new Date().toISOString();
      setAuth(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: tenant.id,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan as 'BASIC',
          isActive: tenant.isActive,
          createdAt: tenant.createdAt,
        },
      );

      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = extractApiError(err);
      setFormError(msg ?? 'Failed to create your account. Please try again.');
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (validating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  // ── Invalid / expired token ───────────────────────────────────────────────
  if (tokenError || !invite) {
    const errMsg =
      extractApiError(tokenError) ??
      'This invitation link is invalid or has expired. Ask your admin to send a new one.';

    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Invitation unavailable</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{errMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Accept form ───────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            You&apos;re invited
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">Join {invite.tenantName}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            <span className="font-medium text-[hsl(var(--foreground))]">{invite.inviterName}</span> invited you to join
            as{' '}
            <span className="font-medium text-[hsl(var(--foreground))]">{ROLE_LABELS[invite.role] ?? invite.role}</span>
            . Your account will be created with{' '}
            <span className="font-medium text-[hsl(var(--foreground))]">{invite.email}</span>.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                First name
              </label>
              <input
                type="text"
                placeholder="Rahul"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className={cn(
                  'w-full h-11 rounded-xl px-4 text-sm',
                  'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
                  'focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]',
                  'transition-all duration-150',
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Last name
              </label>
              <input
                type="text"
                placeholder="Sharma"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className={cn(
                  'w-full h-11 rounded-xl px-4 text-sm',
                  'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
                  'focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]',
                  'transition-all duration-150',
                )}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Create password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className={cn(
                  'w-full h-11 rounded-xl px-4 pr-11 text-sm',
                  'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                  'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
                  'focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]',
                  'transition-all duration-150',
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {formError && <p className="text-xs text-red-400">{formError}</p>}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={cn(
              'w-full h-11 rounded-xl text-sm font-semibold',
              'bg-[#22C55E] text-white',
              'hover:bg-[#16a34a] active:scale-[0.98]',
              'transition-all duration-150',
              'flex items-center justify-center gap-2',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Accept & join {invite.tenantName}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
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
