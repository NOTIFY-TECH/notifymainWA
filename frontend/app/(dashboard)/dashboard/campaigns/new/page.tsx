'use client';

import { useRouter } from 'next/navigation';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { ArrowLeft } from 'lucide-react';

export default function NewCampaignPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">New campaign</h1>
      </div>

      <CreateCampaignForm />
    </div>
  );
}
