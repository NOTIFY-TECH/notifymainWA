import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { EngineRegistryService } from '../engine-registry/engine-registry.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engineRegistry: EngineRegistryService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — DB, Redis, and engine status' })
  async check() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEngines(),
    ]);

    const [db, redis, engines] = checks.map((c) =>
      c.status === 'fulfilled'
        ? c.value
        : {
            status: 'unhealthy',
            error: c.reason?.message,
          },
    );

    const allHealthy = [db, redis, engines].every(
      (c: any) => c.status === 'healthy',
    );

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { db, redis, engines },
    };
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy' };
  }

  private async checkRedis() {
    await this.redis.ping();
    return { status: 'healthy' };
  }

  private async checkEngines() {
    const instances = await this.engineRegistry.getAllInstances();
    return {
      status: instances.length > 0 ? 'healthy' : 'degraded',
      activeInstances: instances.length,
      instances: instances.map((i) => ({
        instanceId: i.instanceId,
        activeSessions: i.activeSessions,
        maxSessions: i.maxSessions,
        isHealthy: i.isHealthy,
      })),
    };
  }
}
