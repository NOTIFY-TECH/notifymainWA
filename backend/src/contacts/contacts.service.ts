import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListContactsDto } from './dto/list-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AddTagDto } from './dto/add-tag.dto';
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import {
  ImportContactRow,
  ImportContactsResult,
} from './dto/import-contacts.dto';
import { normalisePhone } from '../common/utils/phone.util';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Shared: find or throw ──────────────────────────────────────────────────

  private async findContactOrThrow(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, deletedAt: null },
    });
    if (!contact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }
    return contact;
  }

  // ─── Shared: backfill conversations that predate a contact ──────────────────
  //
  // A Conversation only gets its contactId set at creation time (when an
  // inbound message first arrives from an unknown number) or via
  // createFromConversation. If a Contact is added/imported AFTER a
  // Conversation with the same phoneNumber already exists, nothing ever
  // re-links them — the inbox keeps showing the raw JID forever, even though
  // a matching Contact now exists. This re-links any orphaned conversations
  // (contactId null) that share the contact's phoneNumber, scoped to tenant.
  // Called after both createContact and the import path's create branch.
  private async backfillConversationLinks(
    tenantId: string,
    contactId: string,
    phoneNumber: string,
  ) {
    await this.prisma.conversation.updateMany({
      where: { tenantId, phoneNumber, contactId: null },
      data: { contactId },
    });
  }

  // ─── Feature 1 ──────────────────────────────────────────────────────────────

  async listContacts(tenantId: string, dto: ListContactsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      tags,
      isBlocked,
      isOptedOut,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof isBlocked === 'boolean') where.isBlocked = isBlocked;
    if (typeof isOptedOut === 'boolean') where.isOptedOut = isOptedOut;

    if (tags && tags.length > 0) {
      where.tags = { some: { tag: { in: tags } } };
    }

    const orderBy: Prisma.ContactOrderByWithRelationInput =
      sortBy === 'name' ? { name: sortOrder } : { createdAt: sortOrder };

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          tags: { select: { tag: true } },
          conversations: {
            select: {
              id: true,
              lastMessageAt: true,
              lastMessageText: true,
              status: true,
            },
            orderBy: { lastMessageAt: 'desc' },
            take: 1,
          },
          _count: { select: { conversations: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    const data = contacts.map((c) => ({
      id: c.id,
      phoneNumber: c.phoneNumber,
      name: c.name,
      email: c.email,
      avatarUrl: c.avatarUrl,
      notes: c.notes,
      isBlocked: c.isBlocked,
      isOptedOut: c.isOptedOut,
      tags: c.tags.map((t) => t.tag),
      conversationCount: c._count.conversations,
      lastMessageAt: c.conversations[0]?.lastMessageAt ?? null,
      lastMessageText: c.conversations[0]?.lastMessageText ?? null,
      latestConversationId: c.conversations[0]?.id ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    if (sortBy === 'lastMessageAt') {
      data.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createContact(tenantId: string, dto: CreateContactDto) {
    // phoneNumber is already normalised by @Transform in CreateContactDto
    // and validated by @Matches — no further normalisation needed here.
    const existing = await this.prisma.contact.findUnique({
      where: {
        tenantId_phoneNumber: { tenantId, phoneNumber: dto.phoneNumber },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A contact with phone number ${dto.phoneNumber} already exists`,
      );
    }

    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        phoneNumber: dto.phoneNumber,
        name: dto.name,
        email: dto.email,
        notes: dto.notes,
        tags: dto.tags?.length
          ? { create: dto.tags.map((tag) => ({ tenantId, tag })) }
          : undefined,
      },
      include: { tags: { select: { tag: true } } },
    });

    // Re-link any conversation(s) that already existed with this phone
    // number before the contact did — see backfillConversationLinks above.
    await this.backfillConversationLinks(
      tenantId,
      contact.id,
      contact.phoneNumber,
    );

    return { ...contact, tags: contact.tags.map((t) => t.tag) };
  }

  // ─── Feature 2 ──────────────────────────────────────────────────────────────

  async getContact(tenantId: string, contactId: string) {
    await this.findContactOrThrow(tenantId, contactId);

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, deletedAt: null },
      include: {
        tags: { select: { tag: true } },
        conversations: {
          select: {
            id: true,
            status: true,
            lastMessageAt: true,
            lastMessageText: true,
            unreadCount: true,
            createdAt: true,
            session: { select: { id: true, name: true, phoneNumber: true } },
          },
          orderBy: { lastMessageAt: 'desc' },
          take: 20,
        },
        _count: { select: { conversations: true } },
      },
    });

    return {
      id: contact.id,
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      email: contact.email,
      avatarUrl: contact.avatarUrl,
      notes: contact.notes,
      isBlocked: contact.isBlocked,
      isOptedOut: contact.isOptedOut,
      tags: contact.tags.map((t) => t.tag),
      conversationCount: contact._count.conversations,
      conversations: contact.conversations,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  async updateContact(
    tenantId: string,
    contactId: string,
    dto: UpdateContactDto,
  ) {
    const current = await this.findContactOrThrow(tenantId, contactId);

    // ── Phone number change: normalise, validate, check uniqueness ──────────
    // Same normalisePhone() util used everywhere else (importContacts, the
    // engine side, AddContactModal) — single source of truth per the
    // permanent codebase rule. Editing the phone does NOT touch any existing
    // Conversation.contactId links (those are FK-based, set once), but DOES
    // run the same orphan-backfill as createContact in case some other
    // conversation with the NEW number is waiting to be linked.
    let normalisedPhone: string | undefined;
    if (dto.phoneNumber !== undefined) {
      const phoneResult = normalisePhone(dto.phoneNumber);
      if (!phoneResult.valid) {
        throw new BadRequestException(
          `Invalid phoneNumber: ${phoneResult.reason}`,
        );
      }
      normalisedPhone = phoneResult.normalised;

      if (normalisedPhone !== current.phoneNumber) {
        const collision = await this.prisma.contact.findUnique({
          where: {
            tenantId_phoneNumber: { tenantId, phoneNumber: normalisedPhone },
          },
        });
        if (collision) {
          throw new ConflictException(
            `A contact with phone number ${normalisedPhone} already exists`,
          );
        }
      }
    }

    const contact = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(normalisedPhone !== undefined && { phoneNumber: normalisedPhone }),
        ...(dto.isBlocked !== undefined && { isBlocked: dto.isBlocked }),
        ...(dto.isOptedOut !== undefined && { isOptedOut: dto.isOptedOut }),
      },
      include: { tags: { select: { tag: true } } },
    });

    if (
      normalisedPhone !== undefined &&
      normalisedPhone !== current.phoneNumber
    ) {
      await this.backfillConversationLinks(
        tenantId,
        contact.id,
        normalisedPhone,
      );
    }

    return { ...contact, tags: contact.tags.map((t) => t.tag) };
  }

  async addTag(tenantId: string, contactId: string, dto: AddTagDto) {
    await this.findContactOrThrow(tenantId, contactId);

    await this.prisma.contactTag.upsert({
      where: { contactId_tag: { contactId, tag: dto.tag } },
      create: { contactId, tenantId, tag: dto.tag },
      update: {},
    });

    return this.getContact(tenantId, contactId);
  }

  async removeTag(tenantId: string, contactId: string, tag: string) {
    await this.findContactOrThrow(tenantId, contactId);

    await this.prisma.contactTag.deleteMany({
      where: { contactId, tag },
    });

    return this.getContact(tenantId, contactId);
  }

  // ─── Feature 5: Distinct tags for tenant ─────────────────────────────────────

  async listDistinctTags(tenantId: string) {
    const grouped = await this.prisma.contactTag.groupBy({
      by: ['tag'],
      where: { tenantId },
      _count: { _all: true },
      orderBy: { _count: { tag: 'desc' } },
    });

    return grouped.map((g) => ({
      tag: g.tag,
      count: g._count._all,
    }));
  }

  async deleteContact(tenantId: string, contactId: string) {
    await this.findContactOrThrow(tenantId, contactId);

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // ─── Feature 4 ──────────────────────────────────────────────────────────────

  async createFromConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (conversation.contactId) {
      throw new ConflictException(
        'This conversation already has a linked contact',
      );
    }

    const phoneNumber = conversation.phoneNumber;

    const existing = await this.prisma.contact.findFirst({
      where: { tenantId, phoneNumber, deletedAt: null },
    });

    let contact;
    if (existing) {
      contact = existing;
    } else {
      contact = await this.prisma.contact.create({
        data: { tenantId, phoneNumber, name: phoneNumber },
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { contactId: contact.id },
    });

    return { ...contact, tags: [] };
  }

  // ─── Feature 3 ──────────────────────────────────────────────────────────────

  async importContacts(
    tenantId: string,
    fileBuffer: Buffer,
  ): Promise<ImportContactsResult> {
    const rows = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const result: ImportContactsResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as ImportContactRow;
      const rowNum = i + 2;

      if (!row.phoneNumber) {
        result.errors.push({ row: rowNum, reason: 'Missing phoneNumber' });
        result.skipped++;
        continue;
      }

      if (!row.name) {
        result.errors.push({ row: rowNum, reason: 'Missing name' });
        result.skipped++;
        continue;
      }

      // ── Normalise phone number ──────────────────────────────────────────────
      const phoneResult = normalisePhone(row.phoneNumber);
      if (!phoneResult.valid) {
        result.errors.push({
          row: rowNum,
          reason: `Invalid phoneNumber: ${phoneResult.reason}`,
        });
        result.skipped++;
        continue;
      }
      const phoneNumber = phoneResult.normalised;

      const tags = row.tags
        ? row.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];

      try {
        const existing = await this.prisma.contact.findFirst({
          where: { tenantId, phoneNumber },
        });

        if (existing) {
          await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              ...(row.email !== undefined && { email: row.email }),
              deletedAt: null,
            },
          });

          for (const tag of tags) {
            await this.prisma.contactTag.upsert({
              where: { contactId_tag: { contactId: existing.id, tag } },
              create: { contactId: existing.id, tenantId, tag },
              update: {},
            });
          }

          result.updated++;
        } else {
          const created = await this.prisma.contact.create({
            data: {
              tenantId,
              phoneNumber,
              name: row.name,
              ...(row.email && { email: row.email }),
              tags: tags.length
                ? { create: tags.map((tag: string) => ({ tenantId, tag })) }
                : undefined,
            },
          });

          // Same backfill as createContact — an imported contact may match
          // a conversation that already existed before the import ran.
          await this.backfillConversationLinks(
            tenantId,
            created.id,
            phoneNumber,
          );

          result.created++;
        }
      } catch (err: any) {
        result.errors.push({ row: rowNum, reason: String(err.message) });
        result.skipped++;
      }
    }

    return result;
  }
}
