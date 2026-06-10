import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EngineRegistryModule } from '../engine-registry/engine-registry.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EngineRegistryModule],
  controllers: [HealthController],
})
export class HealthModule {}
