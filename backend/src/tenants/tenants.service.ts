import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';

// Email-change verification links expire after 72 hours — matches
// TeamService's INVITE_TTL_HOURS for consistency. Flag if this should be
// shorter given email-change is a more sensitive action than a team invite.
const EMAIL_VERIFY_TTL_HOURS = 72;

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly resend: Resend;

  constructor(
    private prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(dto: CreateTenantDto) {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug }, { email: dto.email }] },
    });

    if (existing) {
      throw new ConflictException(
        'Tenant with this slug or email already exists',
      );
    }

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        email: dto.email,
        slug,
      },
    });
  }

  // FIXED (10D, session 8 follow-up): findById had no `select`, so the
  // full Prisma row — including emailVerifyToken — was returned to ANY
  // authenticated tenant member (this route has no @Roles() restriction).
  // That would let a non-owner read the live token and complete an
  // in-flight email-change verification themselves. emailVerifyToken is
  // now excluded; pendingEmail/emailVerifyExpiresAt are still returned
  // since the frontend needs them to show the "verification pending"
  // banner, and neither is sensitive on its own.
  //
  // FIXED (10D, session 9): return value now wrapped as { data, success }
  // to match the ApiResponse<TenantProfile> shape the frontend expects.
  // Previously returned the raw Prisma object, causing useTenantProfile's
  // `select: data => data.data` to always yield undefined → infinite spinner.
  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        pendingEmail: true,
        emailVerifyExpiresAt: true,
        plan: true,
        isActive: true,
        maxSessions: true,
        maxMessages: true,
        maxContacts: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return { data: tenant, success: true };
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  // UPDATED (10D, session 8) — name applies immediately. email no longer
  // writes to tenant.email directly: it's staged on pendingEmail behind a
  // verification token, mirroring the Invitation token/expiresAt pattern.
  // tenant.email only changes once verifyEmail() confirms the token.
  async updateProfile(tenantId: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    let verificationSent = false;

    if (dto.email !== undefined && dto.email !== tenant.email) {
      // Same uniqueness check pattern as create() — email is @unique on
      // Tenant, so reject before Prisma throws a raw constraint error.
      const existing = await this.prisma.tenant.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          'Another tenant already uses this email address',
        );
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFY_TTL_HOURS);

      data.pendingEmail = dto.email;
      data.emailVerifyToken = token;
      data.emailVerifyExpiresAt = expiresAt;

      await this.sendVerificationEmail(dto.email, tenant.name, token);
      verificationSent = true;
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    return { data: updated, verificationSent };
  }

  // NEW (10D, session 8) — public, no guard. Token is the auth: it's a
  // 32-byte random value sent only to the new email address, same trust
  // model as Invitation.token. Looked up directly since emailVerifyToken
  // is @unique, no tenantId needed to scope the lookup.
  async verifyEmail(token: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { emailVerifyToken: token },
    });

    if (!tenant) {
      throw new NotFoundException(
        'Verification link not found or already used.',
      );
    }
    if (!tenant.pendingEmail || !tenant.emailVerifyExpiresAt) {
      throw new BadRequestException('No pending email change for this link.');
    }
    if (tenant.emailVerifyExpiresAt < new Date()) {
      throw new BadRequestException(
        'This verification link has expired. Request a new one from Settings.',
      );
    }

    // Re-check uniqueness — someone else could have claimed pendingEmail
    // between the request and the click.
    const conflict = await this.prisma.tenant.findFirst({
      where: { email: tenant.pendingEmail, id: { not: tenant.id } },
    });
    if (conflict) {
      throw new ConflictException(
        'Another tenant has since claimed this email address. Start the change again with a different address.',
      );
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        email: tenant.pendingEmail,
        pendingEmail: null,
        emailVerifyToken: null,
        emailVerifyExpiresAt: null,
      },
    });

    this.logger.log(`Tenant ${tenant.id} verified new email: ${updated.email}`);
    return { data: { message: 'Email verified.', email: updated.email } };
  }

  // NEW (10D, session 8) — re-issue a fresh token/expiry and resend, same
  // shape as TeamService.resendInvite(). Requires an existing pending
  // change; doesn't accept a new email here (use updateProfile for that).
  async resendVerification(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.pendingEmail) {
      throw new BadRequestException('No pending email change to resend.');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFY_TTL_HOURS);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { emailVerifyToken: token, emailVerifyExpiresAt: expiresAt },
    });

    await this.sendVerificationEmail(tenant.pendingEmail, tenant.name, token);
    return { data: { message: 'Verification email resent.' } };
  }

  // ─── Email helper ─────────────────────────────────────────────────────────

  private async sendVerificationEmail(
    to: string,
    tenantName: string,
    token: string,
  ) {
    const verifyUrl = `${this.configService.get('FRONTEND_URL')}/settings/verify-email/${token}`;

    try {
      await this.resend.emails.send({
        from:
          this.configService.get('RESEND_FROM_EMAIL') ??
          'noreply@notifytechai.com',
        to,
        subject: `Confirm your new email for ${tenantName} on NotifyTechAI`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Confirm your new email</h2>
            <p style="margin: 0 0 24px; color: #555; font-size: 15px;">
              A request was made to change the contact email for
              <strong>${tenantName}</strong> on NotifyTechAI to this address.
              Click below to confirm the change.
            </p>
            <a href="${verifyUrl}"
               style="display: inline-block; background: #22C55E; color: #fff;
                      padding: 12px 28px; border-radius: 10px; text-decoration: none;
                      font-weight: 600; font-size: 15px;">
              Confirm email
            </a>
            <p style="margin: 24px 0 0; color: #888; font-size: 13px;">
              This link expires in ${EMAIL_VERIFY_TTL_HOURS} hours. If you didn&apos;t request this change,
              you can safely ignore it — your email will not change.
            </p>
          </div>
        `,
      });
    } catch (err) {
      // Log but don't throw — pendingEmail/token row is already saved.
      // Owner can use resend-verification to retry.
      this.logger.error(`Failed to send verification email to ${to}:`, err);
    }
  }
}
