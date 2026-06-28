import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserRole, AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { SignupDto } from './dto/signup.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLog: AuditLogService,
  ) {}

  async register(tenantId: string, dto: CreateUserDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || !tenant.isActive)
      throw new NotFoundException('Tenant not found');

    const user = await this.usersService.create(
      tenantId,
      dto,
      UserRole.TENANT_ADMIN,
    );
    return this.generateTokenPair(user.id, tenantId, user.role);
  }

  async signup(dto: SignupDto) {
    const slug = dto.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.businessName,
        slug: finalSlug,
        email: dto.email,
        plan: 'BASIC',
        isActive: true,
      },
    });

    const user = await this.usersService.create(
      tenant.id,
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName ?? 'Admin',
        lastName: dto.lastName ?? 'User',
      },
      UserRole.TENANT_OWNER,
    );

    const tokens = await this.generateTokenPair(user.id, tenant.id, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
      },
      ...tokens,
    };
  }

  async globalLogin(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true, deletedAt: null },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.tenant.isActive)
      throw new UnauthorizedException('Account suspended');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    // ── Audit log: LOGIN ──────────────────────────────────────────────────
    this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    const tokens = await this.generateTokenPair(
      user.id,
      user.tenantId,
      user.role,
      userAgent,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
        isActive: user.tenant.isActive,
        createdAt: user.tenant.createdAt,
      },
      ...tokens,
    };
  }

  async login(
    tenantId: string,
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const user = await this.usersService.findByEmail(tenantId, dto.email);

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    // ── Audit log: LOGIN ──────────────────────────────────────────────────
    this.auditLog.log({
      tenantId,
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    const tokens = await this.generateTokenPair(
      user.id,
      tenantId,
      user.role,
      userAgent,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tenant: await this.getTenant(tenantId),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: { tenant: true },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const { user } = stored;
    const tokens = await this.generateTokenPair(
      user.id,
      user.tenantId,
      user.role,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
        isActive: user.tenant.isActive,
        createdAt: user.tenant.createdAt,
      },
    };
  }

  async me(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
      },
    });

    const tenant = await this.getTenant(tenantId);

    return { user, tenant };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    return { success: true };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getTenant(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  private async generateTokenPair(
    userId: string,
    tenantId: string,
    role: UserRole,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const payload = { sub: userId, tenantId, role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION') ?? '15m',
    });

    const rawRefresh = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: rawRefresh,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}
