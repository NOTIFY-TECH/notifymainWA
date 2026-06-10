import { Trash2, Loader2 } from 'lucide-react';
import { Session } from '@/types/session';

interface DeleteSessionModalProps {
  session: Session;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function DeleteSessionModal({ session, onCancel, onConfirm, isLoading }: DeleteSessionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="relative w-full max-w-sm mx-4 glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">Delete session</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{session.name}</p>
          </div>
        </div>

        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          This will disconnect the WhatsApp number and remove all session data. This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
