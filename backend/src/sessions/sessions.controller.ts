import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('tenants/:tenantId/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  async createSession(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionsService.createSession(tenantId, user.userId, dto);
  }

  @Get()
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  async listSessions(@Param('tenantId') tenantId: string) {
    return this.sessionsService.listSessions(tenantId);
  }

  @Get(':sessionId/qr')
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  async getQrCode(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.getQrCode(tenantId, sessionId);
  }

  @Get(':sessionId/status')
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  async getStatus(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.getSessionStatus(tenantId, sessionId);
  }

  // Reconnect using existing WhatsApp auth — no QR if auth still valid
  @Post(':sessionId/reconnect')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  async reconnectSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.reconnectSession(tenantId, sessionId);
  }

  // Unlink WhatsApp number — clears auth so next scan links a new number
  @Post(':sessionId/unlink')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  async unlinkSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.unlinkSession(tenantId, sessionId);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  async deleteSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.deleteSession(tenantId, sessionId);
  }
}
