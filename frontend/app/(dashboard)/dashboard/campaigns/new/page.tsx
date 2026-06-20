'use client';

import { useRouter } from 'next/navigation';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { ArrowLeft } from 'lucide-react';

export default function NewCampaignPage() {
  const router = useRouter();

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-4"
          aria-label="Back"
        >
          <ArrowLeft size={13} />
          Back to campaigns
        </button>
        <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
          Marketing
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">New campaign</h1>
      </div>

      <CreateCampaignForm />
    </div>
  );
}
