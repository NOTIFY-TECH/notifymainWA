import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { RenameApiKeyDto } from './dto/rename-api-key.dto';
import { randomBytes, createHash } from 'crypto';
import { AuditAction } from '@prisma/client';

const KEY_PREFIX_LEN = 12;

function generateRawKey(): string {
  return 'ntfy_' + randomBytes(24).toString('hex');
}

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async list(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: keys, success: true };
  }

  async create(tenantId: string, dto: CreateApiKeyDto, actorId: string) {
    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, KEY_PREFIX_LEN);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyHash,
        keyPrefix,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    this.auditLog.log({
      tenantId,
      userId: actorId,
      action: AuditAction.API_KEY_CREATE,
      entityType: 'ApiKey',
      entityId: apiKey.id,
      after: { name: apiKey.name, keyPrefix: apiKey.keyPrefix },
    });

    return { data: { ...apiKey, rawKey }, success: true };
  }

  async rename(tenantId: string, keyId: string, dto: RenameApiKeyDto) {
    await this.findActiveOrThrow(tenantId, keyId);

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { name: dto.name },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return { data: updated, success: true };
  }

  async revoke(tenantId: string, keyId: string, actorId: string) {
    const key = await this.findActiveOrThrow(tenantId, keyId);

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    this.auditLog.log({
      tenantId,
      userId: actorId,
      action: AuditAction.API_KEY_REVOKE,
      entityType: 'ApiKey',
      entityId: keyId,
      before: { name: key.name, keyPrefix: key.keyPrefix },
    });

    return { data: { message: 'API key revoked.' }, success: true };
  }

  private async findActiveOrThrow(tenantId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, tenantId, isActive: true },
    });
    if (!key) throw new NotFoundException('API key not found');
    return key;
  }
}
