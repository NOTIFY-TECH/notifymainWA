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
      {/* Left panel — conversation list */}
      <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 flex flex-col">
        <ConversationList activeId={null} onSelect={handleSelect} />
      </div>

      {/* Right panel — empty state (desktop only) */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-[hsl(var(--background))] border-l border-[hsl(var(--border))]">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center">
            <MessageSquare size={24} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Select a conversation</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-[200px]">
            Choose a conversation from the list to start reading and replying
          </p>
        </div>
      </div>
    </div>
  );
}
