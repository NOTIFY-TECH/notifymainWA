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
      <div className="group relative flex flex-col gap-3 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-sm)] p-4 hover:shadow-[var(--shadow-md)] hover:border-[hsl(var(--border))] transition-all duration-150">
        {/* ── Top row: icon + name + badge ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                isConnected ? 'bg-emerald-50' : 'bg-[hsl(var(--muted))]'
              }`}
            >
              <MonitorSmartphone
                size={18}
                className={isConnected ? 'text-emerald-500' : 'text-[hsl(var(--muted-foreground))]'}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-[600] text-[hsl(var(--foreground))] truncate leading-tight">
                {session.name}
              </p>
              <p className="text-[11.5px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                {session.phoneNumber ?? 'No number linked'}
              </p>
            </div>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {/* ── Meta stats ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2">
            <p className="text-[10.5px] text-[hsl(var(--muted-foreground))] mb-0.5">Messages</p>
            <p className="text-[13px] font-[600] text-[hsl(var(--foreground))]">
              {(session.messagesSent ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2">
            <p className="text-[10.5px] text-[hsl(var(--muted-foreground))] mb-0.5">Last active</p>
            <p className="text-[13px] font-[600] text-[hsl(var(--foreground))] truncate">
              {session.lastSeenAt ? formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true }) : '—'}
            </p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 mt-auto">
          {/* Connected */}
          {isConnected && (
            <>
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] font-[500] text-emerald-600">
                <CheckCircle2 size={13} />
                Active
              </div>
              <button
                onClick={() => setShowUnlinkWarning(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[hsl(var(--border))] text-[12px] text-[hsl(var(--muted-foreground))] hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                title="Remove linked WhatsApp number"
              >
                <Unlink size={13} />
                Remove
              </button>
            </>
          )}

          {/* Disconnected */}
          {isDisconnected && (
            <>
              <button
                onClick={() => onReconnect(session.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] font-[500] text-emerald-600 hover:bg-emerald-100 transition-colors"
              >
                <RefreshCw size={13} />
                Reconnect
              </button>
              <button
                onClick={() => onQrOpen(session.id, session.name)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-[12px] text-violet-600 hover:bg-violet-100 transition-colors"
                title="Scan new QR code"
              >
                <QrCode size={13} />
              </button>
            </>
          )}

          {/* QR waiting */}
          {canScanQr && (
            <button
              onClick={() => onQrOpen(session.id, session.name)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-50 border border-violet-200 text-[12px] font-[500] text-violet-600 hover:bg-violet-100 transition-colors"
            >
              <QrCode size={13} />
              Scan QR
            </button>
          )}

          {/* Delete — appears on hover */}
          <button
            onClick={() => onDelete(session)}
            className="p-2 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Delete session"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Unlink warning modal ── */}
      {showUnlinkWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[var(--radius-lg)] p-6 w-full max-w-sm shadow-[var(--shadow-lg)]">
            <div className="flex items-start gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13.5px] font-[600] text-[hsl(var(--foreground))]">Remove WhatsApp number?</h3>
                <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                  This will disconnect{' '}
                  <span className="font-[500] text-[hsl(var(--foreground))]">{session.phoneNumber}</span> from{' '}
                  <span className="font-[500] text-[hsl(var(--foreground))]">{session.name}</span>. You'll need to scan
                  a new QR code to link a different number.
                </p>
              </div>
              <button
                onClick={() => setShowUnlinkWarning(false)}
                className="p-1 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] shrink-0 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUnlinkWarning(false)}
                className="flex-1 py-2 rounded-lg border border-[hsl(var(--border))] text-[12px] font-[500] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlinkConfirm}
                className="flex-1 py-2 rounded-lg bg-orange-50 border border-orange-200 text-[12px] font-[500] text-orange-600 hover:bg-orange-100 transition-colors"
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
