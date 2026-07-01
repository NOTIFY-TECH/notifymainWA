/**
 * Seeds a dedicated dev/test tenant with one known-credential user per
 * UserRole, for internal dev team login testing only.
 *
 * Run with:  npx prisma db seed
 * (requires "prisma": { "seed": "ts-node prisma/seed.ts" } in package.json
 *  — see note at the bottom of this file if that block isn't there yet)
 *
 * Safe to re-run: all writes are upserts keyed on the [tenantId, email]
 * unique constraint on User, and on Tenant.slug.
 */

import { PrismaClient, UserRole, SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Guard: never allow this to run against production ──────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error(
    '[seed] Refusing to run: NODE_ENV=production. This seed creates known-password test accounts and must never touch a production database.',
  );
  process.exit(1);
}

const SEED_TENANT_SLUG = 'dev-test-co';
const SEED_PASSWORD = 'DevTest@123!';
const SALT_ROUNDS = 10;

interface SeedUser {
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
  /** key into the users map, used to wire managerId after creation */
  key: string;
  managerKey?: string;
}

const SEED_USERS: SeedUser[] = [
  {
    key: 'superAdmin',
    role: UserRole.SUPER_ADMIN,
    email: 'super-admin@devtest.local',
    firstName: 'Seed',
    lastName: 'SuperAdmin',
  },
  {
    key: 'owner',
    role: UserRole.TENANT_OWNER,
    email: 'owner@devtest.local',
    firstName: 'Seed',
    lastName: 'Owner',
  },
  {
    key: 'admin',
    role: UserRole.TENANT_ADMIN,
    email: 'admin@devtest.local',
    firstName: 'Seed',
    lastName: 'Admin',
  },
  {
    key: 'manager',
    role: UserRole.MANAGER,
    email: 'manager@devtest.local',
    firstName: 'Seed',
    lastName: 'Manager',
  },
  {
    key: 'agent',
    role: UserRole.AGENT,
    email: 'agent@devtest.local',
    firstName: 'Seed',
    lastName: 'Agent',
    managerKey: 'manager', // wired to the seeded Manager after creation
  },
];

async function main() {
  console.log(`[seed] Using tenant slug: ${SEED_TENANT_SLUG}`);

  const tenant = await prisma.tenant.upsert({
    where: { slug: SEED_TENANT_SLUG },
    update: {},
    create: {
      name: 'Dev Test Co',
      slug: SEED_TENANT_SLUG,
      email: 'tenant@devtest.local',
      plan: SubscriptionPlan.ENTERPRISE, // avoid plan-limit friction during testing
      isActive: true,
      maxSessions: 10,
      maxMessages: 100000,
      maxContacts: 100000,
    },
  });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const createdByKey: Record<string, string> = {}; // key -> user.id

  for (const u of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: u.email,
        },
      },
      update: {
        passwordHash,
        role: u.role,
        isActive: true,
        deletedAt: null,
      },
      create: {
        tenantId: tenant.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: true,
      },
    });
    createdByKey[u.key] = user.id;
  }

  // ── Wire Agent -> Manager linkage for testing manager-scoped features ────
  const agentSeed = SEED_USERS.find((u) => u.key === 'agent');
  if (agentSeed?.managerKey) {
    await prisma.user.update({
      where: { id: createdByKey[agentSeed.key] },
      data: { managerId: createdByKey[agentSeed.managerKey] },
    });
  }

  console.log('\n[seed] Done. Test accounts (all use the same password):\n');
  console.log(`  Password: ${SEED_PASSWORD}\n`);
  console.table(
    SEED_USERS.map((u) => ({
      role: u.role,
      email: u.email,
      tenantSlug: tenant.slug,
    })),
  );
  console.log(
    '\n[seed] Login via POST /auth/login with { tenantId or slug, email, password }, or /auth/global-login with just { email, password } depending on which endpoint your login form calls.\n',
  );
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * If `npx prisma db seed` errors with "no seed config found", add this to
 * backend/package.json (paste back the file if you want me to do this edit
 * directly instead):
 *
 *   "prisma": {
 *     "seed": "ts-node prisma/seed.ts"
 *   }
 *
 * You'll also need ts-node as a devDependency if it isn't already installed.
 */
