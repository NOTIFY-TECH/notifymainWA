import { IsString, IsNumber, IsIn, IsObject } from 'class-validator';

export class EngineWebhookDto {
  @IsIn([
    'message.received',
    'message.outgoing',
    'message.ack',
    'message.reaction',
    'message.decrypt_failed',
    'session.connected',
    'session.disconnected',
    'session.sync_start',
    'session.chats_synced',
  ])
  eventType: string;

  @IsString()
  sessionId: string;

  @IsString()
  instanceId: string;

  @IsNumber()
  timestamp: number;

  @IsObject()
  payload: Record<string, any>;
}
