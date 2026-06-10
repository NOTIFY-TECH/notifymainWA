'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, AlertTriangle, Signal } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '@/services/sessions-api';

interface QrModalProps {
  sessionId: string;
  sessionName: string;
  onClose: () => void;
  onConnected: () => void;
}

export function QrModal({ sessionId, sessionName, onClose, onConnected }: QrModalProps) {
  const [qrData, setQrData] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const fetchQr = useCallback(async () => {
    try {
      const res = await sessionsApi.getQr(sessionId);
      if (res.status === 'CONNECTED') {
        clearInterval(intervalRef.current!);
        onConnected();
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
        return;
      }
      if (res.qrCode) {
        const raw = res.qrCode.startsWith('data:') ? res.qrCode.split(',')[1] : res.qrCode;
        setQrData(raw);
        setPollError(false);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // Session no longer exists on engine — stop polling
        clearInterval(intervalRef.current!);
      }
      setPollError(true);
    }
  }, [sessionId, onConnected, queryClient]);

  useEffect(() => {
    const timer = setTimeout(fetchQr, 0);
    intervalRef.current = setInterval(fetchQr, 2000);
    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchQr]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-sm mx-4 glass rounded-2xl p-6 animate-fade-in">
        {/* header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">Scan to connect</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 truncate max-w-[200px]">{sessionName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR area */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-56 h-56 bg-white rounded-xl flex items-center justify-center overflow-hidden">
            {pollError ? (
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <p className="text-xs text-gray-500">Failed to load QR</p>
              </div>
            ) : qrData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${qrData}`}
                alt="WhatsApp QR Code"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
                <p className="text-xs text-gray-400">Generating QR…</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Signal className="w-3.5 h-3.5 text-green-500 animate-pulse" />
            Waiting for scan · refreshes every 2s
          </div>
        </div>

        {/* instructions */}
        <ol className="mt-5 space-y-1.5 text-xs text-[hsl(var(--muted-foreground))] list-decimal list-inside">
          <li>Open WhatsApp on your phone</li>
          <li>Go to Settings → Linked Devices</li>
          <li>Tap &ldquo;Link a Device&rdquo; and scan</li>
        </ol>
      </div>
    </div>
  );
}
