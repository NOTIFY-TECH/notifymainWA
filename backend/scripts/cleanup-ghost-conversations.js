"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const isConfirmed = process.argv.includes('--confirm');
    console.log(isConfirmed
        ? '🗑️  Running in DELETE mode — LID ghost conversations will be removed.'
        : '🔍 Running in DRY-RUN mode — no data will be deleted. Pass --confirm to delete.');
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
    console.log(`Found ${candidates.length} candidate(s) matching the LID-ghost pattern.`);
    const ghosts = candidates.filter((c) => c._count.messages === 0);
    const withMessages = candidates.filter((c) => c._count.messages > 0);
    if (withMessages.length > 0) {
        console.log(`⚠️  ${withMessages.length} candidate(s) match the empty-metadata pattern but DO have messages — these are NOT touched:`);
        for (const c of withMessages) {
            console.log(`   - ${c.id} (${c.phoneNumber}) — ${c._count.messages} message(s)`);
        }
    }
    console.log(`\n👻 ${ghosts.length} LID ghost conversation(s) identified for deletion.\n`);
    if (ghosts.length > 0) {
        console.log('Sample of first 10:');
        for (const g of ghosts.slice(0, 10)) {
            console.log(`   - ${g.id} | ${g.phoneNumber} | created ${g.createdAt.toISOString()}`);
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
        console.log(`\n🔍 Dry run complete. ${ghosts.length} row(s) would be deleted. Re-run with --confirm to actually delete them.`);
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
//# sourceMappingURL=cleanup-ghost-conversations.js.map