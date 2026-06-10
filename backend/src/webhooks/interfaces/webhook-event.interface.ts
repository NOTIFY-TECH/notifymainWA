export type WebhookEventType =
  | 'message.received'
  | 'message.ack'
  | 'session.connected'
  | 'session.disconnected';

export interface WebhookEvent {
  eventType: WebhookEventType;
  sessionId: string;
  instanceId: string;
  timestamp: number;
  payload: Record<string, any>;
}
