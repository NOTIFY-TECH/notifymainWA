import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EngineRegistryService } from './engine-registry.service';
import { RegisterEngineDto } from './dto/register-engine.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Engine Registry')
@Controller('engines')
export class EngineRegistryController {
  constructor(
    private readonly engineRegistryService: EngineRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterEngineDto) {
    // Reset all stale sessions for this engine to DISCONNECTED
    await this.prisma.session.updateMany({
      where: {
        engineInstanceId: dto.instanceId,
        status: { in: ['CONNECTED', 'INITIALIZING', 'QR_PENDING'] },
      },
      data: { status: 'DISCONNECTED' },
    });

    return this.engineRegistryService.registerEngine(dto);
  }

  @Post(':instanceId/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Param('instanceId') instanceId: string) {
    await this.engineRegistryService.heartbeat(instanceId);
    return { success: true, timestamp: Date.now() };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listInstances() {
    return this.engineRegistryService.getAllInstances();
  }

  @Delete(':instanceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deregister(@Param('instanceId') instanceId: string) {
    await this.engineRegistryService.deregisterEngine(instanceId);
    return { success: true };
  }
}
