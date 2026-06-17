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

  // ─── Import CSV recipients ────────────────────────────────────────────────
  //
  // Adds recipients to an existing campaign from a CSV file buffer.
  // Only valid for DRAFT or SCHEDULED campaigns — RUNNING/COMPLETED/CANCELLED
  // campaigns cannot have recipients added after the processor has started.
  //
  // Does NOT re-enqueue or trigger the campaign processor — that was already
  // handled by createCampaign. If the campaign was DRAFT (0 contacts at
  // creation, which createCampaign allows), the processor will have been
  // enqueued already; it will simply find 0 contacts and complete immediately
  // unless recipients are added before the job is picked up by the worker.
  // For production use, CSV upload should be chained immediately after create.

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

    // ── Parse CSV ────────────────────────────────────────────────────────────
    // Same options as ContactsService.importContacts: columns inferred from
    // header row, empty lines skipped, values trimmed, relaxed column count
    // so rows with missing optional columns don't throw.

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

    // ── Validate rows ─────────────────────────────────────────────────────────
    // Collect valid phone numbers first so we can bulk-insert in one
    // transaction rather than one insert per row (unlike importContacts which
    // upserts row-by-row because it needs per-row update logic).

    const validPhoneNumbers: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2: row 1 is header, data starts at row 2

      if (!row.phoneNumber) {
        result.errors.push({ row: rowNum, reason: 'Missing phoneNumber' });
        result.skipped++;
        continue;
      }

      validPhoneNumbers.push(row.phoneNumber);
    }

    if (validPhoneNumbers.length === 0) {
      // All rows were invalid — return early, no DB writes needed
      return result;
    }

    // ── Bulk insert + update totalContacts atomically ─────────────────────────
    // createMany with skipDuplicates handles the case where the user uploads
    // the same CSV twice, or overlaps with contactIds already added at creation.
    // The unique constraint on CampaignContact is (campaignId, phoneNumber) —
    // confirm this exists in your schema; if not, duplicates will be inserted.
    //
    // We use $transaction so totalContacts stays consistent with the actual
    // CampaignContact row count even if the update is interrupted.

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.campaignContact.createMany({
        data: validPhoneNumbers.map((phoneNumber) => ({
          campaignId,
          tenantId,
          phoneNumber,
          status: 'PENDING' as const,
          // contactId intentionally omitted — CSV recipients are ad-hoc,
          // they don't require a Contact record to exist.
        })),
        skipDuplicates: true,
      });

      result.created = count;
      // Rows that were valid phone numbers but skipped by skipDuplicates
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
}
