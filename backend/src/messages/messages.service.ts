import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EngineRegistryService } from '../engine-registry/engine-registry.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import axios from 'axios';
import { EngineClientService } from '../engine-registry/engine-client.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineRegistry: EngineRegistryService,
    private readonly engineClient: EngineClientService,
    private readonly config: ConfigService,
  ) {}

  async sendMessage(tenantId: string, userId: string, dto: SendMessageDto) {
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    // 1. Look up session in DB
    const session = await this.prisma.session.findFirst({
      where: { id: dto.sessionId, tenantId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${dto.sessionId} not found`);
    }

    if (session.status !== 'CONNECTED') {
      throw new BadRequestException(
        `Session is not connected (current status: ${session.status})`,
      );
    }

    // 2. Resolve engine via Redis â†’ DB fallback
    const engine = await this.resolveEngine(
      dto.sessionId,
      session.engineInstanceId,
    );

    // 3. Log message to DB with status PENDING
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        sessionId: session.id,
        conversationId: dto.conversationId ?? null, // add this line
        direction: 'OUTBOUND',
        fromNumber: session.phoneNumber ?? '',
        toNumber: dto.to,
        type: dto.type.toUpperCase() as any,
        body: dto.text, // dto.text not dto.body
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        caption: dto.caption,
        status: 'PENDING',
      },
    });

    // 4. Forward to engine
    try {
      this.logger.debug(`Sending with API key: ${JSON.stringify(apiKey)}`);
      const response = await axios.post(
        `${engine.url}/api/messages/send`,
        {
          sessionId: session.openwaId,
          to: dto.to,
          type: dto.type,
          text: dto.text,
          mediaUrl: this.engineClient.toEngineAccessibleUrl(dto.mediaUrl),
          caption: dto.caption,
          messageId: message.id,
        },
        { headers: { 'X-API-Key': apiKey } },
      );

      // 5. Update status to SENT
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          externalId:
            typeof response.data?.messageId === 'string'
              ? response.data.messageId
              : null,
          sentAt: new Date(),
        },
      });

      await this.prisma.session.update({
        where: { id: session.id },
        data: { messagesSent: { increment: 1 } },
      });

      this.logger.log(
        `Message sent: ${message.id} via engine ${engine.instanceId}`,
      );
      return {
        ...message,
        status: 'SENT',
        externalId:
          typeof response.data?.messageId === 'string'
            ? response.data.messageId
            : null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Engine response: ${JSON.stringify(error.response?.data)}`,
        );
      }
      // 6. Mark as FAILED if engine call fails
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', failedAt: new Date() },
      });

      this.logger.error(
        `Failed to send message ${message.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to send message via engine');
    }
  }

  async listMessages(tenantId: string, dto: ListMessagesDto) {
    const { sessionId, contactNumber, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (sessionId) where.sessionId = sessionId;
    if (contactNumber) {
      where.OR = [{ toNumber: contactNumber }, { fromNumber: contactNumber }];
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sessionId: true,
          direction: true,
          toNumber: true,
          fromNumber: true,
          type: true,
          body: true,
          status: true,
          externalId: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data: messages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateMessageStatus(
    externalId: string,
    status: string,
    timestamps: {
      sentAt?: Date;
      deliveredAt?: Date;
      readAt?: Date;
      failedAt?: Date;
    } = {},
  ): Promise<void> {
    await this.prisma.message.updateMany({
      where: { externalId },
      data: { status: status as any, ...timestamps },
    });
    this.logger.log(`Message ${externalId} status updated to ${status}`);
  }

  private async resolveEngine(
    sessionId: string,
    fallbackInstanceId: string | null,
  ) {
    try {
      return await this.engineRegistry.getInstanceForSession(sessionId);
    } catch {
      if (!fallbackInstanceId) {
        throw new BadRequestException('Engine instance not found for session');
      }
      this.logger.warn(
        `Redis mapping missing for session ${sessionId}, falling back to DB instanceId`,
      );
      return this.engineRegistry.getInstanceById(fallbackInstanceId);
    }
  }
}
