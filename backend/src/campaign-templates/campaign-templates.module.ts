import { Module } from '@nestjs/common';
import { CampaignTemplatesController } from './campaign-templates.controller';
import { CampaignTemplatesService } from './campaign-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CampaignTemplatesController],
  providers: [CampaignTemplatesService],
})
export class CampaignTemplatesModule {}
