import { IsString, IsNumber, IsIn, IsObject } from 'class-validator';

export class EngineWebhookDto {
  @IsIn([
    'message.received',
    'message.outgoing',
    'message.ack',
    'session.connected',
    'session.disconnected',
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
