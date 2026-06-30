'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import ConversationList from '@/components/inbox/ConversationList';
import ThreadView from '@/components/inbox/ThreadView';

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationPage({ params }: Props) {
  const router = useRouter();
  const { conversationId } = use(params);

  const handleSelect = (id: string) => {
    router.push(`/dashboard/inbox/${id}`);
  };

  const handleBack = () => {
    router.push('/dashboard/inbox');
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 sm:-m-6 overflow-hidden">
      {/* Conversation list — white card surface */}
      <div className="hidden md:flex w-[320px] lg:w-[360px] shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <ConversationList activeId={conversationId} onSelect={handleSelect} />
      </div>
      {/* Thread panel — slightly off-white page background for depth */}
      <div className="flex-1 flex flex-col min-w-0 bg-[hsl(var(--background))]">
        <ThreadView key={conversationId} conversationId={conversationId} onBack={handleBack} />
      </div>
    </div>
  );
}
