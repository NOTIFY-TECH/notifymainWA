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
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="relative mx-auto h-16 w-16">
            <div className="h-16 w-16 rounded-2xl bg-[hsl(var(--green-subtle))] flex items-center justify-center">
              <MessageSquare size={26} className="text-[hsl(var(--green))]" />
            </div>
            {/* Decorative ping dot */}
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-[hsl(var(--green))] border-2 border-[hsl(var(--background))]" />
          </div>
          {/* Copy */}
          <div className="space-y-1">
            <p className="text-[14px] font-[600] text-[hsl(var(--foreground))]">Select a conversation</p>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))] max-w-[200px] mx-auto leading-relaxed">
              Choose from the list to start reading and replying
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
