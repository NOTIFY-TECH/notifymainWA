import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsPeriod } from './dto/analytics-query.dto';
import { Prisma } from '@prisma/client';

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodMs(period: AnalyticsPeriod): number {
  switch (period) {
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    case '90d':
      return 90 * 24 * 60 * 60 * 1000;
  }
}

function getPeriodWindows(period: AnalyticsPeriod): {
  currStart: Date;
  currEnd: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const ms = getPeriodMs(period);
  const currEnd = new Date();
  const currStart = new Date(currEnd.getTime() - ms);
  const prevEnd = new Date(currStart.getTime());
  const prevStart = new Date(prevEnd.getTime() - ms);
  return { currStart, currEnd, prevStart, prevEnd };
}

function calcDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Overview KPIs ────────────────────────────────────────────────────────
  // Uses Prisma's query builder (.count()) — timezone-safe, Prisma handles
  // Date objects correctly regardless of column storage type.

  async getOverview(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd, prevStart, prevEnd } = getPeriodWindows(period);

    const [
      currMessages,
      prevMessages,
      currContacts,
      prevContacts,
      totalContacts,
      activeSessions,
      activeCampaigns,
      outboundInPeriod,
      deliveredOrReadInPeriod,
    ] = await Promise.all([
      this.prisma.message.count({
        where: { tenantId, createdAt: { gte: currStart, lte: currEnd } },
      }),
      this.prisma.message.count({
        where: { tenantId, createdAt: { gte: prevStart, lte: prevEnd } },
      }),
      this.prisma.contact.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: currStart, lte: currEnd },
        },
      }),
      this.prisma.contact.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: prevStart, lte: prevEnd },
        },
      }),
      this.prisma.contact.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.session.count({
        where: { tenantId, status: 'CONNECTED' },
      }),
      this.prisma.campaign.count({
        where: { tenantId, status: 'RUNNING' },
      }),
      this.prisma.message.count({
        where: {
          tenantId,
          direction: 'OUTBOUND',
          createdAt: { gte: currStart, lte: currEnd },
        },
      }),
      this.prisma.message.count({
        where: {
          tenantId,
          direction: 'OUTBOUND',
          status: { in: ['DELIVERED', 'READ'] },
          createdAt: { gte: currStart, lte: currEnd },
        },
      }),
    ]);

    const deliveryRate =
      outboundInPeriod > 0
        ? Math.round((deliveredOrReadInPeriod / outboundInPeriod) * 100)
        : 0;

    return {
      data: {
        totalMessages: currMessages,
        totalContacts,
        activeSessions,
        activeCampaigns,
        messagesDelta: calcDelta(currMessages, prevMessages),
        contactsDelta: calcDelta(currContacts, prevContacts),
        deliveryRate,
      },
    };
  }

  // ── 2. Message timeseries ───────────────────────────────────────────────────
  //
  // TIMEZONE FIX: createdAt is stored as `timestamp without time zone` in
  // Postgres. JS Date objects from NestJS are UTC. Without casting, Postgres
  // compares UTC instants against naive timestamps, shifting the window by the
  // server's local offset (IST = +5:30), causing the chart to show "No data"
  // even when rows exist in the period.
  //
  // Fix: use CAST(${param} AS timestamptz) — NOT the ${param}::timestamptz
  // syntax, which does NOT work with Prisma's $queryRaw parameterised
  // placeholders. Prisma emits $1, $2 positional params; appending ::type
  // after a placeholder is invalid and the cast is silently lost.

  async getMessageTimeSeries(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd } = getPeriodWindows(period);
    // Use Prisma.raw so truncUnit is inlined as literal SQL, not a bind
    // parameter. When passed as ${truncUnit} inside Prisma.sql, Postgres
    // receives date_trunc($1, ...) and cannot match the SELECT expression
    // to the GROUP BY expression, causing error 42803.
    const truncUnit = Prisma.raw(period === '24h' ? "'hour'" : "'day'");

    const rows = await this.prisma.$queryRaw<
      { date: Date; sent: bigint; delivered: bigint; failed: bigint }[]
    >(Prisma.sql`
      SELECT
        date_trunc(${truncUnit}, "createdAt") AS date,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND')                                    AS sent,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND status IN ('DELIVERED','READ')) AS delivered,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND status = 'FAILED')              AS failed
      FROM "messages"
      WHERE "tenantId" = CAST(${tenantId} AS uuid)
        AND "createdAt" >= CAST(${currStart} AS timestamptz)
        AND "createdAt" <= CAST(${currEnd} AS timestamptz)
      GROUP BY date_trunc(${truncUnit}, "createdAt")
      ORDER BY date_trunc(${truncUnit}, "createdAt") ASC
    `);

    return {
      data: rows.map((r) => ({
        date: r.date.toISOString(),
        sent: Number(r.sent),
        delivered: Number(r.delivered),
        failed: Number(r.failed),
      })),
    };
  }

  // ── 3. Delivery rate breakdown ──────────────────────────────────────────────
  // Uses Prisma query builder — timezone-safe.

  async getDeliveryRates(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd } = getPeriodWindows(period);

    const groups = await this.prisma.message.groupBy({
      by: ['status'],
      where: {
        tenantId,
        direction: 'OUTBOUND',
        createdAt: { gte: currStart, lte: currEnd },
      },
      _count: { status: true },
    });

    const counts: Record<string, number> = {};
    for (const g of groups) {
      counts[g.status] = g._count.status;
    }

    return {
      data: {
        delivered: counts['DELIVERED'] ?? 0,
        read: counts['READ'] ?? 0,
        failed: counts['FAILED'] ?? 0,
        pending: (counts['SENT'] ?? 0) + (counts['PENDING'] ?? 0),
      },
    };
  }

  // ── 4. Agent stats ──────────────────────────────────────────────────────────
  // TIMEZONE FIX applied — CAST(... AS timestamptz) on date bounds.

  async getAgentStats(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd } = getPeriodWindows(period);

    const rows = await this.prisma.$queryRaw<
      {
        agentId: string;
        firstName: string;
        lastName: string | null;
        conversationsHandled: bigint;
        messagesReplied: bigint;
        avgResponseTimeMs: number | null;
      }[]
    >(Prisma.sql`
      SELECT
        u.id                                        AS "agentId",
        u."firstName",
        u."lastName",
        COUNT(DISTINCT c.id)                        AS "conversationsHandled",
        COUNT(m.id)                                 AS "messagesReplied",
        AVG(
          EXTRACT(EPOCH FROM (
            m."createdAt" - LAG(m."createdAt") OVER (
              PARTITION BY m."conversationId" ORDER BY m."createdAt"
            )
          )) * 1000
        )                                           AS "avgResponseTimeMs"
      FROM "users" u
      JOIN "conversations" c ON c."assignedAgentId" = u.id AND c."tenantId" = CAST(${tenantId} AS uuid)
      JOIN "messages" m      ON m."conversationId" = c.id
                           AND m.direction = 'OUTBOUND'
                           AND m."createdAt" >= CAST(${currStart} AS timestamptz)
                           AND m."createdAt" <= CAST(${currEnd} AS timestamptz)
      WHERE u."tenantId" = CAST(${tenantId} AS uuid)
      GROUP BY u.id, u."firstName", u."lastName"
      ORDER BY "messagesReplied" DESC
    `);

    return {
      data: rows.map((r) => ({
        agentId: r.agentId,
        agentName: [r.firstName, r.lastName].filter(Boolean).join(' '),
        conversationsHandled: Number(r.conversationsHandled),
        messagesReplied: Number(r.messagesReplied),
        avgResponseTimeMs: r.avgResponseTimeMs
          ? Math.round(r.avgResponseTimeMs)
          : 0,
      })),
    };
  }

  // ── 5. Campaign analytics ───────────────────────────────────────────────────
  // TIMEZONE FIX applied — CAST(... AS timestamptz) on sentAt bounds.

  async getCampaignAnalytics(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { id: true, startedAt: true, completedAt: true },
    });
    if (!campaign) {
      return { data: [] };
    }

    const start = campaign.startedAt ?? new Date(0);
    const end = campaign.completedAt ?? new Date();

    const rows = await this.prisma.$queryRaw<
      { date: Date; sent: bigint; delivered: bigint; failed: bigint }[]
    >(Prisma.sql`
      SELECT
        date_trunc('hour', cc."sentAt") AS date,
        COUNT(*) FILTER (WHERE cc.status != 'PENDING')               AS sent,
        COUNT(*) FILTER (WHERE cc.status IN ('DELIVERED','READ'))     AS delivered,
        COUNT(*) FILTER (WHERE cc.status = 'FAILED')                 AS failed
      FROM "campaign_contacts" cc
      WHERE cc."campaignId" = CAST(${campaignId} AS uuid)
        AND cc."tenantId"   = CAST(${tenantId} AS uuid)
        AND cc."sentAt"     IS NOT NULL
        AND cc."sentAt"     >= CAST(${start} AS timestamptz)
        AND cc."sentAt"     <= CAST(${end} AS timestamptz)
      GROUP BY date_trunc('hour', cc."sentAt")
      ORDER BY date_trunc('hour', cc."sentAt") ASC
    `);

    return {
      data: rows.map((r) => ({
        date: r.date.toISOString(),
        sent: Number(r.sent),
        delivered: Number(r.delivered),
        failed: Number(r.failed),
      })),
    };
  }

  // ── 6. Recent messages ──────────────────────────────────────────────────────
  // Prisma query builder only — timezone-safe, no raw SQL.
  //
  // DISPLAY NAME PRIORITY FIX (session 17 parity): contact.name (CRM name set
  // by tenant) must win over contact.whatsappName (the contact's own WA profile
  // name — may contain emoji/junk). Previous order was whatsappName first,
  // which was wrong and inconsistent with conversations.service.ts.
  // Correct priority: contact.name → contact.whatsappName → contactName → phone digits.

  async getRecentMessages(tenantId: string, limit: number = 10) {
    const messages = await this.prisma.message.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        body: true,
        direction: true,
        status: true,
        createdAt: true,
        conversation: {
          select: {
            phoneNumber: true,
            contactName: true,
            contact: {
              select: {
                name: true,
                whatsappName: true,
              },
            },
          },
        },
      },
    });

    return {
      data: messages.map((m) => {
        const conv = m.conversation;
        const displayName =
          conv?.contact?.name?.trim() ||
          conv?.contact?.whatsappName ||
          conv?.contactName ||
          conv?.phoneNumber?.split('@')[0] ||
          'Unknown';

        return {
          id: m.id,
          direction: m.direction,
          body: (m.body ?? '').slice(0, 80),
          status: m.status,
          createdAt: m.createdAt.toISOString(),
          displayName,
        };
      }),
    };
  }
}
