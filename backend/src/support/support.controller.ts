import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  submitTicket(
    @Param('tenantId') tenantId: string,
    @Req() req: Request & { user: { userId: string; email: string } },
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.submitTicket(
      tenantId,
      req.user.userId,
      req.user.email,
      dto,
    );
  }
}
