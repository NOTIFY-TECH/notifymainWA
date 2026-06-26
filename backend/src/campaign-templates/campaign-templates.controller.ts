import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CampaignTemplatesService } from './campaign-templates.service';
import { CreateCampaignTemplateDto } from './dto/create-campaign-template.dto';
import { UpdateCampaignTemplateDto } from './dto/update-campaign-template.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('tenants/:tenantId/campaign-templates')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CampaignTemplatesController {
  constructor(private readonly service: CampaignTemplatesService) {}

  /** Any authenticated tenant member can view templates */
  @Get()
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.service.list(tenantId);
  }

  /** Only Owner/Admin can create */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateCampaignTemplateDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  /** Only Owner/Admin can update */
  @Patch(':templateId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateCampaignTemplateDto,
  ) {
    return this.service.update(tenantId, templateId, dto);
  }

  /** Only Owner/Admin can delete */
  @Delete(':templateId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  remove(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.service.remove(tenantId, templateId);
  }
}
