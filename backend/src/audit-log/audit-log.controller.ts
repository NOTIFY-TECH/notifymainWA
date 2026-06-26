import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';

class AuditLogQueryDto {
  page?: number;
  limit?: number;
  action?: AuditAction;
  from?: string;
  to?: string;
}

@ApiTags('Audit Log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
@Controller('tenants/:tenantId/audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Param('tenantId') tenantId: string, @Query() query: AuditLogQueryDto) {
    return this.auditLogService.list(tenantId, {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      action: query.action,
      from: query.from,
      to: query.to,
    });
  }
}
