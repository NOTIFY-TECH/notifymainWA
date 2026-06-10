import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EngineWebhookDto } from './dto/engine-webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('webhook-events') private readonly webhookQueue: Queue,
  ) {}

  validateApiKey(key: string): void {
    const expected = this.config.get<string>('WEBHOOK_API_KEY');
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  async handleEngineEvent(
    dto: EngineWebhookDto,
  ): Promise<{ received: boolean }> {
    // 1. Store raw event in WebhookLog
    const log = await this.prisma.webhookLog.create({
      data: {
        eventType: dto.eventType,
        instanceId: dto.instanceId,
        sessionId: dto.sessionId,
        payload: dto.payload,
        receivedAt: new Date(dto.timestamp),
      },
    });

    this.logger.log(
      `Webhook received: ${dto.eventType} from engine ${dto.instanceId}, log ID: ${log.id}`,
    );

    // 2. Dispatch to BullMQ for async processing
    await this.webhookQueue.add(
      dto.eventType,
      {
        logId: log.id,
        eventType: dto.eventType,
        sessionId: dto.sessionId,
        instanceId: dto.instanceId,
        timestamp: dto.timestamp,
        payload: dto.payload,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return { received: true };
  }
}
