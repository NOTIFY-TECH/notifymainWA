import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayService } from '../gateway/gateway.service';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ALLOWED_MIME_TYPES } from '../media/media.module';
import { CampaignContactStatus } from '@prisma/client';
import { computeCampaignProgress } from '../campaigns/utils/campaign-progress.util';
import { normalisePhone } from '../common/utils/phone.util';

@Processor('webhook-events')
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: GatewayService,
    private readonly config: ConfigService,
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
      case 'message.outgoing':
        await this.handleMessageOutgoing(job.data);
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

    if (result.count === 0) {
      this.logger.warn(
        `session.connected — no DB record found for openwaId: ${data.sessionId}. Engine and DB are out of sync.`,
      );
      return;
    }

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

  // ── Resolve a real, normalised phone number to match against Contact ─────
  //
  // `fromNumber`/`toNumber` are full addressable JIDs and may be a @lid
  // (WhatsApp privacy ID) that bears NO relation to a phone number — Baileys
  // explicitly cannot decode a LID back to one. Comparing that directly
  // against Contact.phoneNumber (always a real, normalised number) silently
  // never matches for @lid chats, which is why contacts with a real saved
  // number never linked to their inbox conversation.
  //
  // The engine (SessionManager._handleIncomingMessage) already resolves and
  // attaches the real number as payload.pn whenever WhatsApp reveals it
  // (msg.key.senderPn / participantPn) — prefer that. Falls back to the JID
  // itself only for older/non-LID chats where it's already a real-number JID
  // (e.g. ...@s.whatsapp.net with digits WhatsApp app numbers).
  private resolveContactMatchPhone(payload: any, jid: string): string | null {
    const candidate: string | undefined = payload.pn ?? undefined;
    const raw = candidate ?? (jid.endsWith('@lid') ? null : jid);
    if (!raw) return null;

    const digitsOnly = raw.split('@')[0];
    const result = normalisePhone(digitsOnly);
    return result.valid ? result.normalised : null;
  }

  private async handleMessageReceived(data: any): Promise<void> {
    try {
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

      // Skip WhatsApp Channel/Newsletter broadcasts — not a real contact conversation
      if (fromNumber.endsWith('@newsletter')) {
        this.logger.debug(
          `message.received — skipping newsletter broadcast from ${fromNumber}`,
        );
        return;
      }
      const rawType: string = payload.type?.toUpperCase() ?? 'TEXT';

      // ── Normalise message type to only accepted enum values ──
      const ALLOWED_TYPES = [
        'TEXT',
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'DOCUMENT',
        'LOCATION',
        'CONTACT_CARD',
        'TEMPLATE',
      ];
      const messageType = ALLOWED_TYPES.includes(rawType) ? rawType : 'TEXT';

      this.logger.debug(
        `Message type raw=${rawType} normalised=${messageType} from=${fromNumber}`,
      );

      const {
        body: messageBody,
        mediaUrl,
        mediaType,
      } = this.extractMessageContent(payload, messageType, session.tenantId);

      const now = new Date(data.timestamp ?? Date.now());

      // ── Contact matching: PN, not JID — see resolveContactMatchPhone above ──
      const matchPhone = this.resolveContactMatchPhone(payload, fromNumber);

      const contact = matchPhone
        ? await this.prisma.contact.findUnique({
            where: {
              tenantId_phoneNumber: {
                tenantId: session.tenantId,
                phoneNumber: matchPhone,
              },
            },
            select: { id: true },
          })
        : null;

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
          ...(contact?.id ? { contactId: contact.id } : {}),
          status: 'OPEN',
        },
      });

      const message = await this.prisma.message.create({
        data: {
          tenantId: session.tenantId,
          sessionId: session.id,
          conversationId: conversation.id,
          fromNumber,
          toNumber: '',
          body: messageBody,
          type: messageType as any,
          mediaUrl,
          mediaType,
          direction: 'INBOUND',
          status: 'DELIVERED',
          externalId: payload.externalId ?? payload.id ?? null,
        },
      });

      this.gatewayService.emitMessageReceived(session.tenantId, {
        messageId: message.id,
        conversationId: conversation.id,
        sessionId: data.sessionId,
        from: message.fromNumber,
        body: message.body,
        type: message.type,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        createdAt: message.createdAt,
      });

      this.logger.log(
        `Message received on session ${data.sessionId}: ${messageBody.slice(0, 80)}`,
      );
    } catch (error) {
      this.logger.error(
        `handleMessageReceived failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // rethrow so BullMQ marks job as failed
    }
  }

  private async handleMessageOutgoing(data: any): Promise<void> {
    try {
      const payload = data.payload ?? {};
      const externalId: string | undefined =
        payload.id?._serialized ?? payload.id;

      // Dedupe — if this message was already created via dashboard send, skip
      if (externalId) {
        const existing = await this.prisma.message.findFirst({
          where: { externalId },
          select: { id: true },
        });
        if (existing) {
          this.logger.debug(
            `message.outgoing — skipping duplicate, externalId: ${externalId}`,
          );
          return;
        }
      }

      const session = await this.prisma.session.findFirst({
        where: { openwaId: data.sessionId },
        select: { id: true, tenantId: true, phoneNumber: true },
      });

      if (!session) {
        this.logger.warn(
          `message.outgoing — session not found: ${data.sessionId}`,
        );
        return;
      }

      const toNumber: string = payload.to ?? '';
      const rawType: string = payload.type?.toUpperCase() ?? 'TEXT';
      const ALLOWED_TYPES = [
        'TEXT',
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'DOCUMENT',
        'LOCATION',
        'CONTACT_CARD',
        'TEMPLATE',
      ];
      const messageType = ALLOWED_TYPES.includes(rawType) ? rawType : 'TEXT';

      const {
        body: messageBody,
        mediaUrl,
        mediaType,
      } = this.extractMessageContent(payload, messageType, session.tenantId);

      const now = new Date(data.timestamp ?? Date.now());

      // Same PN-vs-JID matching as handleMessageReceived — see
      // resolveContactMatchPhone for the full explanation.
      const matchPhone = this.resolveContactMatchPhone(payload, toNumber);

      const contact = matchPhone
        ? await this.prisma.contact.findUnique({
            where: {
              tenantId_phoneNumber: {
                tenantId: session.tenantId,
                phoneNumber: matchPhone,
              },
            },
            select: { id: true },
          })
        : null;

      const conversation = await this.prisma.conversation.upsert({
        where: {
          tenantId_sessionId_phoneNumber: {
            tenantId: session.tenantId,
            sessionId: session.id,
            phoneNumber: toNumber,
          },
        },
        create: {
          tenantId: session.tenantId,
          sessionId: session.id,
          phoneNumber: toNumber,
          contactId: contact?.id ?? null,
          status: 'OPEN',
          unreadCount: 0,
          lastMessageAt: now,
          lastMessageText: messageBody.slice(0, 500),
        },
        update: {
          lastMessageAt: now,
          lastMessageText: messageBody.slice(0, 500),
          ...(contact?.id ? { contactId: contact.id } : {}),
        },
      });

      const message = await this.prisma.message.create({
        data: {
          tenantId: session.tenantId,
          sessionId: session.id,
          conversationId: conversation.id,
          fromNumber: session.phoneNumber ?? '',
          toNumber,
          body: messageBody,
          type: messageType as any,
          mediaUrl,
          mediaType,
          direction: 'OUTBOUND',
          status: 'SENT',
          externalId: externalId ?? null,
          sentAt: now,
        },
      });

      this.gatewayService.emitMessageOutgoingSynced(session.tenantId, {
        messageId: message.id,
        conversationId: conversation.id,
        sessionId: data.sessionId,
        to: message.toNumber,
        body: message.body,
        type: message.type,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        createdAt: message.createdAt,
      });

      this.logger.log(
        `Outgoing message synced from phone: ${data.sessionId} → ${toNumber}: ${messageBody.slice(0, 80)}`,
      );
    } catch (error) {
      this.logger.error(
        `handleMessageOutgoing failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Extracts body/mediaUrl/mediaType from a wa-automate message payload.
   * Handles both TEXT and media (base64) message types.
   */
  private extractMessageContent(
    payload: any,
    messageType: string,
    tenantId: string,
  ): {
    body: string;
    mediaUrl: string | null;
    mediaType: string | null;
  } {
    if (messageType === 'TEXT') {
      return {
        body: payload.body ?? payload.text ?? '',
        mediaUrl: null,
        mediaType: null,
      };
    }

    const body = payload.caption ?? '';
    let mediaUrl: string | null = null;
    const mediaType: string | null = payload.mimetype ?? null;

    const base64Data: string | undefined = payload.body;
    if (base64Data && mediaType) {
      try {
        const ext =
          ALLOWED_MIME_TYPES[mediaType] ??
          `.${mediaType.split('/')[1] ?? 'bin'}`;
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const uploadRoot = join(
          process.cwd(),
          this.config.get<string>('UPLOAD_DIR', 'uploads'),
          tenantId,
          month,
        );
        if (!existsSync(uploadRoot)) {
          mkdirSync(uploadRoot, { recursive: true });
        }
        const filename = `${uuidv4()}${ext}`;
        const filePath = join(uploadRoot, filename);
        writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const backendUrl = this.config.get<string>(
          'BACKEND_URL',
          'http://localhost:3001',
        );
        mediaUrl = `${backendUrl}/uploads/${tenantId}/${month}/${filename}`;
      } catch (err) {
        this.logger.error(
          `Failed to save media: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { body, mediaUrl, mediaType };
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

    // ── Race condition guard ──────────────────────────────────────────────
    // Baileys can emit the ack event before MessagesService.sendMessage()
    // has finished writing externalId onto the Message row (that write only
    // happens after the engine's HTTP response returns). If this job runs
    // first, updateMany matches 0 rows and the ack is silently lost forever.
    // Retry briefly with backoff before giving up.
    const RETRY_DELAYS_MS = [150, 300, 600, 1000];
    let updateResult = await this.prisma.message.updateMany({
      where: { externalId: data.payload.externalId },
      data: {
        status: ack.status as any,
        [ack.field]: new Date(data.timestamp),
      },
    });

    for (const delay of RETRY_DELAYS_MS) {
      if (updateResult.count > 0) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      updateResult = await this.prisma.message.updateMany({
        where: { externalId: data.payload.externalId },
        data: {
          status: ack.status as any,
          [ack.field]: new Date(data.timestamp),
        },
      });
    }

    if (updateResult.count === 0) {
      this.logger.warn(
        `message.ack — no Message row found for externalId ${data.payload.externalId} after retries, dropping ack (status would have been ${ack.status})`,
      );
      return;
    }

    // ── Emit WebSocket event so frontend updates tick in real time ──
    const message = await this.prisma.message.findFirst({
      where: { externalId: data.payload.externalId },
      select: { id: true, tenantId: true, campaignId: true },
    });

    if (message) {
      this.gatewayService.emitMessageAck(message.tenantId, {
        messageId: message.id,
        externalId: data.payload.externalId,
        status: ack.status,
      });
    }

    if (message?.campaignId) {
      await this.prisma.campaignContact.updateMany({
        where: { campaignId: message.campaignId, messageId: message.id },
        data: {
          status: ack.status as CampaignContactStatus,
          [ack.field]: new Date(data.timestamp),
        },
      });

      // Counts are derived fresh from CampaignContact.status here, not from
      // an incremented Campaign counter column. The old version incremented
      // a counter on every ack (e.g. sentCount++ on ack=1), but the campaign
      // processor was ALSO incrementing sentCount synchronously right after
      // the send HTTP call returned — so every successful send counted
      // twice, guaranteed, not just on retried/duplicate webhooks.
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: message.campaignId },
        select: { id: true, tenantId: true, totalContacts: true, status: true },
      });

      if (campaign) {
        const progress = await computeCampaignProgress(
          this.prisma,
          campaign.id,
        );

        this.gatewayService.emitCampaignProgress(campaign.tenantId, {
          campaignId: campaign.id,
          sentCount: progress.sentCount,
          deliveredCount: progress.deliveredCount,
          readCount: progress.readCount,
          failedCount: progress.failedCount,
          totalContacts: campaign.totalContacts,
          status: campaign.status,
        });
      }
    }

    this.logger.log(`Message ack: ${data.payload.externalId} → ${ack.status}`);
  }
}
