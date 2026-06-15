import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('campaign-queue') private readonly campaignQueue: Queue,
  ) {}

  // ─── Shared: find or throw ──────────────────────────────────────────────

  private async findCampaignOrThrow(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    return campaign;
  }

  // ─── List campaigns ──────────────────────────────────────────────────────

  async listCampaigns(tenantId: string, dto: ListCampaignsDto) {
    const { page = 1, limit = 20, status, sessionId, search } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = { tenantId };
    if (status) where.status = status as any;
    if (sessionId) where.sessionId = sessionId;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          session: { select: { id: true, name: true, phoneNumber: true } },
        },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      data: campaigns,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Get single campaign ─────────────────────────────────────────────────

  async getCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        session: { select: { id: true, name: true, phoneNumber: true } },
        contacts: {
          select: {
            id: true,
            phoneNumber: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            failedAt: true,
            errorMessage: true,
            retryCount: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return { data: campaign };
  }

  // ─── Create campaign ──────────────────────────────────────────────────────

  async createCampaign(
    tenantId: string,
    userId: string,
    dto: CreateCampaignDto,
  ) {
    // Validate session belongs to tenant and is CONNECTED
    const session = await this.prisma.session.findFirst({
      where: { id: dto.sessionId, tenantId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${dto.sessionId} not found`);
    }

    if (session.status !== 'CONNECTED') {
      throw new BadRequestException(
        'Session must be CONNECTED to launch a campaign',
      );
    }

    // Validate all contactIds belong to tenant
    let contacts: { id: string; phoneNumber: string }[] = [];
    if (dto.contactIds?.length) {
      contacts = await this.prisma.contact.findMany({
        where: {
          id: { in: dto.contactIds },
          tenantId,
          deletedAt: null,
        },
        select: { id: true, phoneNumber: true },
      });

      if (contacts.length !== dto.contactIds.length) {
        throw new BadRequestException(
          'One or more contactIds are invalid or do not belong to this tenant',
        );
      }
    }

    const isImmediate = !dto.scheduledAt;

    // Create Campaign + CampaignContact rows together
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          tenantId,
          sessionId: dto.sessionId,
          createdById: userId,
          name: dto.name,
          messageTemplate: dto.messageTemplate,
          mediaUrl: dto.mediaUrl,
          rateLimitPerMin: dto.rateLimitPerMin ?? 30,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          status: isImmediate ? 'RUNNING' : 'SCHEDULED',
          startedAt: isImmediate ? new Date() : null,
          totalContacts: contacts.length,
        },
      });

      if (contacts.length) {
        await tx.campaignContact.createMany({
          data: contacts.map((c) => ({
            campaignId: created.id,
            contactId: c.id,
            tenantId,
            phoneNumber: c.phoneNumber,
            status: 'PENDING',
          })),
        });
      }

      return created;
    });

    // Enqueue BullMQ job
    const jobData = { campaignId: campaign.id, tenantId };
    if (isImmediate) {
      await this.campaignQueue.add('process-campaign', jobData);
    } else {
      const delay = Math.max(
        new Date(dto.scheduledAt).getTime() - Date.now(),
        0,
      );
      await this.campaignQueue.add('process-campaign', jobData, { delay });
    }

    this.logger.log(
      `Campaign created: ${campaign.id} (${campaign.status}), ${contacts.length} contacts`,
    );

    return { data: campaign };
  }

  // ─── Cancel campaign ──────────────────────────────────────────────────────

  async cancelCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.findCampaignOrThrow(tenantId, campaignId);

    if (!['RUNNING', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Campaign cannot be cancelled from status ${campaign.status}`,
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Campaign cancelled: ${campaignId}`);
    return { data: updated };
  }
}
