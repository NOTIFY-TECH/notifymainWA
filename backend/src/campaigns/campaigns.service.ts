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
import {
  CampaignRecipientRow,
  ImportRecipientsResult,
} from './dto/import-recipients.dto';
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import {
  computeCampaignProgress,
  computeCampaignProgressBatch,
} from './utils/campaign-progress.util';
import { AddCampaignContactsDto } from './dto/add-campaign-contacts.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

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

  // ─── Shared: resolve contactIds + tags into a deduped recipient list ────
  //
  // Used by createCampaign (fresh campaign, zero existing contacts) and
  // addContactsToCampaign (existing campaign, may already have contacts —
  // that caller still needs skipDuplicates on insert against the existing
  // rows; this method only de-dupes within the newly-resolved set itself).

  private async resolveRecipients(
    tenantId: string,
    contactIds?: string[],
    tags?: string[],
  ): Promise<{ id: string; phoneNumber: string }[]> {
    const contacts: { id: string; phoneNumber: string }[] = [];

    if (contactIds?.length) {
      const byId = await this.prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          tenantId,
          deletedAt: null,
        },
        select: { id: true, phoneNumber: true },
      });

      if (byId.length !== contactIds.length) {
        throw new BadRequestException('One or more contactIds are invalid.');
      }

      contacts.push(...byId);
    }

    if (tags?.length) {
      const byTag = await this.prisma.contact.findMany({
        where: {
          tenantId,
          deletedAt: null,
          tags: { some: { tag: { in: tags } } },
        },
        select: { id: true, phoneNumber: true },
      });

      contacts.push(...byTag);
    }

    return Array.from(new Map(contacts.map((c) => [c.id, c])).values());
  }

  // ─── List campaigns ──────────────────────────────────────────────────────

  async listCampaigns(tenantId: string, dto: ListCampaignsDto) {
    const {
      page = 1,
      limit = 20,
      status,
      sessionId,
      search,
      dateFrom,
      dateTo,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = { tenantId };
    if (status) where.status = status as any;
    if (sessionId) where.sessionId = sessionId;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const end = new Date(dateTo);
        if (dateTo.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        where.createdAt.lte = end;
      }
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

    const progressMap = await computeCampaignProgressBatch(
      this.prisma,
      campaigns.map((c) => c.id),
    );

    const data = campaigns.map((c) => {
      const progress = progressMap.get(c.id);
      return progress ? { ...c, ...progress } : c;
    });

    return {
      data,
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

    const progress = await computeCampaignProgress(this.prisma, campaignId);

    return { data: { ...campaign, ...progress } };
  }

  // ─── Create campaign ──────────────────────────────────────────────────────

  async createCampaign(
    tenantId: string,
    userId: string,
    dto: CreateCampaignDto,
  ) {
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

    const contacts = await this.resolveRecipients(
      tenantId,
      dto.contactIds,
      dto.tags,
    );

    const isImmediate = !dto.scheduledAt;

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          tenantId,
          sessionId: dto.sessionId,
          createdById: userId,
          name: dto.name,
          messageTemplate: dto.messageTemplate,
          mediaUrl: dto.mediaUrl,
          mediaType: dto.mediaType ?? null,
          linkUrl: dto.linkUrl ?? null,
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

  // ─── Update (edit) a draft/scheduled campaign ────────────────────────────
  //
  // Same status gate as addContactsToCampaign — once a campaign is RUNNING
  // or beyond, its content is locked. sessionId is editable (validated
  // against tenant ownership, same check as createCampaign).

  async updateCampaign(
    tenantId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ) {
    const campaign = await this.findCampaignOrThrow(tenantId, campaignId);

    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot edit a campaign with status ${campaign.status}. ` +
          `Only DRAFT or SCHEDULED campaigns can be edited.`,
      );
    }

    if (dto.sessionId) {
      const session = await this.prisma.session.findFirst({
        where: { id: dto.sessionId, tenantId },
      });
      if (!session) {
        throw new NotFoundException(`Session ${dto.sessionId} not found`);
      }
      if (session.status !== 'CONNECTED') {
        throw new BadRequestException(
          'Session must be CONNECTED to use it for a campaign',
        );
      }
    }

    // scheduledAt: string | null | undefined
    //   undefined → not provided, leave untouched
    //   null      → explicitly clear the schedule
    //   string    → set to the given ISO date
    const scheduledAtUpdate =
      dto.scheduledAt === undefined
        ? undefined
        : dto.scheduledAt === null
          ? null
          : new Date(dto.scheduledAt);

    // If clearing the schedule on a SCHEDULED campaign, drop it back to DRAFT
    // so it doesn't sit in limbo (SCHEDULED with no scheduledAt would be
    // meaningless and confusing in the UI).
    const statusUpdate =
      campaign.status === 'SCHEDULED' && dto.scheduledAt === null
        ? 'DRAFT'
        : undefined;

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: dto.name,
        sessionId: dto.sessionId,
        messageTemplate: dto.messageTemplate,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        linkUrl: dto.linkUrl,
        rateLimitPerMin: dto.rateLimitPerMin,
        scheduledAt: scheduledAtUpdate,
        ...(statusUpdate && { status: statusUpdate }),
      },
    });

    this.logger.log(`Campaign ${campaignId} updated`);
    return { data: updated };
  }

  // ─── Launch a draft campaign ──────────────────────────────────────────────
  //
  // The missing piece that let createCampaign be the ONLY path that ever
  // enqueued a BullMQ job. Drafts created via clone (or any future "create
  // empty, add recipients later" flow) had no way to actually start sending.
  //
  // Mirrors createCampaign's isImmediate logic exactly:
  //   no scheduledAt        → status RUNNING, startedAt now, enqueue with no delay
  //   scheduledAt in future → status SCHEDULED, enqueue with a delay
  //
  // Requires totalContacts > 0 — launching an empty campaign would just
  // immediately flip to COMPLETED with nothing sent, which is more
  // confusing than just blocking it outright.

  async launchCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.findCampaignOrThrow(tenantId, campaignId);

    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot launch a campaign with status ${campaign.status}.`,
      );
    }

    if (campaign.totalContacts === 0) {
      throw new BadRequestException(
        'Add at least one recipient before launching this campaign.',
      );
    }

    const session = await this.prisma.session.findFirst({
      where: { id: campaign.sessionId, tenantId },
    });
    if (!session || session.status !== 'CONNECTED') {
      throw new BadRequestException(
        'The session attached to this campaign must be CONNECTED to launch.',
      );
    }

    const isImmediate = !campaign.scheduledAt;

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: isImmediate ? 'RUNNING' : 'SCHEDULED',
        startedAt: isImmediate ? new Date() : null,
      },
    });

    const jobData = { campaignId, tenantId };
    if (isImmediate) {
      await this.campaignQueue.add('process-campaign', jobData);
    } else {
      const delay = Math.max(campaign.scheduledAt.getTime() - Date.now(), 0);
      await this.campaignQueue.add('process-campaign', jobData, { delay });
    }

    this.logger.log(
      `Campaign ${campaignId} launched (${updated.status}), ${campaign.totalContacts} contacts`,
    );

    return { data: updated };
  }

  // ─── Import CSV recipients ────────────────────────────────────────────────

  async importCampaignRecipients(
    tenantId: string,
    campaignId: string,
    fileBuffer: Buffer,
  ): Promise<ImportRecipientsResult> {
    const campaign = await this.findCampaignOrThrow(tenantId, campaignId);

    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot add recipients to a campaign with status ${campaign.status}. ` +
          `Only DRAFT or SCHEDULED campaigns accept new recipients.`,
      );
    }

    let rows: CampaignRecipientRow[];
    try {
      rows = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to parse CSV: ${err.message ?? 'unknown error'}`,
      );
    }

    const result: ImportRecipientsResult = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    const validPhoneNumbers: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.phoneNumber) {
        result.errors.push({ row: rowNum, reason: 'Missing phoneNumber' });
        result.skipped++;
        continue;
      }

      validPhoneNumbers.push(row.phoneNumber);
    }

    if (validPhoneNumbers.length === 0) {
      return result;
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.campaignContact.createMany({
        data: validPhoneNumbers.map((phoneNumber) => ({
          campaignId,
          tenantId,
          phoneNumber,
          status: 'PENDING' as const,
        })),
        skipDuplicates: true,
      });

      result.created = count;
      result.skipped += validPhoneNumbers.length - count;

      if (count > 0) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { totalContacts: { increment: count } },
        });
      }
    });

    this.logger.log(
      `Campaign ${campaignId}: imported ${result.created} recipients, ` +
        `skipped ${result.skipped}, errors ${result.errors.length}`,
    );

    return result;
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

  // ─── Retry failed recipients ─────────────────────────────────────────────
  //
  // Re-queues only CampaignContact rows currently FAILED for this campaign:
  // resets them to PENDING (clearing failedAt/errorMessage, bumping
  // retryCount), then adds a fresh process-campaign job. The processor only
  // ever picks up rows with status: PENDING, so already-SENT/DELIVERED/READ
  // contacts are untouched — this is a fan-out of failures only, not a full
  // re-run of the campaign.
  //
  // Restricted to COMPLETED campaigns: retrying mid-RUNNING is meaningless
  // (the processor is already working through PENDING rows), and
  // DRAFT/SCHEDULED campaigns haven't been attempted yet, so there's nothing
  // to retry. If you need retry-from-CANCELLED too, loosen this check.

  async retryFailedCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.findCampaignOrThrow(tenantId, campaignId);

    if (campaign.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Cannot retry campaign with status ${campaign.status}. Only COMPLETED campaigns can be retried.`,
      );
    }

    const failedContacts = await this.prisma.campaignContact.findMany({
      where: { campaignId, tenantId, status: 'FAILED' },
      select: { id: true },
    });

    if (failedContacts.length === 0) {
      throw new BadRequestException('No failed recipients to retry');
    }

    await this.prisma.campaignContact.updateMany({
      where: { id: { in: failedContacts.map((c) => c.id) } },
      data: {
        status: 'PENDING',
        failedAt: null,
        errorMessage: null,
        retryCount: { increment: 1 },
      },
    });

    await this.campaignQueue.add('process-campaign', {
      campaignId,
      tenantId,
    });

    this.logger.log(
      `Campaign ${campaignId}: re-queued ${failedContacts.length} failed recipients for retry`,
    );

    const progress = await computeCampaignProgress(this.prisma, campaignId);

    return {
      data: {
        campaignId,
        retriedCount: failedContacts.length,
        ...progress,
      },
    };
  }

  // ─── Clone campaign as new draft ─────────────────────────────────────────
  //
  // Copies name, messageTemplate, mediaUrl, sessionId into a fresh DRAFT
  // campaign with zero contacts attached. createdById is set to whoever
  // performs the clone (not copied from the original), matching normal
  // audit-trail expectations. scheduledAt is intentionally NOT copied — a
  // clone starts as a plain unscheduled draft; the user sets a new schedule
  // (if any) via updateCampaign before launching.

  async cloneCampaign(tenantId: string, campaignId: string, userId: string) {
    const original = await this.findCampaignOrThrow(tenantId, campaignId);

    const clone = await this.prisma.campaign.create({
      data: {
        tenantId,
        sessionId: original.sessionId,
        createdById: userId,
        name: `${original.name} (Copy)`,
        messageTemplate: original.messageTemplate,
        mediaUrl: original.mediaUrl,
        mediaType: original.mediaType ?? null,
        linkUrl: original.linkUrl ?? null,
        rateLimitPerMin: original.rateLimitPerMin,
        status: 'DRAFT',
        totalContacts: 0,
      },
    });

    this.logger.log(`Campaign ${campaignId} cloned as new draft ${clone.id}`);

    return { data: clone };
  }

  // ─── Add recipients to an existing campaign ──────────────────────────────
  //
  // Unlike createCampaign (building rows for a campaign with zero existing
  // contacts), this campaign may already have CampaignContact rows — so the
  // insert must use skipDuplicates against the (campaignId, phoneNumber)
  // unique constraint, and totalContacts increments by the actual inserted
  // count, not the requested count. Mirrors the pattern already used in
  // importCampaignRecipients (the CSV path) for consistency. CSV-based
  // additions still go through that separate endpoint — not duplicated here.

  async addContactsToCampaign(
    tenantId: string,
    campaignId: string,
    dto: AddCampaignContactsDto,
  ) {
    const campaign = await this.findCampaignOrThrow(tenantId, campaignId);

    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot add recipients to a campaign with status ${campaign.status}. ` +
          `Only DRAFT or SCHEDULED campaigns accept new recipients.`,
      );
    }

    const contacts = await this.resolveRecipients(
      tenantId,
      dto.contactIds,
      dto.tags,
    );

    if (contacts.length === 0) {
      throw new BadRequestException(
        'No contacts resolved from the provided contactIds/tags.',
      );
    }

    const addedCount = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.campaignContact.createMany({
        data: contacts.map((c) => ({
          campaignId,
          contactId: c.id,
          tenantId,
          phoneNumber: c.phoneNumber,
          status: 'PENDING' as const,
        })),
        skipDuplicates: true,
      });

      if (count > 0) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { totalContacts: { increment: count } },
        });
      }

      return count;
    });

    this.logger.log(
      `Campaign ${campaignId}: added ${addedCount} recipients ` +
        `(${contacts.length - addedCount} duplicates skipped)`,
    );

    const progress = await computeCampaignProgress(this.prisma, campaignId);

    return {
      data: {
        campaignId,
        addedCount,
        skippedCount: contacts.length - addedCount,
        ...progress,
      },
    };
  }
}
