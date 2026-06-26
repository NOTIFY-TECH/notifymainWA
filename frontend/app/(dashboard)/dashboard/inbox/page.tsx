'use client';

import { useRouter } from 'next/navigation';
import ConversationList from '@/components/inbox/ConversationList';
import { MessageSquare } from 'lucide-react';

export default function InboxPage() {
  const router = useRouter();

  const handleSelect = (id: string) => {
    router.push(`/dashboard/inbox/${id}`);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 sm:-m-6 overflow-hidden">
      {/* Left panel */}
      <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 flex flex-col border-r border-[hsl(var(--border))]">
        <ConversationList activeId={null} onSelect={handleSelect} />
      </div>

      {/* Right panel — desktop empty state */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--muted))] mx-auto">
            <MessageSquare size={20} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Select a conversation</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Choose from the list to start reading and replying
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
