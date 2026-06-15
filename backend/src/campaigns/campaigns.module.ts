import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignProcessor } from './campaign-processor';
import { GatewayModule } from '../gateway/gateway.module';
import { EngineRegistryModule } from '../engine-registry/engine-registry.module';

@Module({
  imports: [
    ConfigModule,
    GatewayModule,
    EngineRegistryModule,
    BullModule.registerQueue({ name: 'campaign-queue' }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignProcessor],
  exports: [CampaignsService],
})
export class CampaignsModule {}
