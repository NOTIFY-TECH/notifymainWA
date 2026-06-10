import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { EngineInstance } from './interfaces/engine-instance.interface';
import { RegisterEngineDto } from './dto/register-engine.dto';

@Injectable()
export class EngineRegistryService implements OnModuleInit {
  private readonly logger = new Logger(EngineRegistryService.name);
  private readonly REGISTRY_PREFIX = 'engine:';
  private readonly HEARTBEAT_TTL = 90;
  private readonly SESSION_TTL = 7 * 24 * 60 * 60;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleInit() {
    this.logger.log('Engine Registry Service initialized');
  }

  async registerEngine(dto: RegisterEngineDto): Promise<EngineInstance> {
    const instance: EngineInstance = {
      instanceId: dto.instanceId,
      url: dto.url,
      maxSessions: dto.maxSessions,
      activeSessions: 0,
      lastHeartbeat: Date.now(),
      isHealthy: true,
    };

    await this.redis.setex(
      `${this.REGISTRY_PREFIX}${dto.instanceId}`,
      this.HEARTBEAT_TTL,
      JSON.stringify(instance),
    );

    this.logger.log(`Engine registered: ${dto.instanceId} at ${dto.url}`);
    return instance;
  }

  async heartbeat(instanceId: string): Promise<void> {
    const key = `${this.REGISTRY_PREFIX}${instanceId}`;
    const data = await this.redis.get(key);

    if (!data) {
      throw new NotFoundException(`Engine instance ${instanceId} not found`);
    }

    const instance: EngineInstance = JSON.parse(data);
    instance.lastHeartbeat = Date.now();
    instance.isHealthy = true;

    await this.redis.setex(key, this.HEARTBEAT_TTL, JSON.stringify(instance));
  }

  async getLeastLoadedInstance(): Promise<EngineInstance> {
    const instances = await this.getAllInstances();

    if (instances.length === 0) {
      throw new NotFoundException('No engine instances available');
    }

    const available = instances.filter(
      (i) => i.isHealthy && i.activeSessions < i.maxSessions,
    );

    if (available.length === 0) {
      throw new NotFoundException('All engine instances are at full capacity');
    }

    return available.reduce((least, current) => {
      const leastLoad = least.activeSessions / least.maxSessions;
      const currentLoad = current.activeSessions / current.maxSessions;
      return currentLoad < leastLoad ? current : least;
    });
  }

  async getInstanceForSession(sessionId: string): Promise<EngineInstance> {
    const instanceId = await this.redis.get(`session:engine:${sessionId}`);

    if (!instanceId) {
      throw new NotFoundException(`No engine found for session ${sessionId}`);
    }

    const data = await this.redis.get(`${this.REGISTRY_PREFIX}${instanceId}`);

    if (!data) {
      throw new NotFoundException(
        `Engine instance ${instanceId} is no longer available`,
      );
    }

    return JSON.parse(data);
  }

  async getInstanceById(instanceId: string): Promise<EngineInstance> {
    const data = await this.redis.get(`${this.REGISTRY_PREFIX}${instanceId}`);
    if (!data) {
      throw new NotFoundException(
        `Engine instance ${instanceId} is no longer available`,
      );
    }
    return JSON.parse(data);
  }

  async assignSessionToInstance(
    sessionId: string,
    instanceId: string,
  ): Promise<void> {
    await this.redis.setex(
      `session:engine:${sessionId}`,
      this.SESSION_TTL,
      instanceId,
    );
    await this.incrementSessionCount(instanceId);
  }

  async releaseSessionFromInstance(sessionId: string): Promise<void> {
    const instanceId = await this.redis.get(`session:engine:${sessionId}`);

    if (instanceId) {
      await this.decrementSessionCount(instanceId);
      await this.redis.del(`session:engine:${sessionId}`);
    }
  }

  async getAllInstances(): Promise<EngineInstance[]> {
    const keys = await this.redis.keys(`${this.REGISTRY_PREFIX}*`);

    if (keys.length === 0) return [];

    const values = await this.redis.mget(...keys);

    return values.filter((v) => v !== null).map((v) => JSON.parse(v));
  }

  async deregisterEngine(instanceId: string): Promise<void> {
    await this.redis.del(`${this.REGISTRY_PREFIX}${instanceId}`);
    this.logger.log(`Engine deregistered: ${instanceId}`);
  }

  private async incrementSessionCount(instanceId: string): Promise<void> {
    const key = `${this.REGISTRY_PREFIX}${instanceId}`;
    const data = await this.redis.get(key);
    if (!data) return;

    const instance: EngineInstance = JSON.parse(data);
    instance.activeSessions = Math.min(
      instance.activeSessions + 1,
      instance.maxSessions,
    );

    await this.redis.setex(key, this.HEARTBEAT_TTL, JSON.stringify(instance));
  }

  private async decrementSessionCount(instanceId: string): Promise<void> {
    const key = `${this.REGISTRY_PREFIX}${instanceId}`;
    const data = await this.redis.get(key);
    if (!data) return;

    const instance: EngineInstance = JSON.parse(data);
    instance.activeSessions = Math.max(instance.activeSessions - 1, 0);

    await this.redis.setex(key, this.HEARTBEAT_TTL, JSON.stringify(instance));
  }
}
