import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { RenameApiKeyDto } from './dto/rename-api-key.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('tenants/:tenantId/api-keys')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.TENANT_OWNER)
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List active API keys (owner only)' })
  list(@Param('tenantId') tenantId: string) {
    return this.apiKeysService.list(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new API key — raw key returned once' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
  ) {
    return this.apiKeysService.create(tenantId, dto, (req.user as any).userId);
  }

  @Patch(':keyId')
  @ApiOperation({ summary: 'Rename an API key (owner only)' })
  rename(
    @Param('tenantId') tenantId: string,
    @Param('keyId') keyId: string,
    @Body() dto: RenameApiKeyDto,
  ) {
    return this.apiKeysService.rename(tenantId, keyId, dto);
  }

  @Delete(':keyId')
  @ApiOperation({ summary: 'Revoke an API key (owner only)' })
  revoke(
    @Param('tenantId') tenantId: string,
    @Param('keyId') keyId: string,
    @Req() req: Request,
  ) {
    return this.apiKeysService.revoke(
      tenantId,
      keyId,
      (req.user as any).userId,
    );
  }
}
