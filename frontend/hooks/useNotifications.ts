'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

// ─── Permission request ───────────────────────────────────────────────────────
// Call once on mount. If already granted, does nothing. If denied, silent.

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function canNotify(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.visibilityState !== 'visible'
  );
}

function showNotification(title: string, body: string, options?: NotificationOptions) {
  if (!canNotify()) return;
  const n = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: options?.tag,
    ...options,
  });
  setTimeout(() => n.close(), 6000);
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

// ─── Event shapes (matching what the WS gateway emits) ───────────────────────

interface MessageReceivedEvent {
  conversationId: string;
  contactName?: string;
  from?: string;
  body?: string;
  type?: string;
}

interface MessageReactionEvent {
  conversationId: string;
  emoji: string;
  senderJid?: string;
}

interface SessionStatusEvent {
  sessionId: string;
  sessionName?: string;
  status: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const { subscribe, unsubscribe } = useWebSocket();
  const permissionGranted = useRef(false);

  // Request permission once on mount
  useEffect(() => {
    requestPermission().then(granted => {
      permissionGranted.current = granted;
    });
  }, []);

  // ── message:received ────────────────────────────────────────────────────────
  const handleMessageReceived = useCallback((event: MessageReceivedEvent) => {
    const raw = event.from ?? '';
    const sender = event.contactName?.trim() || (raw.includes('@') ? raw.split('@')[0] : raw) || 'New message';

    const body = (() => {
      if (!event.body && event.type === 'IMAGE') return '📷 Photo';
      if (!event.body && event.type === 'VIDEO') return '🎥 Video';
      if (!event.body && event.type === 'AUDIO') return '🎵 Audio';
      if (!event.body && event.type === 'DOCUMENT') return '📄 Document';
      return event.body || 'New message';
    })();

    showNotification(sender, body, {
      tag: `msg-${event.conversationId}`,
    });
  }, []);

  // ── message:reaction ────────────────────────────────────────────────────────
  const handleMessageReaction = useCallback((event: MessageReactionEvent) => {
    if (!event.emoji) return; // empty emoji = reaction removed, don't notify
    showNotification('New reaction', `Someone reacted ${event.emoji} to your message`, {
      tag: `reaction-${event.conversationId}`,
    });
  }, []);

  // ── session:status ──────────────────────────────────────────────────────────
  const handleSessionStatus = useCallback((event: SessionStatusEvent) => {
    if (event.status !== 'DISCONNECTED') return;
    const name = event.sessionName || 'A WhatsApp session';
    // Always notify on disconnect regardless of visibility — this is urgent
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(`${name} disconnected`, {
      body: 'Go to Sessions to reconnect your WhatsApp number.',
      icon: '/favicon.ico',
      tag: `session-disconnect-${event.sessionId}`,
      requireInteraction: true, // stays until dismissed — important alert
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, []);

  useEffect(() => {
    subscribe('message:received', handleMessageReceived);
    subscribe('message:reaction', handleMessageReaction);
    subscribe('session:status', handleSessionStatus);

    return () => {
      unsubscribe('message:received', handleMessageReceived);
      unsubscribe('message:reaction', handleMessageReaction);
      unsubscribe('session:status', handleSessionStatus);
    };
  }, [subscribe, unsubscribe, handleMessageReceived, handleMessageReaction, handleSessionStatus]);
}
