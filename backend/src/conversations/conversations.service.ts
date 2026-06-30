import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List conversations ────────────────────────────────────────────────────

  async listConversations(tenantId: string, dto: ListConversationsDto) {
    const { page = 1, limit = 30, status, sessionId, search } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (sessionId) where.sessionId = sessionId;
    // Default: hide archived. Explicit ARCHIVED status filter shows only archived.
    if (status === 'ARCHIVED') {
      where.isArchived = true;
      // Do NOT set where.status — ARCHIVED is not a ConversationStatus enum value
    } else {
      where.isArchived = false;
      if (status) where.status = status; // OPEN / ASSIGNED / RESOLVED / SNOOZED only
    }
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
        // Pinned conversations float to the top (pinnedAt desc for stable ordering
        // between multiple pinned items), then the rest sorted by last activity.
        orderBy: [
          { isPinned: 'desc' },
          { pinnedAt: 'desc' },
          { lastMessageAt: 'desc' },
        ],
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

  // ── Pin conversation ──────────────────────────────────────────────────────

  async pinConversation(tenantId: string, conversationId: string) {
    // Verify the conversation belongs to this tenant
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, isPinned: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (conversation.isPinned) {
      // Already pinned — idempotent, return current state
      return { data: { success: true, isPinned: true } };
    }

    // Enforce max-3 pinned conversations per tenant
    const pinnedCount = await this.prisma.conversation.count({
      where: { tenantId, isPinned: true },
    });

    if (pinnedCount >= 3) {
      throw new BadRequestException(
        'You can pin a maximum of 3 conversations. Unpin one before pinning another.',
      );
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { isPinned: true, pinnedAt: new Date() },
    });

    this.logger.log(
      `Pinned conversation ${conversationId} for tenant ${tenantId}`,
    );
    return { data: { success: true, isPinned: true } };
  }

  // ── Unpin conversation ────────────────────────────────────────────────────

  async unpinConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, isPinned: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (!conversation.isPinned) {
      // Already unpinned — idempotent
      return { data: { success: true, isPinned: false } };
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { isPinned: false, pinnedAt: null },
    });

    this.logger.log(
      `Unpinned conversation ${conversationId} for tenant ${tenantId}`,
    );
    return { data: { success: true, isPinned: false } };
  }

  // ── Archive conversation ──────────────────────────────────────────────────

  async archiveConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, isArchived: true, isPinned: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (conversation.isArchived) {
      return { data: { success: true, isArchived: true } };
    }

    // Unpin on archive if currently pinned
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isArchived: true,
        ...(conversation.isPinned ? { isPinned: false, pinnedAt: null } : {}),
      },
    });

    this.logger.log(
      `Archived conversation ${conversationId} for tenant ${tenantId}`,
    );
    return { data: { success: true, isArchived: true } };
  }

  // ── Unarchive conversation ────────────────────────────────────────────────

  async unarchiveConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, isArchived: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (!conversation.isArchived) {
      return { data: { success: true, isArchived: false } };
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { isArchived: false },
    });

    this.logger.log(
      `Unarchived conversation ${conversationId} for tenant ${tenantId}`,
    );
    return { data: { success: true, isArchived: false } };
  }

  // ── Assign / unassign conversation ────────────────────────────────────────
  // Session 27: backs the new Inbox — assign conversations permission row
  // (Owner/Admin only — enforced in the controller via @Roles, not here).
  // Passing userId: null (or omitting it) unassigns the conversation.
  //
  // UPDATED (RBAC hierarchy feature) — MANAGER can now call this too, but
  // ONLY within their own team. `actor` is passed in so this method can
  // apply that extra restriction; Owner/Admin callers are unrestricted as
  // before (the actor.role === MANAGER branch below simply never fires
  // for them).
  //
  // Allowed states for a Manager: the conversation may currently be
  // unassigned, assigned to the Manager themselves, or assigned to one of
  // their own agents — and it may only be assigned TO one of their own
  // agents (never to themselves via this endpoint, never to another
  // Manager's agent, never to an Admin/Owner).

  async assignConversation(
    tenantId: string,
    conversationId: string,
    dto: AssignConversationDto,
    actor: { id: string; role: UserRole },
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
        assignedAgent: { select: { id: true, managerId: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const userId = dto.userId ?? null;

    let assignee: {
      id: string;
      role: UserRole;
      managerId: string | null;
    } | null = null;

    if (userId) {
      // The assignee must belong to the same tenant and be active.
      assignee = await this.prisma.user.findFirst({
        where: { id: userId, tenantId, isActive: true },
        select: { id: true, role: true, managerId: true },
      });

      if (!assignee) {
        throw new BadRequestException(
          'Assignee must be an active member of this tenant.',
        );
      }
    }

    if (actor.role === UserRole.MANAGER) {
      // Destination check: assigning TO someone must be one of the
      // Manager's own agents.
      if (userId) {
        if (
          assignee?.role !== UserRole.AGENT ||
          assignee.managerId !== actor.id
        ) {
          throw new ForbiddenException(
            'Managers can only assign conversations to agents on their own team.',
          );
        }
      } else {
        // Source check: unassigning is only allowed if the conversation is
        // currently assigned to the Manager themselves or to one of their
        // own agents — prevents a Manager from unassigning a conversation
        // that belongs to someone outside their team.
        const currentAssigneeId = conversation.assignedAgentId;
        const currentAssigneeIsSelf = currentAssigneeId === actor.id;
        const currentAssigneeIsOwnAgent =
          conversation.assignedAgent?.managerId === actor.id;

        if (
          currentAssigneeId &&
          !currentAssigneeIsSelf &&
          !currentAssigneeIsOwnAgent
        ) {
          throw new ForbiddenException(
            'Managers can only reassign conversations within their own team.',
          );
        }
      }
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedAgentId: userId,
        // Mirror WhatsApp-Business-style status semantics: assigning moves an
        // OPEN conversation to ASSIGNED; unassigning moves ASSIGNED back to
        // OPEN. Conversations already RESOLVED/SNOOZED keep that status —
        // assignment shouldn't silently reopen something the team closed.
        ...(userId
          ? conversation.status === 'OPEN'
            ? { status: 'ASSIGNED' as const }
            : {}
          : conversation.status === 'ASSIGNED'
            ? { status: 'OPEN' as const }
            : {}),
      },
      include: {
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

    this.logger.log(
      userId
        ? `Assigned conversation ${conversationId} to user ${userId} for tenant ${tenantId}`
        : `Unassigned conversation ${conversationId} for tenant ${tenantId}`,
    );

    return { data: updated };
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
        reactions: true,
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
