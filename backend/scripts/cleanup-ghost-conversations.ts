/**
 * One-time cleanup script — removes "LID directory ghost" Conversation rows.
 *
 * BUG RECAP (session 27, round 2):
 *   WhatsApp pushes LID-directory metadata for every contact in the linked
 *   device's address book via chats.set / messaging-history.set — NOT just
 *   contacts you've actually messaged. These arrive with:
 *     - empty lastMessageText
 *     - unreadCount = 0
 *     - no contactName
 *     - phoneNumber ending in @lid
 *   handleSessionChatsSynced previously created a real Conversation row for
 *   every single one of these, producing hundreds of "No messages yet"
 *   ghost entries cluttering the inbox list.
 *
 *   The webhooks.processor.ts fix (this session) stops creating NEW rows
 *   for empty-content chats going forward. This script cleans up the ones
 *   already in the database from before the fix.
 *
 * WHAT THIS SCRIPT DOES:
 *   Finds every Conversation row that:
 *     1. phoneNumber ends with '@lid'
 *     2. lastMessageText is empty
 *     3. unreadCount is 0
 *     4. contactName is null
 *     5. Has ZERO associated Message rows
 *   and deletes them.
 *
 * SAFETY:
 *   - Only targets rows with NO messages AND no contact name AND no
 *     last-message text AND zero unread — a real conversation that's gone
 *     quiet but has actual history is never touched.
 *   - Dry-run by default. Pass --confirm to actually delete.
 *
 * USAGE (from backend/ directory):
 *   npx ts-node scripts/cleanup-lid-ghost-conversations.ts            # dry run
 *   npx ts-node scripts/cleanup-lid-ghost-conversations.ts --confirm  # delete
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isConfirmed = process.argv.includes('--confirm');

  console.log(
    isConfirmed
      ? '🗑️  Running in DELETE mode — LID ghost conversations will be removed.'
      : '🔍 Running in DRY-RUN mode — no data will be deleted. Pass --confirm to delete.',
  );

  const candidates = await prisma.conversation.findMany({
    where: {
      phoneNumber: { endsWith: '@lid' },
      contactName: null,
      unreadCount: 0,
      OR: [{ lastMessageText: '' }, { lastMessageText: null }],
    },
    select: {
      id: true,
      tenantId: true,
      sessionId: true,
      phoneNumber: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });

  console.log(
    `Found ${candidates.length} candidate(s) matching the LID-ghost pattern.`,
  );

  const ghosts = candidates.filter((c) => c._count.messages === 0);
  const withMessages = candidates.filter((c) => c._count.messages > 0);

  if (withMessages.length > 0) {
    console.log(
      `⚠️  ${withMessages.length} candidate(s) match the empty-metadata pattern but DO have messages — these are NOT touched:`,
    );
    for (const c of withMessages) {
      console.log(
        `   - ${c.id} (${c.phoneNumber}) — ${c._count.messages} message(s)`,
      );
    }
  }

  console.log(
    `\n👻 ${ghosts.length} LID ghost conversation(s) identified for deletion.\n`,
  );

  if (ghosts.length > 0) {
    console.log('Sample of first 10:');
    for (const g of ghosts.slice(0, 10)) {
      console.log(
        `   - ${g.id} | ${g.phoneNumber} | created ${g.createdAt.toISOString()}`,
      );
    }
    if (ghosts.length > 10) {
      console.log(`   ... and ${ghosts.length - 10} more`);
    }
  }

  if (ghosts.length === 0) {
    console.log('\n✅ Nothing to clean up.');
    return;
  }

  if (!isConfirmed) {
    console.log(
      `\n🔍 Dry run complete. ${ghosts.length} row(s) would be deleted. Re-run with --confirm to actually delete them.`,
    );
    return;
  }

  const ids = ghosts.map((g) => g.id);
  const result = await prisma.conversation.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`\n✅ Deleted ${result.count} LID ghost conversation(s).`);
}

main()
  .catch((err) => {
    console.error('❌ Cleanup script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
