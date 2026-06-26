import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

export interface LogAuditParams {
  tenantId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget — never throws. A logging failure must never break the
  // actual operation that triggered it.
  log(params: LogAuditParams): void {
    this.prisma.auditLog
      .create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          before: (params.before ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          after: (params.after ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          metadata: (params.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      })
      .catch((err) => {
        this.logger.error('Failed to write audit log entry', err);
      });
  }

  // Paginated list — Owner + Admin only (enforced at controller level).
  async list(
    tenantId: string,
    opts: {
      page?: number;
      limit?: number;
      action?: AuditAction;
      from?: string;
      to?: string;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Parameters<typeof this.prisma.auditLog.findMany>[0]['where'] =
      { tenantId };

    if (opts.action) where.action = opts.action;
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt.gte = new Date(opts.from);
      if (opts.to) where.createdAt.lte = new Date(opts.to);
    }

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: entries,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      success: true,
    };
  }
}
