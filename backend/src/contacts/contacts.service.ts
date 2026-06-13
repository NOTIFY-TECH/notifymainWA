import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListContactsDto } from './dto/list-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

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
      where.tags = {
        some: { tag: { in: tags } },
      };
    }

    // lastMessageAt is on Conversation, not Contact — handle separately if sorted by it
    const orderBy: Prisma.ContactOrderByWithRelationInput =
      sortBy === 'name'
        ? { name: sortOrder }
        : sortBy === 'createdAt'
          ? { createdAt: sortOrder }
          : { createdAt: sortOrder }; // fallback; lastMessageAt sort handled post-fetch if needed

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

    // Optional in-memory sort by lastMessageAt (small page sizes make this acceptable)
    if (sortBy === 'lastMessageAt') {
      data.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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
          ? {
              create: dto.tags.map((tag) => ({ tenantId, tag })),
            }
          : undefined,
      },
      include: {
        tags: { select: { tag: true } },
      },
    });

    return {
      ...contact,
      tags: contact.tags.map((t) => t.tag),
    };
  }
}
