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
  // Uses Prisma's query builder (.count()), not raw SQL — model→table mapping
  // is handled automatically here, unaffected by the bug fixed below.

  async getOverview(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd, prevStart, prevEnd } = getPeriodWindows(period);

    const [
      // Current period message count
      currMessages,
      prevMessages,
      // Contacts created in each period
      currContacts,
      prevContacts,
      // Running totals (not period-scoped)
      totalContacts,
      activeSessions,
      activeCampaigns,
      // Delivery rate numerator/denominator in current period
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
  // FIXED: raw SQL was querying FROM "Message" (the Prisma model name).
  // The Message model maps to table "messages" via @@map("messages") in
  // schema.prisma — Postgres has no relation called "Message", only
  // "messages". This was throwing `relation "Message" does not exist` on
  // every call. Fixed by quoting the real table name.

  async getMessageTimeSeries(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd } = getPeriodWindows(period);
    const truncUnit = period === '24h' ? 'hour' : 'day';

    // Raw SQL for date_trunc grouping — Prisma groupBy doesn't support date truncation
    const rows = await this.prisma.$queryRaw<
      { date: Date; sent: bigint; delivered: bigint; failed: bigint }[]
    >(Prisma.sql`
      SELECT
        date_trunc(${truncUnit}, "createdAt") AS date,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND')                         AS sent,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND status IN ('DELIVERED','READ')) AS delivered,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND status = 'FAILED')   AS failed
      FROM "messages"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${currStart}
        AND "createdAt" <= ${currEnd}
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
  // Uses Prisma's query builder (.groupBy()), not raw SQL — unaffected.

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
  //
  // FIXED: this raw query had THREE model-name references, not one —
  // FROM "User" u, JOIN "Conversation" c, JOIN "Message" m. The boot log only
  // surfaced the "User" failure (Postgres errors on the first relation it
  // can't resolve), but Conversation and Message were equally broken and
  // would have failed next had "User" alone been fixed. All three corrected
  // to their real @@map'd table names: users, conversations, messages.

  async getAgentStats(tenantId: string, period: AnalyticsPeriod) {
    const { currStart, currEnd } = getPeriodWindows(period);

    // Conversations handled = conversations where assignedAgentId is set
    // and had at least one message in the period
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
      JOIN "conversations" c ON c."assignedAgentId" = u.id AND c."tenantId" = ${tenantId}
      JOIN "messages" m      ON m."conversationId" = c.id
                           AND m.direction = 'OUTBOUND'
                           AND m."createdAt" >= ${currStart}
                           AND m."createdAt" <= ${currEnd}
      WHERE u."tenantId" = ${tenantId}
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

  // ── 5. Campaign analytics (timeseries for a single campaign) ───────────────
  //
  // FIXED: raw SQL was querying FROM "CampaignContact" (the Prisma model
  // name). This hadn't thrown yet in the logs we'd seen — nobody had hit
  // this endpoint recently — but it was built with the exact same bug
  // pattern as the other two raw queries above and would have failed the
  // same way (`relation "CampaignContact" does not exist`) the first time it
  // ran. Fixed to the real @@map'd table name: campaign_contacts.

  async getCampaignAnalytics(tenantId: string, campaignId: string) {
    // Verify ownership
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
        COUNT(*) FILTER (WHERE cc.status != 'PENDING')                             AS sent,
        COUNT(*) FILTER (WHERE cc.status IN ('DELIVERED','READ'))                   AS delivered,
        COUNT(*) FILTER (WHERE cc.status = 'FAILED')                               AS failed
      FROM "campaign_contacts" cc
      WHERE cc."campaignId" = ${campaignId}
        AND cc."tenantId"   = ${tenantId}
        AND cc."sentAt"     IS NOT NULL
        AND cc."sentAt"     >= ${start}
        AND cc."sentAt"     <= ${end}
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
}
