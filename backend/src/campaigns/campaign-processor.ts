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

    const pendingContacts = await this.prisma.campaignContact.findMany({
      where: { campaignId, status: 'PENDING' },
    });

    const apiKey = this.config.get<string>('OPENWA_API_KEY');
    const delayMs = Math.floor(60000 / (campaign.rateLimitPerMin || 30));
    const messageType = resolveMessageType(
      campaign.mediaUrl,
      campaign.mediaType,
    );
    const engineMediaUrl = this.engineClient.toEngineAccessibleUrl(
      campaign.mediaUrl,
    );

    let engine;
    try {
      engine = await this.engineRegistry.getInstanceForSession(
        campaign.sessionId,
      );
    } catch {
      this.logger.error(
        `No engine instance for session ${campaign.sessionId}, cancelling campaign ${campaignId}`,
      );
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'CANCELLED' },
      });
      return;
    }

    for (const contact of pendingContacts) {
      const current = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });
      if (current?.status === 'CANCELLED') {
        this.logger.log(`Campaign ${campaignId} cancelled mid-run, stopping`);
        return;
      }

      const message = await this.prisma.message.create({
        data: {
          tenantId,
          sessionId: campaign.sessionId,
          campaignId: campaign.id,
          direction: 'OUTBOUND',
          type: messageType as any,
          fromNumber: campaign.session.phoneNumber ?? '',
          toNumber: contact.phoneNumber,
          body: campaign.messageTemplate,
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
            text: campaign.messageTemplate,
            caption: campaign.messageTemplate,
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

      await new Promise((r) => setTimeout(r, delayMs));
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
  if (!mediaType) return 'IMAGE'; // legacy fallback
  if (mediaType.startsWith('image/')) return 'IMAGE';
  if (mediaType.startsWith('video/')) return 'VIDEO';
  if (mediaType.startsWith('audio/')) return 'AUDIO';
  if (mediaType === 'application/pdf') return 'DOCUMENT';
  return 'IMAGE'; // unknown media — best guess
}
