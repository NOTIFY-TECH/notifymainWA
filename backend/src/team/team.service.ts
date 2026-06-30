import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UserRole, AuditAction } from '@prisma/client';
import { Resend } from 'resend';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateMemberManagerDto } from './dto/update-member-manager.dto';

const INVITE_TTL_HOURS = 72;

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);
  private readonly resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  // ─── List team members ────────────────────────────────────────────────────

  async listMembers(tenantId: string) {
    const [members, pending] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          managerId: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: {
          tenantId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          expiresAt: true,
          invitedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { data: { members, pendingInvitations: pending } };
  }

  // ─── Invite member ────────────────────────────────────────────────────────

  async inviteMember(
    tenantId: string,
    invitedById: string,
    dto: InviteMemberDto,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists in your team.',
      );
    }

    const existingInvite = await this.prisma.invitation.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_TTL_HOURS);

    if (existingInvite) {
      if (!existingInvite.acceptedAt && existingInvite.expiresAt > new Date()) {
        throw new ConflictException(
          'An active invitation already exists for this email. Revoke it first or wait for it to expire.',
        );
      }
      await this.prisma.invitation.delete({ where: { id: existingInvite.id } });
    }

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        invitedById,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
      },
      include: {
        tenant: { select: { name: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const inviteUrl = `${this.configService.get('FRONTEND_URL')}/invite/${token}`;
    const inviterName = `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`;

    await this.sendInviteEmail(
      dto.email,
      inviterName,
      invitation.tenant.name,
      inviteUrl,
      dto.role,
    );

    this.auditLog.log({
      tenantId,
      userId: invitedById,
      action: AuditAction.CREATE,
      entityType: 'Invitation',
      entityId: invitation.id,
      after: { email: dto.email, role: dto.role },
    });

    this.logger.log(
      `Invitation sent to ${dto.email} for tenant ${tenantId} with role ${dto.role}`,
    );

    return {
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  // ─── Validate invite token (public — no auth) ─────────────────────────────

  async validateToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: { select: { id: true, name: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invitation)
      throw new NotFoundException('Invitation not found or already used.');
    if (invitation.acceptedAt)
      throw new BadRequestException(
        'This invitation has already been accepted.',
      );
    if (invitation.expiresAt < new Date())
      throw new BadRequestException(
        'This invitation has expired. Ask your admin to send a new one.',
      );

    return {
      data: {
        email: invitation.email,
        role: invitation.role,
        tenantName: invitation.tenant.name,
        inviterName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  // ─── Accept invite (public — no auth) ────────────────────────────────────

  async acceptInvite(token: string, dto: AcceptInviteDto) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invitation) throw new NotFoundException('Invitation not found.');
    if (invitation.acceptedAt)
      throw new BadRequestException(
        'This invitation has already been accepted.',
      );
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('This invitation has expired.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { user, accessToken, refreshToken } = await this.prisma.$transaction(
      async (tx) => {
        const newUser = await tx.user.create({
          data: {
            tenantId: invitation.tenantId,
            email: invitation.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: invitation.role,
            isActive: true,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        const jwtPayload = {
          sub: newUser.id,
          tenantId: newUser.tenantId,
          role: newUser.role,
        };

        const at = this.jwtService.sign(jwtPayload, {
          expiresIn: this.configService.get('JWT_EXPIRATION') ?? '15m',
        });

        const rawRefresh = randomBytes(40).toString('hex');
        const rtExpiresAt = new Date();
        rtExpiresAt.setDate(rtExpiresAt.getDate() + 7);

        await tx.refreshToken.create({
          data: {
            userId: newUser.id,
            token: rawRefresh,
            expiresAt: rtExpiresAt,
          },
        });

        return { user: newUser, accessToken: at, refreshToken: rawRefresh };
      },
    );

    // Audit — logged after transaction commits so userId exists in DB
    this.auditLog.log({
      tenantId: invitation.tenantId,
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role },
    });

    this.logger.log(
      `Invitation accepted: ${invitation.email} joined tenant ${invitation.tenantId} as ${invitation.role}`,
    );

    return {
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        tenant: {
          id: invitation.tenant.id,
          name: invitation.tenant.name,
          slug: invitation.tenant.slug,
          plan: invitation.tenant.plan,
          isActive: invitation.tenant.isActive,
          createdAt: invitation.tenant.createdAt,
        },
      },
    };
  }

  // ─── Resend invitation ────────────────────────────────────────────────────

  async resendInvite(tenantId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tenantId, acceptedAt: null },
      include: {
        tenant: { select: { name: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invitation) throw new NotFoundException('Invitation not found.');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_TTL_HOURS);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { token, expiresAt },
    });

    const inviteUrl = `${this.configService.get('FRONTEND_URL')}/invite/${token}`;
    const inviterName = `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`;
    await this.sendInviteEmail(
      invitation.email,
      inviterName,
      invitation.tenant.name,
      inviteUrl,
      invitation.role,
    );

    return { data: { message: 'Invitation resent.' } };
  }

  // ─── Revoke invitation ────────────────────────────────────────────────────

  async revokeInvite(tenantId: string, invitationId: string, actorId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    await this.prisma.invitation.delete({ where: { id: invitationId } });

    this.auditLog.log({
      tenantId,
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'Invitation',
      entityId: invitationId,
      before: { email: invitation.email, role: invitation.role },
    });

    return { data: { message: 'Invitation revoked.' } };
  }

  // ─── Update member role ───────────────────────────────────────────────────
  //
  // UPDATED (RBAC hierarchy feature) — role changes now cascade into
  // managerId cleanup so links never dangle:
  //   - If the target user IS a manager (current role MANAGER) and is being
  //     changed to anything else, every agent currently reporting to them
  //     gets auto-unassigned (managerId set to null).
  //   - If the target user currently HAS a manager (managerId set) and is
  //     being changed to a role other than AGENT, their own managerId is
  //     cleared (a non-Agent shouldn't carry a manager link).
  // Both cleanups run inside the same transaction as the role update so
  // there's no window where the data is inconsistent.
  async updateMemberRole(
    tenantId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    if (actorId === targetUserId) {
      throw new BadRequestException('You cannot change your own role.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found.');

    if (target.role === UserRole.TENANT_OWNER) {
      const ownerCount = await this.prisma.user.count({
        where: { tenantId, role: UserRole.TENANT_OWNER, deletedAt: null },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot change the role of the last owner. Assign another owner first.',
        );
      }
    }

    const roleChangingAway = target.role !== dto.role;
    const wasManager = target.role === UserRole.MANAGER;
    const newRoleIsAgent = dto.role === UserRole.AGENT;

    let unassignedAgents: { id: string; email: string }[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      // Target was a Manager and is losing that role: unassign their team.
      if (roleChangingAway && wasManager) {
        const agents = await tx.user.findMany({
          where: { tenantId, managerId: targetUserId },
          select: { id: true, email: true },
        });
        unassignedAgents = agents;

        if (agents.length > 0) {
          await tx.user.updateMany({
            where: { tenantId, managerId: targetUserId },
            data: { managerId: null },
          });
        }
      }

      const data: { role: UserRole; managerId?: null } = { role: dto.role };
      // Target is changing to a non-Agent role: clear their own manager
      // link, since only Agents are meant to carry one.
      if (roleChangingAway && !newRoleIsAgent && target.managerId) {
        data.managerId = null;
      }

      return tx.user.update({
        where: { id: targetUserId },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          managerId: true,
        },
      });
    });

    this.auditLog.log({
      tenantId,
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: targetUserId,
      before: { role: target.role },
      after: { role: dto.role },
    });

    // Side-effect audit entries — one per agent auto-unassigned as a
    // consequence of the role change above, so "why does this agent have
    // no manager?" traces back to this exact event instead of looking
    // silent in the log.
    for (const agent of unassignedAgents) {
      this.auditLog.log({
        tenantId,
        userId: actorId,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: agent.id,
        before: { managerId: targetUserId },
        after: { managerId: null },
        metadata: {
          reason: 'auto_unassigned_manager_role_change',
          formerManagerId: targetUserId,
        },
      });
    }

    return { data: updated };
  }

  // ─── Manager performance tab (NEW — RBAC hierarchy feature) ──────────────
  //
  // Manager-only, auto-scoped to the caller's own team (managerId = caller).
  // Per agent: messages sent (Message.sentByUserId), conversations handled
  // (total assigned) + resolved (status RESOLVED), and campaigns created
  // (Campaign.createdById). Response-time was explicitly descoped per
  // project decision — not included here.
  async getMyAgentsPerformance(tenantId: string, managerId: string) {
    const agents = await this.prisma.user.findMany({
      where: { tenantId, managerId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
      },
      orderBy: { firstName: 'asc' },
    });

    if (agents.length === 0) {
      return { data: [] };
    }

    const agentIds = agents.map((a) => a.id);

    const [messageCounts, conversationCounts, resolvedCounts, campaignCounts] =
      await Promise.all([
        this.prisma.message.groupBy({
          by: ['sentByUserId'],
          where: {
            tenantId,
            sentByUserId: { in: agentIds },
            direction: 'OUTBOUND',
          },
          _count: { _all: true },
        }),
        this.prisma.conversation.groupBy({
          by: ['assignedAgentId'],
          where: { tenantId, assignedAgentId: { in: agentIds } },
          _count: { _all: true },
        }),
        this.prisma.conversation.groupBy({
          by: ['assignedAgentId'],
          where: {
            tenantId,
            assignedAgentId: { in: agentIds },
            status: 'RESOLVED',
          },
          _count: { _all: true },
        }),
        this.prisma.campaign.groupBy({
          by: ['createdById'],
          where: { tenantId, createdById: { in: agentIds } },
          _count: { _all: true },
        }),
      ]);

    // groupBy returns sparse results (only agents with ≥1 row appear) — map
    // into lookups so every agent gets a 0 instead of being omitted.
    const toMap = (
      rows: { _count: { _all: number } }[],
      key: 'sentByUserId' | 'assignedAgentId' | 'createdById',
    ) => {
      const map = new Map<string, number>();
      rows.forEach((row: any) => {
        if (row[key]) map.set(row[key] as string, row._count._all);
      });
      return map;
    };

    const messagesByAgent = toMap(messageCounts, 'sentByUserId');
    const conversationsByAgent = toMap(conversationCounts, 'assignedAgentId');
    const resolvedByAgent = toMap(resolvedCounts, 'assignedAgentId');
    const campaignsByAgent = toMap(campaignCounts, 'createdById');

    const data = agents.map((agent) => ({
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      email: agent.email,
      isActive: agent.isActive,
      messagesSent: messagesByAgent.get(agent.id) ?? 0,
      conversationsHandled: conversationsByAgent.get(agent.id) ?? 0,
      conversationsResolved: resolvedByAgent.get(agent.id) ?? 0,
      campaignsCreated: campaignsByAgent.get(agent.id) ?? 0,
    }));

    return { data };
  }

  // ─── Update member's manager (NEW — RBAC hierarchy feature) ──────────────
  //
  // Admin/Owner only (enforced at controller level). Links an Agent to a
  // Manager, or unassigns with managerId: null. Both ends are re-verified
  // here even though the controller guards the actor's role, because these
  // checks are about the TARGET's and MANAGER's roles, which the role guard
  // has no visibility into.
  async setMemberManager(
    tenantId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateMemberManagerDto,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found.');

    if (target.role !== UserRole.AGENT) {
      throw new BadRequestException(
        'Only agents can be assigned to a manager.',
      );
    }

    const managerId = dto.managerId ?? null;

    if (managerId) {
      const manager = await this.prisma.user.findFirst({
        where: {
          id: managerId,
          tenantId,
          role: UserRole.MANAGER,
          deletedAt: null,
          isActive: true,
        },
      });
      if (!manager) {
        throw new BadRequestException(
          'Manager not found, inactive, or does not hold the Manager role.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { managerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        managerId: true,
      },
    });

    this.auditLog.log({
      tenantId,
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: targetUserId,
      before: { managerId: target.managerId },
      after: { managerId },
    });

    return { data: updated };
  }

  // ─── Remove member ────────────────────────────────────────────────────────

  async removeMember(tenantId: string, actorId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new BadRequestException('You cannot remove yourself.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found.');

    if (target.role === UserRole.TENANT_OWNER) {
      throw new ForbiddenException(
        'Cannot remove a tenant owner. Transfer ownership first.',
      );
    }

    // Removing a Manager: unassign their agents first so nothing dangles.
    // Decision: removal proceeds immediately (Option A) rather than being
    // blocked until the Admin manually reassigns the team — each affected
    // agent gets its own audit entry below so the unassignment is traceable.
    if (target.role === UserRole.MANAGER) {
      const agents = await this.prisma.user.findMany({
        where: { tenantId, managerId: targetUserId },
        select: { id: true, email: true },
      });

      if (agents.length > 0) {
        await this.prisma.user.updateMany({
          where: { tenantId, managerId: targetUserId },
          data: { managerId: null },
        });

        for (const agent of agents) {
          this.auditLog.log({
            tenantId,
            userId: actorId,
            action: AuditAction.UPDATE,
            entityType: 'User',
            entityId: agent.id,
            before: { managerId: targetUserId },
            after: { managerId: null },
            metadata: {
              reason: 'auto_unassigned_manager_removed',
              formerManagerId: targetUserId,
            },
          });
        }
      }
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId: targetUserId },
    });

    this.auditLog.log({
      tenantId,
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: targetUserId,
      before: { email: target.email, role: target.role },
    });

    this.logger.log(
      `Member removed: ${targetUserId} from tenant ${tenantId} by ${actorId}`,
    );
    return { data: { message: 'Member removed.' } };
  }

  // ─── Email helper ─────────────────────────────────────────────────────────

  private async sendInviteEmail(
    to: string,
    inviterName: string,
    tenantName: string,
    inviteUrl: string,
    role: UserRole,
  ) {
    const roleLabel: Record<string, string> = {
      TENANT_ADMIN: 'Admin',
      MANAGER: 'Manager',
      AGENT: 'Agent',
    };

    try {
      await this.resend.emails.send({
        from:
          this.configService.get('RESEND_FROM_EMAIL') ??
          'noreply@notifytechai.com',
        to,
        subject: `${inviterName} invited you to join ${tenantName} on NotifyTechAI`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">You've been invited</h2>
            <p style="margin: 0 0 24px; color: #555; font-size: 15px;">
              <strong>${inviterName}</strong> has invited you to join
              <strong>${tenantName}</strong> on NotifyTechAI as a
              <strong>${roleLabel[role] ?? role}</strong>.
            </p>
            <a href="${inviteUrl}"
               style="display: inline-block; background: #22C55E; color: #fff;
                      padding: 12px 28px; border-radius: 10px; text-decoration: none;
                      font-weight: 600; font-size: 15px;">
              Accept invitation
            </a>
            <p style="margin: 24px 0 0; color: #888; font-size: 13px;">
              This link expires in ${INVITE_TTL_HOURS} hours. If you weren&apos;t expecting this,
              you can safely ignore it.
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${to}:`, err);
    }
  }
}
