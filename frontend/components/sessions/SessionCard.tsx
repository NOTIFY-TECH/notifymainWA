import { useState } from 'react';
import { Trash2, QrCode, CheckCircle2, MonitorSmartphone, RefreshCw, Unlink, AlertTriangle, X } from 'lucide-react';
import { Session } from '@/types/session';
import { StatusBadge } from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface SessionCardProps {
  session: Session;
  onQrOpen: (id: string, name: string) => void;
  onDelete: (session: Session) => void;
  onReconnect: (id: string) => void;
  onUnlink: (id: string) => void;
}

export function SessionCard({ session, onQrOpen, onDelete, onReconnect, onUnlink }: SessionCardProps) {
  const [showUnlinkWarning, setShowUnlinkWarning] = useState(false);

  const isConnected = session.status === 'CONNECTED';
  const isDisconnected = session.status === 'DISCONNECTED';
  const canScanQr = session.status === 'QR_READY' || session.status === 'PENDING' || session.status === 'INITIALIZING';

  const handleUnlinkConfirm = () => {
    setShowUnlinkWarning(false);
    onUnlink(session.id);
  };

  return (
    <>
      <div className="glass rounded-xl p-4 flex flex-col gap-3 group hover:border-[hsl(var(--border))] transition-colors relative">
        {/* top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-[#22C55E]/15' : 'bg-[hsl(var(--muted))]'}`}
            >
              <MonitorSmartphone
                className={`w-5 h-5 ${isConnected ? 'text-[hsl(var(--green))]' : 'text-[hsl(var(--muted-foreground))]'}`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{session.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                {session.phoneNumber ?? 'No number linked'}
              </p>
            </div>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {/* meta */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[hsl(var(--muted))] rounded-lg px-3 py-2">
            <p className="text-[hsl(var(--muted-foreground))] mb-0.5">Messages</p>
            <p className="text-[hsl(var(--foreground))] font-medium">{(session.messagesSent ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-[hsl(var(--muted))] rounded-lg px-3 py-2">
            <p className="text-[hsl(var(--muted-foreground))] mb-0.5">Last active</p>
            <p className="text-[hsl(var(--foreground))] font-medium truncate">
              {session.lastSeenAt ? formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true }) : '—'}
            </p>
          </div>
        </div>

        {/* actions */}
        <div className="flex gap-2 mt-auto">
          {/* Connected state */}
          {isConnected && (
            <>
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 text-xs text-[hsl(var(--green))]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
              </div>
              <button
                onClick={() => setShowUnlinkWarning(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] hover:text-orange-500 hover:border-orange-500/30 hover:bg-orange-500/10 transition-colors"
                title="Remove linked WhatsApp number"
              >
                <Unlink className="w-3.5 h-3.5" />
                Remove
              </button>
            </>
          )}

          {/* Disconnected state */}
          {isDisconnected && (
            <>
              <button
                onClick={() => onReconnect(session.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 text-xs text-[hsl(var(--green))] hover:bg-[#22C55E]/20 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
              <button
                onClick={() => onQrOpen(session.id, session.name)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/25 text-xs text-purple-600 dark:text-purple-400 hover:bg-[#A855F7]/25 transition-colors"
                title="Scan new QR code"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* QR waiting / initializing state */}
          {canScanQr && (
            <button
              onClick={() => onQrOpen(session.id, session.name)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/25 text-xs text-purple-600 dark:text-purple-400 hover:bg-[#A855F7]/25 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              Scan QR
            </button>
          )}

          {/* Delete — always visible on hover */}
          <button
            onClick={() => onDelete(session)}
            className="p-2 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Delete session"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Unlink warning modal */}
      {showUnlinkWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Remove WhatsApp number?</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  This will disconnect{' '}
                  <span className="font-medium text-[hsl(var(--foreground))]">{session.phoneNumber}</span> from{' '}
                  <span className="font-medium text-[hsl(var(--foreground))]">{session.name}</span>. You&apos;ll need to
                  scan a new QR code to link a different number.
                </p>
              </div>
              <button
                onClick={() => setShowUnlinkWarning(false)}
                className="p-1 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUnlinkWarning(false)}
                className="flex-1 py-2 rounded-lg border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlinkConfirm}
                className="flex-1 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-xs text-orange-500 hover:bg-orange-500/25 transition-colors font-medium"
              >
                Yes, remove number
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
