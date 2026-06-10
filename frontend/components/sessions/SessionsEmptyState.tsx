import { Plus, MonitorSmartphone } from 'lucide-react';

export function SessionsEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mb-4">
        <MonitorSmartphone className="w-8 h-8 text-[hsl(var(--green))]" />
      </div>
      <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">No sessions yet</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs mb-6">
        Connect your first WhatsApp number to start sending messages and campaigns.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22C55E]/20 border border-[#22C55E]/30 text-sm text-[hsl(var(--green))] hover:bg-[#22C55E]/30 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New session
      </button>
    </div>
  );
}
