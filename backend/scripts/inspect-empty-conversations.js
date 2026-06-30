"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const empties = await prisma.conversation.findMany({
        where: {
            messages: { none: {} },
        },
        select: {
            id: true,
            tenantId: true,
            sessionId: true,
            phoneNumber: true,
            contactName: true,
            lastMessageText: true,
            unreadCount: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    console.log(`Found ${empties.length} conversation(s) with ZERO messages.\n`);
    for (const c of empties) {
        console.log(`id=${c.id}\n` +
            `  phoneNumber     = ${c.phoneNumber}\n` +
            `  contactName     = ${c.contactName ?? '(none)'}\n` +
            `  unreadCount     = ${c.unreadCount}\n` +
            `  lastMessageText = "${(c.lastMessageText ?? '').slice(0, 60)}"\n` +
            `  sessionId       = ${c.sessionId}\n` +
            `  createdAt       = ${c.createdAt.toISOString()}\n` +
            `  updatedAt       = ${c.updatedAt.toISOString()}\n`);
    }
    const lidCount = empties.filter((c) => c.phoneNumber.endsWith('@lid')).length;
    const waCount = empties.filter((c) => c.phoneNumber.endsWith('@s.whatsapp.net')).length;
    const bareCount = empties.filter((c) => !c.phoneNumber.includes('@')).length;
    const otherCount = empties.length - lidCount - waCount - bareCount;
    console.log('── Breakdown ──');
    console.log(`@lid format:            ${lidCount}`);
    console.log(`@s.whatsapp.net format: ${waCount}`);
    console.log(`bare digits (no @):     ${bareCount}`);
    console.log(`other:                  ${otherCount}`);
}
main()
    .catch((err) => {
    console.error('❌ Inspect script failed:', err);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=inspect-empty-conversations.js.map