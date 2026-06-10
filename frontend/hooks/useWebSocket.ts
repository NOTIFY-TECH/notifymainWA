import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

// ─── useWebSocket ─────────────────────────────────────────────────────────────
// Manages a single Socket.io connection scoped to the authenticated tenant.
// The same socket instance is reused across the app — call this hook at the
// layout level and pass handlers down via context or Zustand if needed.

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type EventHandler<T = unknown> = (data: T) => void;

interface UseWebSocketReturn {
  subscribe: <T>(event: string, handler: EventHandler<T>) => void;
  unsubscribe: <T>(event: string, handler: EventHandler<T>) => void;
  emit: <T>(event: string, data?: T) => void;
  isConnected: () => boolean;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const tenantId = useAuthStore(s => s.tenant?.id);

  useEffect(() => {
    const token = getAccessToken();
    console.log('WS_URL =', WS_URL);
    console.log('Token =', !!token);
    console.log('TenantId =', tenantId);

    if (!token || !tenantId) return;

    // Create the socket with auth credentials
    const socket = io(WS_URL, {
      auth: { token },
      query: { tenantId },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect_error', err => {
      console.error('CONNECT_ERROR', err);
      console.error('MESSAGE', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId]);

  const subscribe = useCallback(<T>(event: string, handler: EventHandler<T>) => {
    socketRef.current?.on(event, handler as EventHandler);
  }, []);

  const unsubscribe = useCallback(<T>(event: string, handler: EventHandler<T>) => {
    socketRef.current?.off(event, handler as EventHandler);
  }, []);

  const emit = useCallback(<T>(event: string, data?: T) => {
    socketRef.current?.emit(event, data);
  }, []);

  const isConnected = useCallback(() => socketRef.current?.connected ?? false, []);

  return { subscribe, unsubscribe, emit, isConnected };
};
