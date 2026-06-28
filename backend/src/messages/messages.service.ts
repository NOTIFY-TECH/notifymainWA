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
import { normalisePhone } from '../common/utils/phone.util';
import {
  resolveDisplayName,
  interpolateMessage,
} from '../common/utils/message-interpolation.util';

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

    // 2. Resolve engine via Redis -> DB fallback
    const engine = await this.resolveEngine(
      dto.sessionId,
      session.engineInstanceId,
    );

    // 3. Determine send address (JID passthrough or bare-digit normalisation).
    // dto.to may be:
    //   - a full JID with a suffix already present, e.g.
    //     "919876543210@s.whatsapp.net" or "182089584488685@lid".
    //     These are passed through to the engine UNCHANGED. Baileys v7
    //     addresses LID and phone-number JIDs natively -- stripping the
    //     suffix and re-deriving "@s.whatsapp.net" from LID digits produces
    //     an address that does not correspond to any real WhatsApp account,
    //     which is why messages silently failed to deliver.
    //   - bare digits with no "@" at all (CSV imports, campaigns, manual
    //     contact entry) -- these ARE real phone numbers and get normalised.
    let addressToSend: string;
    let normalisedPhoneDigits: string | null = null; // bare digits, no JID suffix — used for Conversation.phoneNumber + Contact lookup
    if (typeof dto.to === 'string' && dto.to.includes('@')) {
      addressToSend = dto.to;
      if (!addressToSend.endsWith('@lid')) {
        // @s.whatsapp.net — phone digits live before the @
        const digits = addressToSend.split('@')[0];
        const normalised = normalisePhone(digits);
        normalisedPhoneDigits = normalised.valid
          ? normalised.normalised
          : digits;
      }
      // @lid — no phone digits available; left null, handled below
    } else {
      const normaliseResult = normalisePhone(dto.to);
      if (!normaliseResult.valid) {
        throw new BadRequestException(
          `Invalid recipient number: ${normaliseResult.reason}`,
        );
      }
      addressToSend = normaliseResult.normalised;
      normalisedPhoneDigits = normaliseResult.normalised;
    }
    this.logger.debug(
      `dto.to raw: "${dto.to}" -> addressToSend: "${addressToSend}"`,
    );

    // 4. Resolve Contact + display name for {{name}} interpolation (17.4).
    //
    // Strategy depends on address type:
    //
    //   a) @lid — WhatsApp privacy ID, no phone digits available.
    //      Resolution order:
    //        1. conversation.contact (linked Contact row, if pn was available
    //           when the first inbound message arrived)
    //        2. conversation.contactName (pushName stored passively from the
    //           last inbound message — always written by webhooks.processor,
    //           even when no Contact can be matched by phone number)
    //        3. Raw digits before "@" as last-resort fallback
    //
    //   b) Bare digits / @s.whatsapp.net — extract phone digits, normalise,
    //      look up Contact by tenantId_phoneNumber.
    //
    // The key fix for the "92088544833619@lid" bug: when contactId is null
    // (pn was never provided by Baileys), we now fall back to
    // conversation.contactName which is populated from pushName on every
    // inbound message, so the sender's WhatsApp display name is always
    // available for interpolation regardless of whether a Contact row exists.
    let recipientContact: {
      id: string;
      whatsappName: string | null;
      name: string | null;
    } | null = null;
    let conversationContactName: string | null = null;

    if (addressToSend.endsWith('@lid')) {
      // @lid path — resolve via conversation -> contact, with contactName fallback
      if (dto.conversationId) {
        const conv = await this.prisma.conversation.findUnique({
          where: { id: dto.conversationId },
          select: {
            contactName: true,
            contact: { select: { id: true, whatsappName: true, name: true } },
          },
        });
        recipientContact = conv?.contact ?? null;
        // Store contactName so we can use it if contact is null
        conversationContactName = conv?.contactName ?? null;
      }
    } else {
      // Phone-number path — extract digits and normalise
      const phoneDigits = addressToSend.includes('@')
        ? addressToSend.split('@')[0] // @s.whatsapp.net — digits before @
        : addressToSend; // already bare digits

      const normalised = normalisePhone(phoneDigits);
      if (normalised.valid) {
        recipientContact = await this.prisma.contact.findUnique({
          where: {
            tenantId_phoneNumber: {
              tenantId,
              phoneNumber: normalised.normalised,
            },
          },
          select: { id: true, whatsappName: true, name: true },
        });
      }
    }

    // Clean fallback: strip JID suffix so {{name}} never resolves to
    // "92088544833619@lid" — use just the digits portion instead.
    const fallbackName = dto.to.includes('@') ? dto.to.split('@')[0] : dto.to;

    // 5. Interpolate {{name}} in the outbound text.
    //
    // Name resolution priority:
    //   1. contact.name           — CRM display name set by tenant (always wins
    //      when present — this is the name the tenant deliberately chose, and
    //      must not be overridden by whatever the recipient set on their own
    //      WhatsApp profile, which may contain emoji/junk/an unrelated name)
    //   2. contact.whatsappName   — from matched Contact row (set from pushName),
    //      fallback only when tenant hasn't set a CRM name
    //   3. conversationContactName — pushName stored on Conversation directly
    //      (covers @lid chats where contactId is null)
    //   4. fallbackName          — bare digits (never a raw "@lid" JID)
    // Strip any residual JID suffix from conversationContactName defensively —
    // rows written before the session 13 fix may still contain "@lid" values.
    const sanitizedContactName = conversationContactName?.includes('@')
      ? conversationContactName.split('@')[0]
      : conversationContactName;

    const displayName =
      recipientContact?.name?.trim() ||
      recipientContact?.whatsappName?.trim() ||
      sanitizedContactName?.trim() ||
      fallbackName;

    const interpolatedText = dto.text
      ? interpolateMessage(dto.text, displayName)
      : dto.text;

    // 6. Find-or-create the Conversation this message belongs to.
    //
    // Previously, brand-new outbound conversations (e.g. "New Conversation"
    // from the inbox, with no dto.conversationId yet) never created or
    // touched a Conversation row at all — only a Message row with
    // conversationId: null was written. This meant the conversation never
    // appeared in the inbox list until an inbound webhook happened to create
    // one later, which is also why the frontend's list-refetch after sending
    // looked like a "doesn't refresh" bug — there was nothing to refetch.
    //
    // Resolution:
    //   - If dto.conversationId was passed (replying inside an existing
    //     thread), use it as-is.
    //   - Otherwise, upsert on the Conversation unique constraint
    //     (tenantId, sessionId, phoneNumber) — this transparently reuses an
    //     existing conversation if one already exists for this contact on
    //     this session (e.g. they messaged in before), or creates a fresh
    //     one if not.
    //
    // @lid addresses have no phone number to key off of; in that rare case
    // (starting a brand-new outbound message to a contact only known by LID,
    // with no prior inbound message and no conversationId) we fall back to
    // the LID digits as the phoneNumber key, consistent with how addresses
    // are stored elsewhere in this method.
    let conversationId: string | null = dto.conversationId ?? null;

    if (!conversationId) {
      const conversationPhoneKey =
        normalisedPhoneDigits ?? addressToSend.split('@')[0];

      const conversation = await this.prisma.conversation.upsert({
        where: {
          tenantId_sessionId_phoneNumber: {
            tenantId,
            sessionId: session.id,
            phoneNumber: conversationPhoneKey,
          },
        },
        update: {
          lastMessageAt: new Date(),
          lastMessageText: interpolatedText ?? null,
        },
        create: {
          tenantId,
          sessionId: session.id,
          contactId: recipientContact?.id ?? null,
          contactName: displayName ?? null,
          phoneNumber: conversationPhoneKey,
          status: 'OPEN',
          lastMessageAt: new Date(),
          lastMessageText: interpolatedText ?? null,
        },
      });
      conversationId = conversation.id;
    }

    // 7. Log message to DB with status PENDING (using interpolated text as body)
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        sessionId: session.id,
        conversationId,
        direction: 'OUTBOUND',
        fromNumber: session.phoneNumber ?? '',
        toNumber: dto.to,
        type: dto.type.toUpperCase() as any,
        body: interpolatedText ?? null,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        caption: dto.caption,
        status: 'PENDING',
      },
    });

    // 8. Forward to engine
    try {
      this.logger.debug(`Sending with API key: ${JSON.stringify(apiKey)}`);
      const response = await axios.post(
        `${engine.url}/api/messages/send`,
        {
          sessionId: session.openwaId,
          to: addressToSend,
          type: dto.type,
          text: interpolatedText,
          mediaUrl: this.engineClient.toEngineAccessibleUrl(dto.mediaUrl),
          caption: dto.caption,
          messageId: message.id,
        },
        { headers: { 'X-API-Key': apiKey } },
      );

      // 9. Update status to SENT
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
        conversationId,
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
      // 10. Mark as FAILED if engine call fails
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

  async reactToMessage(tenantId: string, messageId: string, emoji: string) {
    // Use include (not select) so that conversation + session relations are
    // available as typed objects, not just scalar IDs.
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
      include: {
        conversation: {
          select: {
            sessionId: true,
            phoneNumber: true,
            session: {
              select: {
                openwaId: true,
                status: true,
                phoneNumber: true,
                engineInstanceId: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const session = message.conversation?.session;
    if (!session || session.status !== 'CONNECTED') {
      throw new BadRequestException('Session is not connected');
    }

    if (!session.phoneNumber) {
      throw new BadRequestException('Session has no phone number on record');
    }

    const senderJid = `${session.phoneNumber}@s.whatsapp.net`;

    if (!message.externalId) {
      throw new BadRequestException(
        'Cannot react to a message without an externalId (not yet synced by WhatsApp)',
      );
    }

    // Send reaction to engine
    const apiKey = this.config.get<string>('OPENWA_API_KEY');
    const engine = await this.resolveEngine(
      message.conversation.sessionId,
      session.engineInstanceId ?? null,
    );

    try {
      await axios.post(
        `${engine.url}/api/messages/react`,
        {
          sessionId: session.openwaId,
          targetExternalId: message.externalId,
          to: message.conversation.phoneNumber,
          emoji,
          fromMe: message.direction === 'OUTBOUND',
        },
        { headers: { 'X-API-Key': apiKey } },
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Engine reaction response: ${JSON.stringify(error.response?.data)}`,
        );
      }
      throw new BadRequestException('Failed to send reaction via engine');
    }

    // Upsert reactions JSON locally (same logic as webhooks.processor)
    const current: Record<string, string[]> =
      (message.reactions as Record<string, string[]>) ?? {};

    const cleaned: Record<string, string[]> = {};
    for (const [e, senders] of Object.entries(current)) {
      const filtered = senders.filter((j) => j !== senderJid);
      if (filtered.length > 0) cleaned[e] = filtered;
    }
    if (emoji && emoji.trim()) {
      cleaned[emoji] = [...(cleaned[emoji] ?? []), senderJid];
    }

    await this.prisma.message.update({
      where: { id: message.id },
      data: { reactions: cleaned },
    });

    this.logger.log(
      `Reaction ${emoji || '(removed)'} on message ${messageId} by ${senderJid}`,
    );

    return { data: { success: true, reactions: cleaned } };
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
