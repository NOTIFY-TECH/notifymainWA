import { Module } from '@nestjs/common';
import { EngineRegistryService } from './engine-registry.service';
import { EngineClientService } from './engine-client.service';
import { EngineRegistryController } from './engine-registry.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EngineRegistryController],
  providers: [EngineRegistryService, EngineClientService],
  exports: [EngineRegistryService, EngineClientService],
})
export class EngineRegistryModule {}
