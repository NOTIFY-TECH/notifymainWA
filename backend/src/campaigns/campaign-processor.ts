import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayService } from '../gateway/gateway.service';
import { EngineRegistryService } from '../engine-registry/engine-registry.service';
import { EngineClientService } from '../engine-registry/engine-client.service';
import { computeCampaignProgress } from './utils/campaign-progress.util';
import {
  resolveDisplayName,
  interpolateMessage,
} from '../common/utils/message-interpolation.util';

// ─── URL extraction ────────────────────────────────────────────────────────────
// Extracts the first URL found in a string. Returns null if none found.
// Used to detect if a caption already contains a link so we can send it
// as a separate plain-text message for WhatsApp card rendering.

const URL_REGEX = /https?:\/\/[^\s]+/i;

function extractUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

// ─── Anti-spam pacing helpers ──────────────────────────────────────────────────
//
// WhatsApp's spam detection looks for burst patterns — messages sent at a
// perfectly uniform cadence are a red flag. These helpers introduce:
//
//   1. Per-message jitter:  ±40% random variance on the base delay so no two
//      consecutive gaps are identical.
//   2. Rest pauses:         After every REST_EVERY messages, a longer pause
//      (REST_MIN_MS … REST_MAX_MS) simulates a human stepping away briefly.
//   3. Hard floor:          Never below MIN_DELAY_MS regardless of rateLimitPerMin,
//      since even "30 msg/min" campaigns shouldn't fire sub-second bursts.
//
// At the default 30 msg/min (base = 2 000 ms):
//   • Per-message range  : 1 200 – 2 800 ms
//   • Rest pause range   : 8 000 – 15 000 ms every 20 messages
//   • Follow-up links    : 1 500 – 3 000 ms each (was hardcoded 500 ms)

const JITTER_FACTOR = 0.4; // ±40 % of base delay
const MIN_DELAY_MS = 1_500; // absolute floor between any two messages
const REST_EVERY = 20; // take a rest pause after every N messages
const REST_MIN_MS = 8_000;
const REST_MAX_MS = 15_000;

/** Returns a random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Jittered delay between main messages.
 * base ± (base × JITTER_FACTOR), floored at MIN_DELAY_MS.
 */
function jitteredDelay(baseMs: number): number {
  const jitter = Math.floor(baseMs * JITTER_FACTOR);
  const raw = baseMs + randInt(-jitter, jitter);
  return Math.max(raw, MIN_DELAY_MS);
}

/**
 * Random rest pause between REST_MIN_MS and REST_MAX_MS.
 * Called every REST_EVERY messages to simulate a natural break.
 */
function restPause(): Promise<void> {
  return new Promise((r) => setTimeout(r, randInt(REST_MIN_MS, REST_MAX_MS)));
}

/**
 * Random delay before sending a follow-up link card.
 * 1 500 – 3 000 ms. Distinct from main-message jitter so the two
 * messages don't arrive as an instant pair.
 */
function followUpDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, randInt(1_500, 3_000)));
}

