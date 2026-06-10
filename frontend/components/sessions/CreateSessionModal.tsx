import { useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';

interface CreateSessionModalProps {
  onCancel: () => void;
  onCreate: (name: string) => void;
  isLoading: boolean;
}

export function CreateSessionModal({ onCancel, onCreate, isLoading }: CreateSessionModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="relative w-full max-w-sm mx-4 glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">New session</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Connect a WhatsApp number</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5" htmlFor="sess-name">
            Session name
          </label>
          <input
            id="sess-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Sales India, Support Team"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--green))] transition-colors"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            className="flex-1 py-2.5 rounded-xl bg-[#22C55E]/20 border border-[#22C55E]/30 text-sm text-[hsl(var(--green))] hover:bg-[#22C55E]/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
