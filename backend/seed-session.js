const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Upsert engine instance in DB first
  await prisma.engineInstance.upsert({
    where: { id: 'engine-1' },
    update: {},
    create: {
      id: 'engine-1',
      url: 'http://localhost:3500',
      maxSessions: 50,
      activeSessions: 0,
      isHealthy: true,
    },
  });

  const session = await prisma.session.create({
    data: {
      tenantId: '537ca651-2d01-46b1-a3a1-635ea37f3884',
      createdById: 'afc52ec6-2a6e-4a3a-b5d5-9df3482d8012',
      name: 'Test Session',
      status: 'DISCONNECTED',
      openwaId: 'test-session-1',
      engineInstanceId: 'engine-1',
    },
  });
  console.log('Created session:', session.id, '| openwaId:', session.openwaId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
