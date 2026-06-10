import { create } from 'zustand';

// ─── Notification Store ───────────────────────────────────────────────────────
// In-memory toast/notification queue.
// Consumed by a global <NotificationProvider> that renders Sonner toasts.

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  durationMs?: number; // default: 4000
}

interface NotificationState {
  notifications: Notification[];

  // Actions
  add: (notification: Omit<Notification, 'id'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;

  // Convenience shorthands
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const generateId = (): string => `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useNotificationStore = create<NotificationState>()(set => ({
  notifications: [],

  add: notification =>
    set(s => ({
      notifications: [...s.notifications, { ...notification, id: generateId() }],
    })),

  dismiss: id =>
    set(s => ({
      notifications: s.notifications.filter(n => n.id !== id),
    })),

  clear: () => set({ notifications: [] }),

  // ── Shorthands ──────────────────────────────────────────────────────────────
  success: (title, description) =>
    set(s => ({
      notifications: [...s.notifications, { id: generateId(), type: 'success', title, description }],
    })),

  error: (title, description) =>
    set(s => ({
      notifications: [...s.notifications, { id: generateId(), type: 'error', title, description }],
    })),

  warning: (title, description) =>
    set(s => ({
      notifications: [...s.notifications, { id: generateId(), type: 'warning', title, description }],
    })),

  info: (title, description) =>
    set(s => ({
      notifications: [...s.notifications, { id: generateId(), type: 'info', title, description }],
    })),
}));
