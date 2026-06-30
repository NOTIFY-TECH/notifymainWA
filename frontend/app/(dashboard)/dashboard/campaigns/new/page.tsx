'use client';

import { useRouter } from 'next/navigation';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { ArrowLeft, Megaphone } from 'lucide-react';

export default function NewCampaignPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
          <Megaphone size={16} />
        </div>

        <div>
          <p className="text-[11px] font-[600] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
            Marketing
          </p>
          <h1 className="text-[15px] font-[600] tracking-tight text-[hsl(var(--foreground))] leading-tight">
            New Campaign
          </h1>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="flex-1 min-h-0">
        <CreateCampaignForm />
      </div>
    </div>
  );
}
