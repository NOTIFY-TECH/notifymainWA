'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { tenantApi } from '@/services/tenant-api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!params.token) return;

    let cancelled = false;

    tenantApi
      .verifyEmail(params.token)
      .then(result => {
        if (cancelled) return;
        setStatus('success');
        setMessage(result.data.message);
        setEmail(result.data.email);
      })
      .catch(err => {
        if (cancelled) return;
        setStatus('error');
        setMessage(extractApiError(err) ?? 'This verification link is invalid or has expired.');
      });

    return () => {
      cancelled = true;
    };
  }, [params.token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] p-8 flex flex-col items-center text-center gap-4">
        {status === 'loading' && (
          <>
            <Loader2 size={28} className="animate-spin text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--green))]/12 text-[hsl(var(--green))]">
              <CheckCircle2 size={22} />
            </div>
            <h1 className="text-base font-semibold text-[hsl(var(--foreground))]">Email verified</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {email ? `Your tenant's email is now ${email}.` : message}
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-2 text-xs font-medium text-[hsl(var(--green))] hover:text-[hsl(var(--green))]/80"
            >
              Back to Settings
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/12 text-red-400">
              <XCircle size={22} />
            </div>
            <h1 className="text-base font-semibold text-[hsl(var(--foreground))]">Verification failed</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{message}</p>
            <Link
              href="/dashboard/settings"
              className="mt-2 text-xs font-medium text-[hsl(var(--green))] hover:text-[hsl(var(--green))]/80"
            >
              Back to Settings
            </Link>
          </>
        )}
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
