import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayService } from '../gateway/gateway.service';

@Processor('webhook-events')
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: GatewayService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.debug(`Processing job: ${job.name} [${job.id}]`);

    switch (job.name) {
      case 'session.connected':
        await this.handleSessionConnected(job.data);
        break;
      case 'session.disconnected':
        await this.handleSessionDisconnected(job.data);
        break;
      case 'message.received':
        await this.handleMessageReceived(job.data);
        break;
      case 'message.ack':
        await this.handleMessageAck(job.data);
        break;
      default:
        this.logger.warn(`Unknown event type: ${job.name}`);
    }
  }

  private async handleSessionConnected(data: any): Promise<void> {
    const result = await this.prisma.session.updateMany({
      where: { openwaId: data.sessionId },
      data: {
        status: 'CONNECTED',
        lastSeenAt: new Date(data.timestamp),
        phoneNumber:
          typeof data.payload?.phoneNumber === 'string'
            ? data.payload.phoneNumber
            : null,
      },
    });

    const session = await this.prisma.session.findFirst({
      where: { openwaId: data.sessionId },
      select: { tenantId: true },
    });

    if (session) {
      this.gatewayService.emitSessionStatus(session.tenantId, {
        sessionId: data.sessionId,
        status: 'CONNECTED',
      });
    }

    this.logger.log(`Session connected: ${data.sessionId}`);
  }

  private async handleSessionDisconnected(data: any): Promise<void> {
    await this.prisma.session.updateMany({
      where: { openwaId: data.sessionId },
      data: {
        status: 'DISCONNECTED',
        lastSeenAt: new Date(data.timestamp),
      },
    });

    const session = await this.prisma.session.findFirst({
      where: { openwaId: data.sessionId },
      select: { tenantId: true },
    });

    if (session) {
      this.gatewayService.emitSessionStatus(session.tenantId, {
        sessionId: data.sessionId,
        status: 'DISCONNECTED',
      });
    }

    this.logger.log(`Session disconnected: ${data.sessionId}`);
  }

  private async handleMessageReceived(data: any): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { openwaId: data.sessionId },
      select: { id: true, tenantId: true },
    });

    if (!session) {
      this.logger.warn(
        `message.received — session not found: ${data.sessionId}`,
      );
      return;
    }

    const payload = data.payload ?? {};
    const fromNumber: string = payload.from ?? data.from ?? '';
    const messageBody: string = payload.body ?? payload.text ?? '';
    const messageType: string = payload.type?.toUpperCase() ?? 'TEXT';
    const now = new Date(data.timestamp ?? Date.now());

    // ── 1. Upsert conversation ──────────────────────────────────────────────
    // Find existing contact for this phone number (optional link)
    const contact = await this.prisma.contact.findUnique({
      where: {
        tenantId_phoneNumber: {
          tenantId: session.tenantId,
          phoneNumber: fromNumber,
        },
      },
      select: { id: true },
    });

    const conversation = await this.prisma.conversation.upsert({
      where: {
        tenantId_sessionId_phoneNumber: {
          tenantId: session.tenantId,
          sessionId: session.id,
          phoneNumber: fromNumber,
        },
      },
      create: {
        tenantId: session.tenantId,
        sessionId: session.id,
        phoneNumber: fromNumber,
        contactId: contact?.id ?? null,
        status: 'OPEN',
        unreadCount: 1,
        lastMessageAt: now,
        lastMessageText: messageBody.slice(0, 500),
      },
      update: {
        unreadCount: { increment: 1 },
        lastMessageAt: now,
        lastMessageText: messageBody.slice(0, 500),
        // Re-link contact if it was created after the conversation
        ...(contact?.id ? { contactId: contact.id } : {}),
        // Re-open if it was resolved/snoozed
        status: 'OPEN',
      },
    });

    // ── 2. Create message linked to conversation ────────────────────────────
    const message = await this.prisma.message.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.id,
        conversationId: conversation.id,
        fromNumber,
        toNumber: '',
        body: messageBody,
        type: messageType as any,
        direction: 'INBOUND',
        status: 'DELIVERED',
        externalId: payload.externalId ?? payload.id ?? null,
      },
    });

    // ── 3. Emit real-time event to frontend ────────────────────────────────
    this.gatewayService.emitMessageReceived(session.tenantId, {
      messageId: message.id,
      conversationId: conversation.id,
      sessionId: data.sessionId,
      from: message.fromNumber,
      body: message.body,
      type: message.type,
      createdAt: message.createdAt,
    });

    this.logger.log(
      `Message received on session ${data.sessionId}: ${messageBody.slice(0, 80)}`,
    );
  }

  private async handleMessageAck(data: any): Promise<void> {
    const ackMap = new Map<number, { status: string; field: string }>([
      [1, { status: 'SENT', field: 'sentAt' }],
      [2, { status: 'DELIVERED', field: 'deliveredAt' }],
      [3, { status: 'READ', field: 'readAt' }],
      [-1, { status: 'FAILED', field: 'failedAt' }],
    ]);

    const ack = ackMap.get(data.payload?.ack);
    if (!ack || !data.payload?.externalId) return;

    await this.prisma.message.updateMany({
      where: { externalId: data.payload.externalId },
      data: {
        status: ack.status as any,
        [ack.field]: new Date(data.timestamp),
      },
    });

    this.logger.log(`Message ack: ${data.payload.externalId} → ${ack.status}`);
  }
}
