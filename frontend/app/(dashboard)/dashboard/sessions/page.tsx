'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { sessionsApi } from '@/services/sessions-api';
import { useNotificationStore } from '@/store/notificationStore';
import { Session, SessionStatus } from '@/types/session';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SessionCard } from '@/components/sessions/SessionCard';
import { SessionCardSkeleton } from '@/components/sessions/SessionCardSkeleton';
import { SessionsSummaryStrip } from '@/components/sessions/SessionsSummaryStrip';
import { SessionsEmptyState } from '@/components/sessions/SessionsEmptyState';
import { CreateSessionModal } from '@/components/sessions/CreateSessionModal';
import { DeleteSessionModal } from '@/components/sessions/DeleteSessionModal';
import { QrModal } from '@/components/sessions/QrModal';

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useNotificationStore();

  const [showCreate, setShowCreate] = useState(false);
  const [qrTarget, setQrTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
    refetchInterval: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => sessionsApi.create({ name }),
    onSuccess: newSession => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setShowCreate(false);
      success('Session created');
      setQrTarget({ id: newSession.id, name: newSession.name });
    },
    onError: () => error('Failed to create session'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setDeleteTarget(null);
      success('Session deleted');
    },
    onError: () => error('Failed to delete session'),
  });

  const reconnectMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.reconnect(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      const session = sessions?.find(s => s.id === id);
      if (session) setQrTarget({ id: session.id, name: session.name });
      success('Reconnecting… please wait');
    },
    onError: () => error('Failed to reconnect session'),
  });

  const unlinkMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.unlink(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      const session = sessions?.find(s => s.id === id);
      if (session) setQrTarget({ id: session.id, name: session.name });
      success('Number removed — scan QR to link a new one');
    },
    onError: () => error('Failed to remove WhatsApp number'),
  });

  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    const handler = ({ sessionId, status }: { sessionId: string; status: SessionStatus }) => {
      queryClient.setQueryData<Session[]>(
        ['sessions'],
        prev => prev?.map(s => (s.id === sessionId ? { ...s, status } : s)) ?? [],
      );
    };
    subscribe<{ sessionId: string; status: SessionStatus }>('session:status', handler);
    return () => unsubscribe('session:status', handler);
  }, [subscribe, unsubscribe, queryClient]);

  const handleQrConnected = useCallback(() => {
    setQrTarget(null);
    success('WhatsApp connected successfully!');
  }, [success]);

  const connectedCount = sessions?.filter(s => s.status === 'CONNECTED').length ?? 0;
  const totalCount = sessions?.length ?? 0;

  return (
    <>
      {showCreate && (
        <CreateSessionModal
          onCancel={() => setShowCreate(false)}
          onCreate={name => createMutation.mutate(name)}
          isLoading={createMutation.isPending}
        />
      )}
      {qrTarget && (
        <QrModal
          sessionId={qrTarget.id}
          sessionName={qrTarget.name}
          onClose={() => setQrTarget(null)}
          onConnected={handleQrConnected}
        />
      )}
      {deleteTarget && (
        <DeleteSessionModal
          session={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isLoading={deleteMutation.isPending}
        />
      )}

      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-[600] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
              WhatsApp
            </p>
            <h1 className="text-[20px] font-[700] tracking-tight text-[hsl(var(--foreground))] mt-0.5">Sessions</h1>
            <p className="text-[12.5px] text-[hsl(var(--muted-foreground))] mt-1">
              {isLoading
                ? 'Loading…'
                : totalCount === 0
                  ? 'No sessions yet'
                  : `${connectedCount} of ${totalCount} connected`}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['sessions'] })}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shadow-[var(--shadow-sm)]"
              aria-label="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--green))] text-white text-[13px] font-[500] hover:opacity-90 transition-opacity shadow-[0_2px_8px_hsl(142_71%_35%/0.25)]"
            >
              <Plus size={14} />
              New session
            </button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        {!isLoading && totalCount > 0 && <SessionsSummaryStrip sessions={sessions!} />}

        {/* ── Cards grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SessionCardSkeleton key={i} />)
          ) : sessions && sessions.length > 0 ? (
            sessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onQrOpen={(id, name) => setQrTarget({ id, name })}
                onDelete={setDeleteTarget}
                onReconnect={id => reconnectMutation.mutate(id)}
                onUnlink={id => unlinkMutation.mutate(id)}
              />
            ))
          ) : (
            <SessionsEmptyState onNew={() => setShowCreate(true)} />
          )}
        </div>
      </div>
    </>
  );
}
