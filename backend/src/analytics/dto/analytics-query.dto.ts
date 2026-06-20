import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type AnalyticsPeriod = '24h' | '7d' | '30d' | '90d';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], default: '7d' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  period?: AnalyticsPeriod = '7d';
}
