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
      case 'session.sync_start':
        await this.handleSessionSyncStart(job.data);
        break;
      case 'session.chats_synced':
        await this.handleSessionChatsSynced(job.data);
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
      case 'message.reaction':
        await this.handleMessageReaction(job.data);
        break;
      case 'message.decrypt_failed':
        await this.handleMessageDecryptFailed(job.data);
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

  private async handleSessionSyncStart(data: any): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { openwaId: data.sessionId },
      select: { tenantId: true },
    });

    if (!session) {
      this.logger.warn(
        `session.sync_start — session not found: ${data.sessionId}`,
      );
      return;
    }

    this.gatewayService.emitSessionSyncing(session.tenantId, {
      sessionId: data.sessionId,
    });

    this.logger.log(`Session sync started: ${data.sessionId}`);
  }

  // ── Safely re-attach or delete orphaned null-sessionId conversations ──────
  //
  // The naive updateMany(sessionId: null → sessionId) fails with a unique
  // constraint error when:
  //   a) A live row for (tenantId, sessionId, phoneNumber) already exists
  //      (keeper exists) — updating any orphan would create a duplicate.
  //   b) Multiple null-sessionId orphans exist for the same phoneNumber
  //      (updating them all to the same sessionId creates duplicates among
  //      themselves, even when no keeper exists).
  //
  // Strategy:
  //   • Keeper exists → delete ALL orphans (redundant; upsert below hits keeper)
  //   • No keeper → delete all orphans except the oldest one, then re-stamp
  //     that single surviving orphan with the current sessionId so the upsert
  //     below hits it via the unique index instead of creating a second row.
  private async reattachOrphan(
    tenantId: string,
    sessionId: string,
    phoneNumber: string,
  ): Promise<void> {
    const keeperExists = await this.prisma.conversation.findFirst({
      where: { tenantId, sessionId, phoneNumber },
      select: { id: true },
    });

    if (keeperExists) {
      // Live row exists — all orphans are redundant, delete them all.
      await this.prisma.conversation.deleteMany({
        where: { tenantId, phoneNumber, sessionId: null },
      });
      return;
    }

    // No live row — find all orphans for this phone.
    const orphans = await this.prisma.conversation.findMany({
      where: { tenantId, phoneNumber, sessionId: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' }, // oldest first — keep the original
    });

    if (orphans.length === 0) return;

    if (orphans.length > 1) {
      // Delete all but the oldest orphan to avoid self-collision on updateMany.
      const idsToDelete = orphans.slice(1).map((o) => o.id);
      await this.prisma.conversation.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    // Re-stamp the single surviving orphan with the current sessionId.
    await this.prisma.conversation.update({
      where: { id: orphans[0].id },
      data: { sessionId },
    });
  }

  // ── FIX (session 24) ───────────────────────────────────────────────────
  // The engine wraps every webhook body as { sessionId, payload: <data>, ... }
  // (see SessionManager.emitWebhook in the engine). Every other handler in
  // this file correctly reads `data.payload` for the actual content
  // (see handleMessageReceived / handleMessageOutgoing below). This handler
  // was incorrectly destructuring `chats` directly off the top-level `data`
  // object, where it never existed — so `chats` was always undefined and
  // every chat sync silently fell into the "no chats in payload" branch,
  // even when the engine logs confirmed it emitted a populated chat list.
  private async handleSessionChatsSynced(data: any): Promise<void> {
    const { sessionId } = data;
    const chats = data.payload?.chats ?? [];

    const session = await this.prisma.session.findFirst({
      where: { openwaId: sessionId },
      select: { id: true, tenantId: true },
    });

    if (!session) {
      this.logger.warn(
        `session.chats_synced — session not found: ${sessionId}`,
      );
      return;
    }

    if (!Array.isArray(chats) || chats.length === 0) {
      this.logger.warn(
        `session.chats_synced — no chats in payload for ${sessionId} (sync watchdog fallback or genuinely empty chat list) — marking sync complete with 0 conversations`,
      );
      this.gatewayService.emitSessionSyncComplete(session.tenantId, {
        sessionId,
        conversationCount: 0,
      });
      return;
    }

    const BATCH_SIZE = 20;
    const BATCH_GAP_MS = 100;
    let upsertedCount = 0;

    this.logger.log(
      `session.chats_synced — processing ${chats.length} chats for session ${sessionId} in batches of ${BATCH_SIZE}`,
    );

    for (let i = 0; i < chats.length; i += BATCH_SIZE) {
      const batch = chats.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (chat: any) => {
          try {
            const jid: string = chat.jid ?? '';
            if (!jid) return;

            if (jid.endsWith('@newsletter') || jid.endsWith('@broadcast'))
              return;

            const lastMessageAt = chat.lastMessageAt
              ? new Date(chat.lastMessageAt)
              : new Date();

            const lastMessageText: string =
              typeof chat.lastMessageText === 'string'
                ? chat.lastMessageText.slice(0, 500)
                : '';

            const unreadCount: number =
              typeof chat.unreadCount === 'number' && chat.unreadCount >= 0
                ? chat.unreadCount
                : 0;

            const contactName: string | null =
              typeof chat.contactName === 'string' && chat.contactName.trim()
                ? chat.contactName.trim()
                : null;

            await this.reattachOrphan(session.tenantId, session.id, jid);

            await this.prisma.conversation.upsert({
              where: {
                tenantId_sessionId_phoneNumber: {
                  tenantId: session.tenantId,
                  sessionId: session.id,
                  phoneNumber: jid,
                },
              },
              create: {
                tenantId: session.tenantId,
                sessionId: session.id,
                phoneNumber: jid,
                contactId: null,
                contactName,
                status: 'OPEN',
                unreadCount,
                lastMessageAt,
                lastMessageText,
              },
              update: {
                lastMessageAt,
                lastMessageText,
                unreadCount,
                ...(contactName ? { contactName } : {}),
              },
            });

            upsertedCount++;
          } catch (err) {
            this.logger.error(
              `session.chats_synced — failed to upsert chat ${chat?.jid ?? '(unknown)'}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }),
      );

      if (i + BATCH_SIZE < chats.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_GAP_MS));
      }
    }

    this.gatewayService.emitSessionSyncComplete(session.tenantId, {
      sessionId,
      conversationCount: upsertedCount,
    });

    this.logger.log(
      `session.chats_synced — done: ${upsertedCount}/${chats.length} conversations upserted for session ${sessionId}`,
    );
  }

  private resolveContactMatchPhone(payload: any, jid: string): string | null {
    const candidate: string | undefined = payload.pn ?? undefined;
    const raw = candidate ?? (jid.endsWith('@lid') ? null : jid);
    if (!raw) return null;

    const digitsOnly = raw.split('@')[0];
    const result = normalisePhone(digitsOnly);
    return result.valid ? result.normalised : null;
  }

  // ── Strip JID suffix from a Baileys-supplied address ─────────────────────
  //
  // Baileys sends fromNumber / toNumber as full JIDs:
  //   917999999999@s.whatsapp.net   (regular contacts)
  //   12345678901234567890@lid      (linked-device contacts)
  //
  // Conversation.phoneNumber is stored as bare digits for regular contacts
  // (e.g. 917999999999) — that's how campaigns and outbound sends write it.
  // If we upsert with the full JID, the unique index (tenantId, sessionId,
  // phoneNumber) finds no match and creates a duplicate conversation row.
  //
  // For @lid JIDs we leave them as-is (digits@lid) because we have no phone
  // number to match against anyway — the existing conversation for that
  // contact, if any, also has phoneNumber = the full @lid string.
  private normaliseJid(jid: string): string {
    if (jid.endsWith('@s.whatsapp.net')) {
      return jid.split('@')[0]; // bare digits: 917999999999
    }
    // @lid, @g.us (groups), @broadcast, @newsletter — leave unchanged
    return jid;
  }

  private async handleMessageReceived(data: any): Promise<void> {
    try {
      const payload = data.payload ?? {};

      const incomingExternalId: string | undefined =
        payload.externalId ?? payload.id ?? undefined;

      if (incomingExternalId) {
        const existing = await this.prisma.message.findFirst({
          where: { externalId: incomingExternalId },
          select: { id: true },
        });
        if (existing) {
          this.logger.debug(
            `message.received — skipping duplicate, externalId: ${incomingExternalId}`,
          );
          return;
        }
      }

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

      const rawFrom: string = payload.from ?? data.from ?? '';

      if (rawFrom.endsWith('@newsletter')) {
        this.logger.debug(
          `message.received — skipping newsletter broadcast from ${rawFrom}`,
        );
        return;
      }

      // ── FIX (session 29) — strip @s.whatsapp.net suffix ─────────────────
      // Baileys sends fromNumber as a full JID (e.g. 917999999999@s.whatsapp.net).
      // Conversation.phoneNumber is stored as bare digits. Upserting with the
      // full JID creates a duplicate conversation row instead of matching the
      // existing one. @lid JIDs are left unchanged — no phone number to strip.
      const fromNumber = this.normaliseJid(rawFrom);

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

      this.logger.debug(
        `Message type raw=${rawType} normalised=${messageType} from=${fromNumber} (raw JID: ${rawFrom})`,
      );

      const {
        body: messageBody,
        mediaUrl,
        mediaType,
      } = this.extractMessageContent(payload, messageType, session.tenantId);

      const now = new Date(payload.timestamp ?? data.timestamp ?? Date.now());

      const matchPhone = this.resolveContactMatchPhone(payload, rawFrom);

      // ── FIX (session 29) — fetch contact.name for CRM name priority ──────
      // Previously only fetched id + whatsappName. We now also fetch name so
      // contactName written to the Conversation row respects the same priority
      // order as ConversationsService.listConversations():
      //   1. contact.name (CRM name set by the tenant)  ← highest priority
      //   2. pushName (WhatsApp display name)
      //   3. null / fallback
      // Without this, every inbound message overwrote contactName with the
      // raw pushName even when the tenant had a proper CRM name saved.
      const contact = matchPhone
        ? await this.prisma.contact.findUnique({
            where: {
              tenantId_phoneNumber: {
                tenantId: session.tenantId,
                phoneNumber: matchPhone,
              },
            },
            select: { id: true, name: true, whatsappName: true },
          })
        : null;

      const incomingPushName: string | undefined =
        typeof payload.pushName === 'string' && payload.pushName.trim()
          ? payload.pushName.trim()
          : undefined;

      if (
        contact &&
        incomingPushName &&
        incomingPushName !== contact.whatsappName
      ) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { whatsappName: incomingPushName },
        });
        this.logger.debug(
          `whatsappName updated for contact ${contact.id}: "${contact.whatsappName ?? 'null'}" → "${incomingPushName}"`,
        );
      }

      // Resolve the contactName to write to the Conversation row.
      // Priority: CRM name → pushName → null.
      // We never overwrite a good CRM name with a raw WhatsApp pushName.
      const resolvedContactName: string | null =
        contact?.name?.trim() || incomingPushName || null;

      await this.reattachOrphan(session.tenantId, session.id, fromNumber);

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
          contactName: resolvedContactName,
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
          // Only update contactName when we have a resolved name.
          // Never overwrite an existing CRM name with a bare pushName —
          // the resolved value already respects priority (CRM > pushName).
          ...(resolvedContactName ? { contactName: resolvedContactName } : {}),
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
          externalId: incomingExternalId ?? null,
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
      throw error;
    }
  }

  private async handleMessageOutgoing(data: any): Promise<void> {
    try {
      const payload = data.payload ?? {};
      const externalId: string | undefined =
        payload.id?._serialized ?? payload.id;

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

      const rawTo: string = payload.to ?? '';

      // ── FIX (session 29) — strip @s.whatsapp.net suffix ─────────────────
      // Same JID normalisation as handleMessageReceived — outgoing messages
      // sent from the phone app arrive via message.outgoing with a full JID
      // in payload.to. Normalise before upsert to match the existing
      // conversation row (stored as bare digits from the outbound send path).
      const toNumber = this.normaliseJid(rawTo);

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

      const now = new Date(payload.timestamp ?? data.timestamp ?? Date.now());

      const matchPhone = this.resolveContactMatchPhone(payload, rawTo);

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

      await this.reattachOrphan(session.tenantId, session.id, toNumber);

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

  private async handleMessageReaction(data: any): Promise<void> {
    try {
      const payload = data.payload ?? {};
      const { targetExternalId, senderJid, emoji } = payload;

      if (!targetExternalId || !senderJid) {
        this.logger.warn(
          `message.reaction — missing targetExternalId or senderJid, skipping`,
        );
        return;
      }

      const message = await this.prisma.message.findFirst({
        where: { externalId: targetExternalId },
        select: {
          id: true,
          tenantId: true,
          conversationId: true,
          reactions: true,
        },
      });

      if (!message) {
        this.logger.warn(
          `message.reaction — no message found for externalId: ${targetExternalId}`,
        );
        return;
      }

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

      if (message.conversationId) {
        this.gatewayService.emitMessageReaction(message.tenantId, {
          messageId: message.id,
          conversationId: message.conversationId,
          reactions: cleaned,
        });
      }

      this.logger.log(
        `message.reaction — ${senderJid} ${emoji ? `reacted ${emoji}` : 'removed reaction'} on externalId ${targetExternalId}`,
      );
    } catch (error) {
      this.logger.error(
        `handleMessageReaction failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  // ── Decrypt-failure handler ───────────────────────────────────────────────
  // Fires when the engine receives a message it cannot decrypt (Baileys
  // messageStubType === 2 / CIPHERTEXT). The message content is permanently
  // lost — this handler only provides visibility:
  //   1. Logs the event with session + sender info for debugging.
  //   2. Looks up the conversation (if it exists) to attach a tenantId.
  //   3. Emits a message:decrypt_failed WS event so the frontend can render
  //      a "Message could not be decrypted" placeholder in the thread instead
  //      of leaving a silent gap.
  //
  // Intentionally does NOT create a Message row — a row with no body and no
  // externalId would be unrecoverable noise in the DB. The WS event is enough
  // for the active frontend session; on refresh the placeholder disappears,
  // which is acceptable given content is unrecoverable anyway.
  private async handleMessageDecryptFailed(data: any): Promise<void> {
    try {
      const payload = data.payload ?? {};
      const fromNumber: string = payload.from ?? payload.sender ?? '';

      const session = await this.prisma.session.findFirst({
        where: { openwaId: data.sessionId },
        select: { id: true, tenantId: true },
      });

      if (!session) {
        this.logger.warn(
          `message.decrypt_failed — session not found: ${data.sessionId}, from: ${fromNumber}`,
        );
        return;
      }

      // Try to find an existing conversation so the frontend can route the
      // placeholder to the right thread. Null if no conversation exists yet
      // (e.g. first ever message from this contact failed to decrypt).
      const conversation = fromNumber
        ? await this.prisma.conversation.findFirst({
            where: {
              tenantId: session.tenantId,
              sessionId: session.id,
              phoneNumber: fromNumber,
            },
            select: { id: true },
          })
        : null;

      this.gatewayService.emitMessageDecryptFailed(session.tenantId, {
        sessionId: data.sessionId,
        fromNumber,
        conversationId: conversation?.id ?? null,
        timestamp: data.timestamp ?? Date.now(),
      });

      this.logger.warn(
        `message.decrypt_failed — session: ${data.sessionId}, from: ${fromNumber || '(unknown)'}, conversationId: ${conversation?.id ?? 'none'}`,
      );
    } catch (error) {
      this.logger.error(
        `handleMessageDecryptFailed failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Do not rethrow — a decrypt-failure handler crashing would be ironic
      // and unhelpful. Log and move on.
    }
  }

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
