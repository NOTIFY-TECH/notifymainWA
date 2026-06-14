import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListContactsDto } from './dto/list-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AddTagDto } from './dto/add-tag.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  // â”€â”€â”€ Shared: find or throw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async findContactOrThrow(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, deletedAt: null },
    });
    if (!contact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }
    return contact;
  }

  // â”€â”€â”€ Feature 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    return { ...contact, tags: contact.tags.map((t) => t.tag) };
  }

  // â”€â”€â”€ Feature 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    await this.findContactOrThrow(tenantId, contactId);

    const contact = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isBlocked !== undefined && { isBlocked: dto.isBlocked }),
        ...(dto.isOptedOut !== undefined && { isOptedOut: dto.isOptedOut }),
      },
      include: { tags: { select: { tag: true } } },
    });

    return { ...contact, tags: contact.tags.map((t) => t.tag) };
  }

  async addTag(tenantId: string, contactId: string, dto: AddTagDto) {
    await this.findContactOrThrow(tenantId, contactId);

    // Upsert â€” safe to call even if tag already exists
    await this.prisma.contactTag.upsert({
      where: {
        contactId_tag: { contactId, tag: dto.tag },
      },
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

  async deleteContact(tenantId: string, contactId: string) {
    await this.findContactOrThrow(tenantId, contactId);

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
