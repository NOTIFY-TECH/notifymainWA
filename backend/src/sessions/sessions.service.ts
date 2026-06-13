import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EngineRegistryService } from '../engine-registry/engine-registry.service';
import { CreateSessionDto } from './dto/create-session.dto';
import axios from 'axios';

interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineRegistry: EngineRegistryService,
    private readonly config: ConfigService,
  ) {}

  async createSession(tenantId: string, userId: string, dto: CreateSessionDto) {
    // 1. Pick least loaded engine instance
    const engine = await this.engineRegistry.getLeastLoadedInstance();
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    // 2. Create DB record first to get the stable UUID
    const session = await this.prisma.session.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        engineInstanceId: engine.instanceId,
        status: 'INITIALIZING',
      },
    });

    // 3. Build stable openwaId using tenantId + DB UUID (no timestamp)
    const openwaId = `${tenantId}-${session.id}`;

    // 4. Forward to engine with the stable sessionId
    try {
      await axios.post(
        `${engine.url}/api/sessions`,
        { tenantId, userId, sessionId: openwaId },
        { headers: { 'X-API-Key': apiKey } },
      );
    } catch (error) {
      // Rollback DB record if engine call fails
      await this.prisma.session.delete({ where: { id: session.id } });
      this.logger.error(
        `Failed to create session on engine: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to create session on engine');
    }

    // 5. Update DB with the stable openwaId
    const updated = await this.prisma.session.update({
      where: { id: session.id },
      data: { openwaId },
    });

    // 6. Assign session to engine in Redis
    try {
      await this.engineRegistry.assignSessionToInstance(
        session.id,
        engine.instanceId,
      );
    } catch (error) {
      this.logger.error(
        `Redis assignment failed for session ${session.id}, rolling back DB record`,
      );
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new InternalServerErrorException(
        'Session created on engine but could not be registered. Please try again.',
      );
    }

    this.logger.log(
      `Session created: ${session.id} (openwaId: ${openwaId}) on engine: ${engine.instanceId}`,
    );
    return updated;
  }

  async getQrCode(tenantId: string, sessionId: string) {
    const session = await this.findSessionOrFail(tenantId, sessionId);

    if (!session.openwaId) {
      throw new BadRequestException('Session not yet initialized on engine');
    }

    const engine = await this.resolveEngine(
      sessionId,
      session.engineInstanceId,
    );
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    try {
      const response = await axios.get(
        `${engine.url}/api/sessions/${session.openwaId}/qr`,
        { headers: { 'X-API-Key': apiKey } },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get QR code: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to get QR code from engine');
    }
  }

  // Reconnect using existing auth — no QR if WhatsApp auth still valid
  async reconnectSession(tenantId: string, sessionId: string) {
    const session = await this.findSessionOrFail(tenantId, sessionId);

    if (!session.openwaId) {
      throw new BadRequestException('Session not yet initialized on engine');
    }

    const engine = await this.resolveEngine(
      sessionId,
      session.engineInstanceId,
    );
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    // First try restart (uses existing auth — no QR needed)
    try {
      await axios.post(
        `${engine.url}/api/sessions/${session.openwaId}/restart`,
        {},
        { headers: { 'X-API-Key': apiKey } },
      );
    } catch (error: any) {
      // If engine returns 404, session was lost from engine memory
      // Re-create it on the engine using the stable openwaId
      if (error?.response?.status === 404) {
        this.logger.warn(
          `Session ${session.openwaId} not found on engine — re-creating`,
        );
        try {
          await axios.post(
            `${engine.url}/api/sessions`,
            {
              tenantId,
              userId: session.createdById,
              sessionId: session.openwaId,
            },
            { headers: { 'X-API-Key': apiKey } },
          );
        } catch (createError) {
          this.logger.error(
            `Failed to re-create session on engine: ${createError instanceof Error ? createError.message : String(createError)}`,
          );
          throw new BadRequestException(
            'Failed to reconnect session on engine',
          );
        }
      } else {
        this.logger.error(
          `Failed to reconnect session: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new BadRequestException('Failed to reconnect session on engine');
      }
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'INITIALIZING' },
    });

    return { success: true, message: 'Reconnect initiated' };
  }

  // Unlink WhatsApp number — clears auth, next QR scan links a new number
  async unlinkSession(tenantId: string, sessionId: string) {
    const session = await this.findSessionOrFail(tenantId, sessionId);

    if (!session.openwaId) {
      throw new BadRequestException('Session not yet initialized on engine');
    }

    const engine = await this.resolveEngine(
      sessionId,
      session.engineInstanceId,
    );
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    try {
      await axios.post(
        `${engine.url}/api/sessions/${session.openwaId}/unlink`,
        {},
        { headers: { 'X-API-Key': apiKey } },
      );
    } catch (error) {
      this.logger.error(
        `Failed to unlink session on engine: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to unlink session on engine');
    }

    // Clear phone number and reset status in DB
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        phoneNumber: null,
        status: 'INITIALIZING',
      },
    });

    this.logger.log(`Session ${sessionId} unlinked — phone number cleared`);
    return updated;
  }

  async getSessionStatus(tenantId: string, sessionId: string) {
    const session = await this.findSessionOrFail(tenantId, sessionId);

    if (!session.openwaId) {
      return { status: session.status, dbStatus: session.status };
    }

    try {
      const engine = await this.resolveEngine(
        sessionId,
        session.engineInstanceId,
      );
      const apiKey = this.config.get<string>('OPENWA_API_KEY');

      const response = await axios.get(
        `${engine.url}/api/sessions/${session.openwaId}/status`,
        { headers: { 'X-API-Key': apiKey } },
      );
      return {
        ...response.data,
        dbStatus: session.status,
        sessionId: session.id,
      };
    } catch (error) {
      return { status: session.status, sessionId: session.id };
    }
  }

  async listSessions(tenantId: string) {
    return this.prisma.session.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
        engineInstanceId: true,
        lastSeenAt: true,
        messagesSent: true,
        createdAt: true,
      },
    });
  }

  async deleteSession(tenantId: string, sessionId: string) {
    const session = await this.findSessionOrFail(tenantId, sessionId);
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    if (session.openwaId && session.engineInstanceId) {
      try {
        const engine = await this.engineRegistry.getInstanceById(
          session.engineInstanceId,
        );
        await axios.delete(`${engine.url}/api/sessions/${session.openwaId}`, {
          headers: { 'X-API-Key': apiKey },
        });
      } catch (error) {
        this.logger.warn(
          `Could not disconnect from engine: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.engineRegistry.releaseSessionFromInstance(sessionId);
    await this.prisma.session.delete({ where: { id: sessionId } });

    return { success: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async findSessionOrFail(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return session;
  }

  private async resolveEngine(
    sessionId: string,
    fallbackInstanceId: string | null,
  ) {
    try {
      return await this.engineRegistry.getInstanceForSession(sessionId);
    } catch {
      if (!fallbackInstanceId) {
        throw new BadRequestException('Engine instance not found for session');
      }
      this.logger.warn(
        `Redis mapping missing for session ${sessionId}, falling back to DB instanceId`,
      );
      return this.engineRegistry.getInstanceById(fallbackInstanceId);
    }
  }
}
