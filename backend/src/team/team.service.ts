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
import { UserRole } from '@prisma/client';
import { Resend } from 'resend';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

// Invite tokens expire after 72 hours
const INVITE_TTL_HOURS = 72;

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);
  private readonly resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    // Check if email already has an active user in this tenant
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists in your team.',
      );
    }

    // Upsert invitation — if a prior expired invite exists for this email,
    // replace it. The @@unique([tenantId, email]) constraint means we can't
    // have two pending invites for the same email in the same tenant.
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
  //
  // Returns the same tenant shape as AuthService.login/signup
  // (id, name, slug, plan, isActive, createdAt) so the frontend never has to
  // fall back to hand-built defaults (slug: '', plan: 'BASIC', etc.) for a
  // newly-invited user's tenant. Previously `include: { tenant: { select: {
  // id: true, name: true } } }` only fetched id/name.
  //
  // NOTE: refreshToken is still returned here in the data object — the
  // controller is responsible for extracting it, setting it as the
  // `refresh_token` httpOnly cookie, and stripping it before the response
  // body reaches the client. This mirrors AuthController's pattern, where
  // AuthService also returns refreshToken in its result and the controller
  // strips it. Do not return refreshToken to the browser in the JSON body.
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

        // Generate token pair inline — can't call AuthService here to avoid
        // circular dependency; token generation is simple enough to inline.
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

    // Extend expiry and issue a fresh token
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

  async revokeInvite(tenantId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    await this.prisma.invitation.delete({ where: { id: invitationId } });
    return { data: { message: 'Invitation revoked.' } };
  }

  // ─── Update member role ───────────────────────────────────────────────────

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

    // Prevent demoting the last TENANT_OWNER
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

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
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

    // Soft delete — preserves audit trail, campaign createdBy refs etc.
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false, deletedAt: new Date() },
    });

    // Invalidate their refresh tokens immediately
    await this.prisma.refreshToken.deleteMany({
      where: { userId: targetUserId },
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
      AGENT: 'Agent',
      VIEWER: 'Viewer',
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
      // Log but don't throw — invitation row is already created. Admin can resend.
      this.logger.error(`Failed to send invite email to ${to}:`, err);
    }
  }
}
