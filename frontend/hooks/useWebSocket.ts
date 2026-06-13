import { useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type EventHandler<T = unknown> = (data: T) => void;

// ─── True singleton — initialized once, never inside React ───────────────────
let globalSocket: Socket | null = null;

export function initializeSocket(token: string, tenantId: string): void {
  if (globalSocket?.connected) return; // already connected

  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }

  globalSocket = io(WS_URL, {
    auth: { token },
    query: { tenantId },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
  });

  globalSocket.on('connect', () => console.log('[WS] Connected:', globalSocket?.id));
  globalSocket.on('disconnect', reason => console.log('[WS] Disconnected:', reason));
  globalSocket.on('connect_error', err => console.error('[WS] Error:', err.message));
}

export function destroySocket(): void {
  globalSocket?.disconnect();
  globalSocket = null;
}

// ─── Hook — just subscribe/unsubscribe, no socket lifecycle ──────────────────
interface UseWebSocketReturn {
  subscribe: <T>(event: string, handler: EventHandler<T>) => void;
  unsubscribe: <T>(event: string, handler: EventHandler<T>) => void;
  emit: <T>(event: string, data?: T) => void;
  isConnected: () => boolean;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const subscribe = useCallback(<T>(event: string, handler: EventHandler<T>) => {
    globalSocket?.on(event, handler as EventHandler);
  }, []);

  const unsubscribe = useCallback(<T>(event: string, handler: EventHandler<T>) => {
    globalSocket?.off(event, handler as EventHandler);
  }, []);

  const emit = useCallback(<T>(event: string, data?: T) => {
    globalSocket?.emit(event, data);
  }, []);

  const isConnected = useCallback(() => globalSocket?.connected ?? false, []);

  return { subscribe, unsubscribe, emit, isConnected };
};