@Processor('campaign-queue')
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: GatewayService,
    private readonly engineRegistry: EngineRegistryService,
    private readonly engineClient: EngineClientService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'process-campaign') {
      this.logger.warn(`Unknown job type: ${job.name}`);
      return;
    }
    await this.handleCampaign(job.data);
  }

  private async handleCampaign(data: {
    campaignId: string;
    tenantId: string;
  }): Promise<void> {
    const { campaignId, tenantId } = data;

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: { session: true },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found, skipping`);
      return;
    }

    if (campaign.status === 'CANCELLED') {
      this.logger.log(`Campaign ${campaignId} already cancelled, skipping`);
      return;
    }

    if (campaign.status !== 'RUNNING') {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'RUNNING',
          startedAt: campaign.startedAt ?? new Date(),
        },
      });
    }

    // ── Fetch pending contacts WITH their Contact row for {{name}} resolution ──
    // contact is optional on CampaignContact (contactId is nullable) so the
    // include may return null — resolveDisplayName handles that gracefully.
    const pendingContacts = await this.prisma.campaignContact.findMany({
      where: { campaignId, status: 'PENDING' },
      include: {
        contact: {
          select: { whatsappName: true, name: true },
        },
      },
    });

    const apiKey = this.config.get<string>('OPENWA_API_KEY');
    const baseDelayMs = Math.floor(60_000 / (campaign.rateLimitPerMin || 30));
    const messageType = resolveMessageType(
      campaign.mediaUrl,
      campaign.mediaType,
    );
    const isLinkOnly = campaign.mediaType === 'text/link';
    const engineMediaUrl = this.engineClient.toEngineAccessibleUrl(
      campaign.mediaUrl,
    );

    // ── Resolve follow-up link messages ──────────────────────────────────────
    // After the main media+caption send, we may need to send 1 or 2 additional
    // plain-text messages so WhatsApp renders them as link-preview cards.
    //
    // Priority order (matching the agreed spec):
    //   1. URL extracted from caption text (if any)
    //   2. Explicit linkUrl field (if any)
    //
    // Both are sent if both are present (up to 3 total messages per contact).
    // They are only sent when the main message has media — text-only campaigns
    // with a URL in the body do not trigger the split behaviour.

    const hasMedia = !!campaign.mediaUrl && !isLinkOnly;
    const captionUrl = hasMedia
      ? extractUrlFromText(campaign.messageTemplate)
      : null;
    const explicitLinkUrl =
      hasMedia && campaign.linkUrl ? campaign.linkUrl : null;

    // Deduplicate: if the explicit link is the same URL already in the caption,
    // only send it once.
    const followUpUrls: string[] = [];
    if (captionUrl) followUpUrls.push(captionUrl);
    if (explicitLinkUrl && explicitLinkUrl !== captionUrl) {
      followUpUrls.push(explicitLinkUrl);
    }

    let engine;
    try {
      engine = await this.engineRegistry.getInstanceForSession(
        campaign.sessionId,
      );
    } catch {
      const fallbackInstanceId = campaign.session?.engineInstanceId ?? null;
      if (!fallbackInstanceId) {
        this.logger.error(
          `No engine instance for session ${campaign.sessionId} and no DB fallback, cancelling campaign ${campaignId}`,
        );
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'CANCELLED' },
        });
        return;
      }
      this.logger.warn(
        `Redis mapping missing for session ${campaign.sessionId}, falling back to DB instanceId ${fallbackInstanceId}`,
      );
      try {
        engine = await this.engineRegistry.getInstanceById(fallbackInstanceId);
      } catch {
        this.logger.error(
          `DB fallback engine ${fallbackInstanceId} also not found in Redis, cancelling campaign ${campaignId}`,
        );
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'CANCELLED' },
        });
        return;
      }
    }

    // ── Main send loop ────────────────────────────────────────────────────────
    // messagesSentThisBatch tracks progress for rest-pause triggering.
    // It increments on every attempt (success or failure) so pauses are
    // evenly spaced regardless of delivery outcome.

    let messagesSentThisBatch = 0;

    for (const contact of pendingContacts) {
      const current = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });
      if (current?.status === 'CANCELLED') {
        this.logger.log(`Campaign ${campaignId} cancelled mid-run, stopping`);
        return;
      }

      // ── Per-contact {{name}} interpolation (17.4) ─────────────────────────
      const displayName = resolveDisplayName(
        contact.contact,
        contact.phoneNumber,
      );

      const baseText = isLinkOnly
        ? `${campaign.messageTemplate}\n\n${campaign.mediaUrl}`
        : campaign.messageTemplate;

      const outboundText = interpolateMessage(baseText, displayName);

      // ── Find-or-create Conversation for this recipient ────────────────────
      const sessionId = campaign.sessionId;

      const keeperExists = await this.prisma.conversation.findFirst({
        where: { tenantId, sessionId, phoneNumber: contact.phoneNumber },
        select: { id: true },
      });

      if (!keeperExists) {
        await this.prisma.conversation.updateMany({
          where: {
            tenantId,
            phoneNumber: contact.phoneNumber,
            sessionId: null,
          },
          data: { sessionId },
        });
      } else {
        await this.prisma.conversation.deleteMany({
          where: {
            tenantId,
            phoneNumber: contact.phoneNumber,
            sessionId: null,
          },
        });
      }

      const conversation = await this.prisma.conversation.upsert({
        where: {
          tenantId_sessionId_phoneNumber: {
            tenantId,
            sessionId,
            phoneNumber: contact.phoneNumber,
          },
        },
        create: {
          tenantId,
          sessionId,
          phoneNumber: contact.phoneNumber,
          contactId: contact.contactId ?? null,
          contactName: displayName ?? null,
          status: 'OPEN',
          unreadCount: 0,
          lastMessageAt: new Date(),
          lastMessageText: outboundText.slice(0, 500),
        },
        update: {
          lastMessageAt: new Date(),
          lastMessageText: outboundText.slice(0, 500),
          ...(contact.contactId ? { contactId: contact.contactId } : {}),
        },
      });

      const conversationId = conversation.id;

      // ── Main message ──────────────────────────────────────────────────────

      const message = await this.prisma.message.create({
        data: {
          tenantId,
          sessionId: campaign.sessionId,
          conversationId,
          campaignId: campaign.id,
          direction: 'OUTBOUND',
          type: messageType as any,
          fromNumber: campaign.session.phoneNumber ?? '',
          toNumber: contact.phoneNumber,
          body: outboundText,
          mediaUrl: campaign.mediaUrl,
          status: 'PENDING',
        },
      });

      try {
        const response = await axios.post(
          `${engine.url}/api/messages/send`,
          {
            sessionId: campaign.session.openwaId,
            to: contact.phoneNumber,
            type: messageType.toLowerCase(),
            text: outboundText,
            caption: outboundText,
            mediaUrl: engineMediaUrl,
            messageId: message.id,
          },
          { headers: { 'X-API-Key': apiKey } },
        );

        const externalId =
          typeof response.data?.messageId === 'string'
            ? response.data.messageId
            : null;

        await this.prisma.message.update({
          where: { id: message.id },
          data: { status: 'SENT', externalId, sentAt: new Date() },
        });

        await this.prisma.campaignContact.update({
          where: { id: contact.id },
          data: { status: 'SENT', sentAt: new Date(), messageId: message.id },
        });

        // ── Emit to inbox in real time ────────────────────────────────────
        this.gatewayService.emitMessageReceived(tenantId, {
          messageId: message.id,
          conversationId,
          sessionId: campaign.session.openwaId,
          from: contact.phoneNumber,
          body: outboundText,
          type: messageType,
          mediaUrl: campaign.mediaUrl ?? null,
          mediaType: campaign.mediaType ?? null,
          createdAt: new Date(),
        });

        // ── Follow-up link messages ───────────────────────────────────────
        // Fire-and-forget — failure here does NOT flip CampaignContact to
        // FAILED. Randomised delay (1.5–3 s) between follow-ups.

        for (const linkUrl of followUpUrls) {
          try {
            await followUpDelay();

            const linkMessage = await this.prisma.message.create({
              data: {
                tenantId,
                sessionId: campaign.sessionId,
                conversationId,
                campaignId: campaign.id,
                direction: 'OUTBOUND',
                type: 'TEXT',
                fromNumber: campaign.session.phoneNumber ?? '',
                toNumber: contact.phoneNumber,
                body: linkUrl,
                status: 'PENDING',
              },
            });

            const linkResponse = await axios.post(
              `${engine.url}/api/messages/send`,
              {
                sessionId: campaign.session.openwaId,
                to: contact.phoneNumber,
                type: 'text',
                text: linkUrl,
                messageId: linkMessage.id,
              },
              { headers: { 'X-API-Key': apiKey } },
            );

            const linkExternalId =
              typeof linkResponse.data?.messageId === 'string'
                ? linkResponse.data.messageId
                : null;

            await this.prisma.message.update({
              where: { id: linkMessage.id },
              data: {
                status: 'SENT',
                externalId: linkExternalId,
                sentAt: new Date(),
              },
            });

            this.logger.debug(
              `Campaign ${campaignId}: sent link card to ${contact.phoneNumber}: ${linkUrl}`,
            );
          } catch (linkErr) {
            this.logger.warn(
              `Campaign ${campaignId}: failed to send link card to ${contact.phoneNumber} (${linkUrl}): ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`,
            );
          }
        }

        await this.emitProgress(campaignId, tenantId);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        await this.prisma.message.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: errMsg.slice(0, 500),
          },
        });

        await this.prisma.campaignContact.update({
          where: { id: contact.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: errMsg.slice(0, 500),
            messageId: message.id,
          },
        });

        await this.emitProgress(campaignId, tenantId);

        this.logger.error(
          `Campaign ${campaignId}: failed to send to ${contact.phoneNumber}: ${errMsg}`,
        );
      }

      // ── Anti-spam pacing ──────────────────────────────────────────────────
      // 1. Jittered inter-message delay (replaces fixed delayMs).
      // 2. Occasional longer rest pause every REST_EVERY messages.
      //
      // The rest pause fires BEFORE the jittered delay so the gap between
      // the last message of a batch and the first of the next is:
      //   rest (8–15 s) + jitter (base ± 40 %)
      // which is noticeably longer than the mid-batch gaps — a natural
      // human rhythm.

      messagesSentThisBatch++;

      if (messagesSentThisBatch % REST_EVERY === 0) {
        this.logger.debug(
          `Campaign ${campaignId}: rest pause after ${messagesSentThisBatch} messages`,
        );
        await restPause();
      }

      await new Promise((r) => setTimeout(r, jitteredDelay(baseDelayMs)));
    }

    const finalCampaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    });

    if (finalCampaign && finalCampaign.status !== 'CANCELLED') {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      await this.emitProgress(campaignId, tenantId);
    }
  }

  private async emitProgress(
    campaignId: string,
    tenantId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, totalContacts: true, status: true },
    });
    if (!campaign) return;

    const progress = await computeCampaignProgress(this.prisma, campaignId);

    this.gatewayService.emitCampaignProgress(tenantId, {
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

/**
 * Derives the engine message type from the campaign's stored MIME type.
 * Falls back gracefully: if mediaUrl exists but mediaType is missing,
 * defaults to IMAGE (legacy behaviour). No mediaUrl → TEXT.
 */
function resolveMessageType(
  mediaUrl: string | null,
  mediaType: string | null,
): string {
  if (!mediaUrl) return 'TEXT';
  if (mediaType === 'text/link') return 'TEXT';
  if (!mediaType) return 'IMAGE';
  if (mediaType.startsWith('image/')) return 'IMAGE';
  if (mediaType.startsWith('video/')) return 'VIDEO';
  if (mediaType.startsWith('audio/')) return 'AUDIO';
  if (mediaType === 'application/pdf') return 'DOCUMENT';
  return 'IMAGE';
}
