import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { EngineRegistryModule } from '../engine-registry/engine-registry.module';

@Module({
  imports: [ConfigModule, EngineRegistryModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
