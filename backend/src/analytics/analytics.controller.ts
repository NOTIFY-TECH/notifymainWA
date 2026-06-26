import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // GET /tenants/:tenantId/analytics/overview?period=7d
  @Get('overview')
  getOverview(
    @Param('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOverview(tenantId, query.period ?? '7d');
  }

  // GET /tenants/:tenantId/analytics/messages/timeseries?period=7d
  @Get('messages/timeseries')
  getMessageTimeSeries(
    @Param('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getMessageTimeSeries(
      tenantId,
      query.period ?? '7d',
    );
  }

  // GET /tenants/:tenantId/analytics/messages/delivery?period=7d
  @Get('messages/delivery')
  getDeliveryRates(
    @Param('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getDeliveryRates(
      tenantId,
      query.period ?? '7d',
    );
  }

  // GET /tenants/:tenantId/analytics/agents?period=7d
  @Get('agents')
  getAgentStats(
    @Param('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAgentStats(tenantId, query.period ?? '7d');
  }

  // GET /tenants/:tenantId/analytics/campaigns/:campaignId
  @Get('campaigns/:campaignId')
  getCampaignAnalytics(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.analyticsService.getCampaignAnalytics(tenantId, campaignId);
  }

  // GET /tenants/:tenantId/analytics/recent-messages?limit=10
  @Get('recent-messages')
  getRecentMessages(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)
      : 10;
    return this.analyticsService.getRecentMessages(tenantId, parsedLimit);
  }
}
