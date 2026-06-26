'use client';

import { useRouter } from 'next/navigation';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { ArrowLeft } from 'lucide-react';

export default function NewCampaignPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full gap-0">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-2 self-start"
        aria-label="Back"
      >
        <ArrowLeft size={12} />
        Back to campaigns
      </button>

      <div className="flex-1 min-h-0">
        <CreateCampaignForm />
      </div>
    </div>
  );
}
