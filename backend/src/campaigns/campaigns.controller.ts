import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // GET /tenants/:tenantId/campaigns
  @Get()
  listCampaigns(
    @Param('tenantId') tenantId: string,
    @Query() query: ListCampaignsDto,
  ) {
    return this.campaignsService.listCampaigns(tenantId, query);
  }

  // POST /tenants/:tenantId/campaigns
  @Post()
  createCampaign(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateCampaignDto,
    @Req() req: any,
  ) {
    return this.campaignsService.createCampaign(tenantId, req.user.id, dto);
  }

  // GET /tenants/:tenantId/campaigns/:campaignId
  @Get(':campaignId')
  getCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.getCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/cancel
  @Post(':campaignId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.cancelCampaign(tenantId, campaignId);
  }
}
