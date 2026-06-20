import { PrismaService } from '../../prisma/prisma.service';

export interface CampaignProgress {
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
}

/**
 * Derives cumulative funnel counts for one or more campaigns directly from
 * CampaignContact.status via groupBy — never from an incremented counter
 * field, which is what caused the overshoot bug (sentCount was bumped both
 * synchronously on send AND again when the ack webhook arrived with ack=1).
 *
 * Cumulative semantics: a contact that has been READ also counts toward
 * "delivered" and "sent" (it necessarily passed through those states).
 * sentCount   = SENT + DELIVERED + READ
 * deliveredCount = DELIVERED + READ
 * readCount   = READ
 * failedCount = FAILED
 */
export async function computeCampaignProgressBatch(
  prisma: PrismaService,
  campaignIds: string[],
): Promise<Map<string, CampaignProgress>> {
  const result = new Map<string, CampaignProgress>();
  if (campaignIds.length === 0) return result;

  const grouped = await prisma.campaignContact.groupBy({
    by: ['campaignId', 'status'],
    where: { campaignId: { in: campaignIds } },
    _count: { _all: true },
  });

  const rawCounts = new Map<string, Record<string, number>>();
  for (const id of campaignIds) rawCounts.set(id, {});

  for (const row of grouped) {
    const bucket = rawCounts.get(row.campaignId) ?? {};
    bucket[row.status] = row._count._all;
    rawCounts.set(row.campaignId, bucket);
  }

  for (const id of campaignIds) {
    const counts = rawCounts.get(id) ?? {};
    const sentRaw = counts['SENT'] ?? 0;
    const deliveredRaw = counts['DELIVERED'] ?? 0;
    const readRaw = counts['READ'] ?? 0;
    const failedRaw = counts['FAILED'] ?? 0;

    result.set(id, {
      sentCount: sentRaw + deliveredRaw + readRaw,
      deliveredCount: deliveredRaw + readRaw,
      readCount: readRaw,
      failedCount: failedRaw,
    });
  }

  return result;
}

/** Single-campaign convenience wrapper around computeCampaignProgressBatch. */
export async function computeCampaignProgress(
  prisma: PrismaService,
  campaignId: string,
): Promise<CampaignProgress> {
  const map = await computeCampaignProgressBatch(prisma, [campaignId]);
  return (
    map.get(campaignId) ?? {
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    }
  );
}
