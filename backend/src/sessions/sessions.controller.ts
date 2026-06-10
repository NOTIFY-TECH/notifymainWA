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
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionsService.createSession(tenantId, user.userId, dto);
  }

  @Get()
  async listSessions(@Param('tenantId') tenantId: string) {
    return this.sessionsService.listSessions(tenantId);
  }

  @Get(':sessionId/qr')
  async getQrCode(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.getQrCode(tenantId, sessionId);
  }

  @Get(':sessionId/status')
  async getStatus(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.getSessionStatus(tenantId, sessionId);
  }

  // Reconnect using existing WhatsApp auth — no QR if auth still valid
  @Post(':sessionId/reconnect')
  @HttpCode(HttpStatus.OK)
  async reconnectSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.reconnectSession(tenantId, sessionId);
  }

  // Unlink WhatsApp number — clears auth so next scan links a new number
  @Post(':sessionId/unlink')
  @HttpCode(HttpStatus.OK)
  async unlinkSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.unlinkSession(tenantId, sessionId);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.deleteSession(tenantId, sessionId);
  }
}
