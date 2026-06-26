import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListConversationsDto } from './dto/list-conversations.dto';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List conversations ────────────────────────────────────────────────────

  async listConversations(tenantId: string, dto: ListConversationsDto) {
    const { page = 1, limit = 30, status, sessionId, search } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (sessionId) where.sessionId = sessionId;
    if (search) {
      where.OR = [
        { phoneNumber: { contains: search } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { lastMessageText: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              whatsappName: true,
              avatarUrl: true,
            },
          },
          session: {
            select: { id: true, name: true, phoneNumber: true },
          },
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Normalise display name server-side so the frontend never has to reason
    // about JIDs. Resolution priority:
    //   1. contact.name          — matched Contact row, CRM name set by tenant
    //      (always wins when present — this is what the tenant deliberately saved,
    //      and must NOT be overridden by whatever the recipient set as their own
    //      WhatsApp display name, which may contain emoji/junk/a different name)
    //   2. contact.whatsappName  — matched Contact row, name from WA profile
    //      (fallback only when tenant hasn't set a CRM name for this contact)
    //   3. conversation.contactName — pushName stored passively on inbound
    //      (primary source for @lid chats where no Contact row exists)
    //   4. phoneNumber           — raw JID / digits, always present
    const data = conversations.map((conv) => ({
      ...conv,
      contactName:
        conv.contact?.name?.trim() ||
        conv.contact?.whatsappName?.trim() ||
        conv.contactName?.trim() ||
        (conv.phoneNumber.includes('@')
          ? conv.phoneNumber.split('@')[0]
          : conv.phoneNumber),
    }));

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

  // ── Get single conversation ───────────────────────────────────────────────

  async getConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            whatsappName: true,
            avatarUrl: true,
            phoneNumber: true,
            email: true,
          },
        },
        session: {
          select: { id: true, name: true, phoneNumber: true, status: true },
        },
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // Same resolution priority as listConversations — normalise contactName
    // so ThreadView always gets a human-readable name, never a raw JID, and
    // never overridden by a WhatsApp-side display name when a CRM name exists.
    const contactName =
      conversation.contact?.name?.trim() ||
      conversation.contact?.whatsappName?.trim() ||
      conversation.contactName?.trim() ||
      (conversation.phoneNumber.includes('@')
        ? conversation.phoneNumber.split('@')[0]
        : conversation.phoneNumber);

    return { data: { ...conversation, contactName } };
  }

  // ── Get messages for a conversation ──────────────────────────────────────

  async getMessages(
    tenantId: string,
    conversationId: string,
    limit = 30,
    before?: string,
  ) {
    // Verify conversation belongs to tenant
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const where: any = { tenantId, conversationId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        direction: true,
        type: true,
        body: true,
        mediaUrl: true,
        mediaType: true,
        caption: true,
        status: true,
        fromNumber: true,
        toNumber: true,
        externalId: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true,
        tenantId: true,
        sessionId: true,
      },
    });

    // Return in ascending order for rendering (oldest first)
    const ordered = [...messages].reverse();
    const nextCursor =
      messages.length === limit
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    return {
      data: ordered,
      meta: {
        limit,
        nextCursor,
        hasMore: messages.length === limit,
      },
    };
  }

  // ── Mark conversation as read ─────────────────────────────────────────────

  async markAsRead(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // Mark all inbound unread messages as READ
    await this.prisma.message.updateMany({
      where: {
        tenantId,
        conversationId,
        direction: 'INBOUND',
        status: { not: 'READ' },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    // Reset unread count
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    this.logger.log(`Marked conversation ${conversationId} as read`);
    return { data: { success: true } };
  }
}
