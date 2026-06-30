import { Plus, MonitorSmartphone } from 'lucide-react';

export function SessionsEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--green-dim))] mb-4">
        <MonitorSmartphone size={28} className="text-[hsl(var(--green))]" />
      </div>
      <h3 className="text-[14px] font-[600] text-[hsl(var(--foreground))] mb-1">No sessions yet</h3>
      <p className="text-[13px] text-[hsl(var(--muted-foreground))] max-w-xs mb-6 leading-relaxed">
        Connect your first WhatsApp number to start sending messages and campaigns.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(var(--green))] text-white text-[13px] font-[500] hover:opacity-90 transition-opacity shadow-[0_2px_8px_hsl(142_71%_35%/0.25)]"
      >
        <Plus size={15} />
        New session
      </button>
    </div>
  );
}
