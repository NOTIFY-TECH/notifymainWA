# DATABASE_DESIGN.md — PostgreSQL Schema Design
**NotifyTechAI Platform**
Last Updated: May 2026 | Status: Production-Ready

---

## Table of Contents

1. [Overview & Design Principles](#1-overview--design-principles)
2. [Complete Prisma Schema (14 Tables)](#2-complete-prisma-schema-14-tables)
3. [Raw SQL Table Definitions with Constraints](#3-raw-sql-table-definitions-with-constraints)
4. [Indexing Strategy](#4-indexing-strategy)
5. [Row-Level Security (RLS) for Tenant Isolation](#5-row-level-security-rls-for-tenant-isolation)
6. [Partitioning Strategy](#6-partitioning-strategy)
7. [Prisma Migrations](#7-prisma-migrations)
8. [Backup and Recovery Procedures](#8-backup-and-recovery-procedures)
9. [Performance Optimization](#9-performance-optimization)
10. [Seed Script](#10-seed-script)

---

## 1. Overview & Design Principles

### Database: PostgreSQL 16

### Core Principles

| Principle | Implementation |
|---|---|
| Multi-tenancy | Every table has `tenant_id`. No cross-tenant queries possible by accident. |
| Soft deletes | Most entities use `deleted_at` instead of hard DELETE |
| UUID primary keys | `gen_random_uuid()` — avoids enumeration attacks |
| Audit trail | `created_at`, `updated_at` on every table; dedicated `audit_logs` table |
| Normalization | 3NF throughout; JSON for schemaless metadata only |
| Partitioning | `messages` and `audit_logs` partitioned by month |
| RLS | PostgreSQL Row-Level Security enforced at DB layer as a second line of defense |

### Entity Relationship Overview

```
tenants (1)
  ├── users (N)           — platform users within a tenant
  │     └── refresh_tokens (N)
  ├── sessions (N)        — WhatsApp sessions (phone connections)
  ├── contacts (N)        — CRM-style contact book
  │     └── contact_tags (N)
  ├── conversations (N)   — one per (session, phone number)
  │     └── messages (N)  — individual WhatsApp messages
  ├── campaigns (N)       — bulk broadcast campaigns
  │     └── campaign_contacts (N)
  ├── api_keys (N)        — programmatic API access
  ├── webhooks (N)        — outbound event endpoints
  │     └── webhook_deliveries (N)
  └── audit_logs (N)      — immutable change log
```

---

## 2. Complete Prisma Schema (14 Tables)

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgcrypto, pg_trgm]
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum UserRole {
  SUPER_ADMIN
  TENANT_OWNER
  TENANT_ADMIN
  MANAGER
  AGENT
  VIEWER
  API_USER
}

enum SessionStatus {
  INITIALIZING
  QR_PENDING
  CONNECTED
  DISCONNECTED
  ERROR
}

enum SubscriptionPlan {
  BASIC
  GROWTH
  PROFESSIONAL
  ENTERPRISE
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  STICKER
  LOCATION
  CONTACT_CARD
  TEMPLATE
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  RUNNING
  PAUSED
  COMPLETED
  CANCELLED
}

enum CampaignContactStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
  OPTED_OUT
}

enum ConversationStatus {
  OPEN
  ASSIGNED
  RESOLVED
  SNOOZED
}

enum WebhookEvent {
  MESSAGE_INBOUND
  MESSAGE_STATUS_UPDATE
  SESSION_CONNECTED
  SESSION_DISCONNECTED
  CAMPAIGN_COMPLETED
  CONTACT_CREATED
  CONVERSATION_ASSIGNED
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  SESSION_CONNECT
  SESSION_DISCONNECT
  CAMPAIGN_START
  CAMPAIGN_STOP
  API_KEY_CREATE
  API_KEY_REVOKE
}

// ─────────────────────────────────────────
// TABLE 1: tenants
// ─────────────────────────────────────────

model Tenant {
  id               String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name             String           @db.VarChar(100)
  slug             String           @unique @db.VarChar(50)
  email            String           @unique @db.VarChar(255)
  plan             SubscriptionPlan @default(BASIC)
  isActive         Boolean          @default(true)
  maxSessions      Int              @default(1)
  maxMessages      Int              @default(1000)
  maxContacts      Int              @default(500)
  stripeCustomerId String?          @db.VarChar(100)
  metadata         Json?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  deletedAt        DateTime?

  users            User[]
  sessions         Session[]
  contacts         Contact[]
  conversations    Conversation[]
  campaigns        Campaign[]
  apiKeys          ApiKey[]
  webhooks         Webhook[]
  auditLogs        AuditLog[]

  @@index([slug])
  @@index([isActive])
  @@map("tenants")
}

// ─────────────────────────────────────────
// TABLE 2: users
// ─────────────────────────────────────────

model User {
  id               String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId         String     @db.Uuid
  email            String     @db.VarChar(255)
  passwordHash     String     @db.VarChar(255)
  firstName        String     @db.VarChar(50)
  lastName         String     @db.VarChar(50)
  role             UserRole   @default(AGENT)
  avatarUrl        String?    @db.VarChar(500)
  isActive         Boolean    @default(true)
  lastLoginAt      DateTime?
  timezone         String     @default("UTC") @db.VarChar(50)
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  deletedAt        DateTime?

  tenant           Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  refreshTokens    RefreshToken[]
  assignedConversations Conversation[] @relation("AssignedAgent")

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([tenantId, isActive])
  @@map("users")
}

// ─────────────────────────────────────────
// TABLE 3: refresh_tokens
// ─────────────────────────────────────────

model RefreshToken {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @db.Uuid
  token     String   @unique @db.VarChar(255)
  expiresAt DateTime
  userAgent String?  @db.VarChar(500)
  ipAddress String?  @db.VarChar(45)
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// ─────────────────────────────────────────
// TABLE 4: sessions (WhatsApp connections)
// ─────────────────────────────────────────

model Session {
  id            String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId      String        @db.Uuid
  name          String        @db.VarChar(100)
  phoneNumber   String?       @db.VarChar(20)
  status        SessionStatus @default(INITIALIZING)
  openwaId      String?       @unique @db.VarChar(100)
  qrCode        String?       @db.Text
  lastSeenAt    DateTime?
  messagesSent  Int           @default(0)
  metadata      Json?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  messages      Message[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@map("sessions")
}

// ─────────────────────────────────────────
// TABLE 5: contacts
// ─────────────────────────────────────────

model Contact {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId     String    @db.Uuid
  phoneNumber  String    @db.VarChar(20)
  name         String?   @db.VarChar(100)
  email        String?   @db.VarChar(255)
  avatarUrl    String?   @db.VarChar(500)
  notes        String?   @db.Text
  isBlocked    Boolean   @default(false)
  isOptedOut   Boolean   @default(false)
  metadata     Json?     // Custom fields
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tags         ContactTag[]
  conversations Conversation[]
  campaignContacts CampaignContact[]

  @@unique([tenantId, phoneNumber])
  @@index([tenantId])
  @@index([tenantId, isBlocked])
  @@map("contacts")
}

// ─────────────────────────────────────────
// TABLE 6: contact_tags
// ─────────────────────────────────────────

model ContactTag {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  contactId  String   @db.Uuid
  tenantId   String   @db.Uuid
  tag        String   @db.VarChar(50)
  createdAt  DateTime @default(now())

  contact    Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([contactId, tag])
  @@index([tenantId, tag])
  @@map("contact_tags")
}

// ─────────────────────────────────────────
// TABLE 7: conversations
// ─────────────────────────────────────────

model Conversation {
  id               String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId         String             @db.Uuid
  sessionId        String             @db.Uuid
  contactId        String?            @db.Uuid
  phoneNumber      String             @db.VarChar(20)
  status           ConversationStatus @default(OPEN)
  assignedAgentId  String?            @db.Uuid
  subject          String?            @db.VarChar(255)
  unreadCount      Int                @default(0)
  lastMessageAt    DateTime?
  lastMessageText  String?            @db.VarChar(500)
  snoozedUntil     DateTime?
  metadata         Json?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  tenant           Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  session          Session            @relation(fields: [sessionId], references: [id])
  contact          Contact?           @relation(fields: [contactId], references: [id])
  assignedAgent    User?              @relation("AssignedAgent", fields: [assignedAgentId], references: [id])
  messages         Message[]

  @@unique([tenantId, sessionId, phoneNumber])
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, assignedAgentId])
  @@index([lastMessageAt])
  @@map("conversations")
}

// ─────────────────────────────────────────
// TABLE 8: messages (partitioned by month)
// ─────────────────────────────────────────

model Message {
  id               String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId         String           @db.Uuid
  sessionId        String           @db.Uuid
  conversationId   String?          @db.Uuid
  campaignId       String?          @db.Uuid
  direction        MessageDirection
  type             MessageType      @default(TEXT)
  status           MessageStatus    @default(PENDING)
  fromNumber       String           @db.VarChar(20)
  toNumber         String           @db.VarChar(20)
  body             String?          @db.Text
  mediaUrl         String?          @db.VarChar(1000)
  mediaType        String?          @db.VarChar(50)
  caption          String?          @db.VarChar(1000)
  externalId       String?          @db.VarChar(100)   // WhatsApp message ID
  errorMessage     String?          @db.VarChar(500)
  sentAt           DateTime?
  deliveredAt      DateTime?
  readAt           DateTime?
  failedAt         DateTime?
  metadata         Json?
  createdAt        DateTime         @default(now())

  tenant           Tenant           @relation(fields: [tenantId], references: [id])
  session          Session          @relation(fields: [sessionId], references: [id])
  conversation     Conversation?    @relation(fields: [conversationId], references: [id])
  campaign         Campaign?        @relation(fields: [campaignId], references: [id])

  @@index([tenantId, createdAt])
  @@index([tenantId, conversationId])
  @@index([tenantId, campaignId])
  @@index([externalId])
  @@index([toNumber, tenantId])
  @@map("messages")
}

// ─────────────────────────────────────────
// TABLE 9: campaigns
// ─────────────────────────────────────────

model Campaign {
  id               String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId         String         @db.Uuid
  sessionId        String         @db.Uuid
  name             String         @db.VarChar(100)
  description      String?        @db.Text
  status           CampaignStatus @default(DRAFT)
  messageTemplate  String         @db.Text
  mediaUrl         String?        @db.VarChar(1000)
  scheduledAt      DateTime?
  startedAt        DateTime?
  completedAt      DateTime?
  totalContacts    Int            @default(0)
  sentCount        Int            @default(0)
  deliveredCount   Int            @default(0)
  readCount        Int            @default(0)
  failedCount      Int            @default(0)
  rateLimitPerMin  Int            @default(30)
  metadata         Json?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  tenant           Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  contacts         CampaignContact[]
  messages         Message[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([scheduledAt])
  @@map("campaigns")
}

// ─────────────────────────────────────────
// TABLE 10: campaign_contacts
// ─────────────────────────────────────────

model CampaignContact {
  id           String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaignId   String                @db.Uuid
  contactId    String?               @db.Uuid
  tenantId     String                @db.Uuid
  phoneNumber  String                @db.VarChar(20)
  status       CampaignContactStatus @default(PENDING)
  messageId    String?               @db.Uuid
  sentAt       DateTime?
  deliveredAt  DateTime?
  readAt       DateTime?
  failedAt     DateTime?
  errorMessage String?               @db.VarChar(500)
  createdAt    DateTime              @default(now())

  campaign     Campaign              @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact      Contact?              @relation(fields: [contactId], references: [id])

  @@unique([campaignId, phoneNumber])
  @@index([campaignId, status])
  @@index([tenantId])
  @@map("campaign_contacts")
}

// ─────────────────────────────────────────
// TABLE 11: api_keys
// ─────────────────────────────────────────

model ApiKey {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String    @db.Uuid
  name        String    @db.VarChar(100)
  keyHash     String    @unique @db.VarChar(255)
  keyPrefix   String    @db.VarChar(10)  // First 8 chars for display (e.g. "ntai_abc1")
  permissions Json?     // Array of allowed actions
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([keyHash])
  @@map("api_keys")
}

// ─────────────────────────────────────────
// TABLE 12: webhooks
// ─────────────────────────────────────────

model Webhook {
  id          String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String         @db.Uuid
  name        String         @db.VarChar(100)
  url         String         @db.VarChar(2000)
  events      WebhookEvent[]
  secretHash  String         @db.VarChar(255)
  isActive    Boolean        @default(true)
  failCount   Int            @default(0)
  lastTriedAt DateTime?
  lastOkAt    DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  tenant      Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  deliveries  WebhookDelivery[]

  @@index([tenantId])
  @@map("webhooks")
}

// ─────────────────────────────────────────
// TABLE 13: webhook_deliveries
// ─────────────────────────────────────────

model WebhookDelivery {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  webhookId      String   @db.Uuid
  tenantId       String   @db.Uuid
  event          WebhookEvent
  payload        Json
  statusCode     Int?
  responseBody   String?  @db.Text
  attempt        Int      @default(1)
  success        Boolean  @default(false)
  duration       Int?     // ms
  nextRetryAt    DateTime?
  createdAt      DateTime @default(now())

  webhook        Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@index([webhookId])
  @@index([tenantId, event])
  @@index([nextRetryAt])
  @@map("webhook_deliveries")
}

// ─────────────────────────────────────────
// TABLE 14: audit_logs (partitioned by month)
// ─────────────────────────────────────────

model AuditLog {
  id         String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String      @db.Uuid
  userId     String?     @db.Uuid
  action     AuditAction
  entityType String      @db.VarChar(50)
  entityId   String?     @db.Uuid
  ipAddress  String?     @db.VarChar(45)
  userAgent  String?     @db.VarChar(500)
  before     Json?       // State before change
  after      Json?       // State after change
  metadata   Json?
  createdAt  DateTime    @default(now())

  tenant     Tenant      @relation(fields: [tenantId], references: [id])

  @@index([tenantId, createdAt])
  @@index([tenantId, entityType, entityId])
  @@index([tenantId, userId])
  @@map("audit_logs")
}
```

---

## 3. Raw SQL Table Definitions with Constraints

The SQL below matches the Prisma schema and is used for manual migrations, RLS, and partitioning setup which Prisma cannot fully manage.

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search on messages

-- ─────────────────────────────────
-- tenants
-- ─────────────────────────────────
CREATE TABLE tenants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) NOT NULL,
  slug              VARCHAR(50)  NOT NULL UNIQUE,
  email             VARCHAR(255) NOT NULL UNIQUE,
  plan              VARCHAR(20)  NOT NULL DEFAULT 'BASIC'
                    CHECK (plan IN ('BASIC','GROWTH','PROFESSIONAL','ENTERPRISE')),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  max_sessions      INTEGER      NOT NULL DEFAULT 1 CHECK (max_sessions > 0),
  max_messages      INTEGER      NOT NULL DEFAULT 1000,
  max_contacts      INTEGER      NOT NULL DEFAULT 500,
  stripe_customer_id VARCHAR(100),
  metadata          JSONB,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- ─────────────────────────────────
-- users
-- ─────────────────────────────────
CREATE TABLE users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  first_name     VARCHAR(50)  NOT NULL,
  last_name      VARCHAR(50)  NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'AGENT'
                 CHECK (role IN ('SUPER_ADMIN','TENANT_OWNER','TENANT_ADMIN','MANAGER','AGENT','VIEWER','API_USER')),
  avatar_url     VARCHAR(500),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  timezone       VARCHAR(50)  NOT NULL DEFAULT 'UTC',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (tenant_id, email)
);

-- ─────────────────────────────────
-- refresh_tokens
-- ─────────────────────────────────
CREATE TABLE refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  user_agent  VARCHAR(500),
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────
-- sessions
-- ─────────────────────────────────
CREATE TABLE sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  phone_number  VARCHAR(20),
  status        VARCHAR(20)  NOT NULL DEFAULT 'INITIALIZING'
                CHECK (status IN ('INITIALIZING','QR_PENDING','CONNECTED','DISCONNECTED','ERROR')),
  openwa_id     VARCHAR(100) UNIQUE,
  qr_code       TEXT,
  last_seen_at  TIMESTAMPTZ,
  messages_sent INTEGER      NOT NULL DEFAULT 0,
  metadata      JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────
-- contacts
-- ─────────────────────────────────
CREATE TABLE contacts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number  VARCHAR(20)  NOT NULL,
  name          VARCHAR(100),
  email         VARCHAR(255),
  avatar_url    VARCHAR(500),
  notes         TEXT,
  is_blocked    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_opted_out  BOOLEAN      NOT NULL DEFAULT FALSE,
  metadata      JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (tenant_id, phone_number)
);

-- ─────────────────────────────────
-- contact_tags
-- ─────────────────────────────────
CREATE TABLE contact_tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL,
  tag         VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contact_id, tag)
);

-- ─────────────────────────────────
-- conversations
-- ─────────────────────────────────
CREATE TABLE conversations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL REFERENCES sessions(id),
  contact_id          UUID        REFERENCES contacts(id),
  phone_number        VARCHAR(20) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','ASSIGNED','RESOLVED','SNOOZED')),
  assigned_agent_id   UUID        REFERENCES users(id),
  subject             VARCHAR(255),
  unread_count        INTEGER     NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_message_at     TIMESTAMPTZ,
  last_message_text   VARCHAR(500),
  snoozed_until       TIMESTAMPTZ,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, session_id, phone_number)
);

-- ─────────────────────────────────
-- messages (will be partitioned)
-- ─────────────────────────────────
CREATE TABLE messages (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,
  session_id       UUID        NOT NULL,
  conversation_id  UUID,
  campaign_id      UUID,
  direction        VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  type             VARCHAR(20) NOT NULL DEFAULT 'TEXT'
                   CHECK (type IN ('TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT','STICKER','LOCATION','CONTACT_CARD','TEMPLATE')),
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','SENT','DELIVERED','READ','FAILED')),
  from_number      VARCHAR(20) NOT NULL,
  to_number        VARCHAR(20) NOT NULL,
  body             TEXT,
  media_url        VARCHAR(1000),
  media_type       VARCHAR(50),
  caption          VARCHAR(1000),
  external_id      VARCHAR(100),
  error_message    VARCHAR(500),
  sent_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- ─────────────────────────────────
-- campaigns
-- ─────────────────────────────────
CREATE TABLE campaigns (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id         UUID         NOT NULL REFERENCES sessions(id),
  name               VARCHAR(100) NOT NULL,
  description        TEXT,
  status             VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','CANCELLED')),
  message_template   TEXT         NOT NULL,
  media_url          VARCHAR(1000),
  scheduled_at       TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  total_contacts     INTEGER      NOT NULL DEFAULT 0,
  sent_count         INTEGER      NOT NULL DEFAULT 0,
  delivered_count    INTEGER      NOT NULL DEFAULT 0,
  read_count         INTEGER      NOT NULL DEFAULT 0,
  failed_count       INTEGER      NOT NULL DEFAULT 0,
  rate_limit_per_min INTEGER      NOT NULL DEFAULT 30 CHECK (rate_limit_per_min BETWEEN 1 AND 120),
  metadata           JSONB,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────
-- campaign_contacts
-- ─────────────────────────────────
CREATE TABLE campaign_contacts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    UUID        REFERENCES contacts(id),
  tenant_id     UUID        NOT NULL,
  phone_number  VARCHAR(20) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','SENT','DELIVERED','READ','FAILED','OPTED_OUT')),
  message_id    UUID,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,
  failed_at     TIMESTAMPTZ,
  error_message VARCHAR(500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, phone_number)
);

-- ─────────────────────────────────
-- api_keys
-- ─────────────────────────────────
CREATE TABLE api_keys (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  key_hash     VARCHAR(255) NOT NULL UNIQUE,
  key_prefix   VARCHAR(10)  NOT NULL,
  permissions  JSONB,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────
-- webhooks
-- ─────────────────────────────────
CREATE TABLE webhooks (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  url           VARCHAR(2000) NOT NULL,
  events        TEXT[]       NOT NULL DEFAULT '{}',
  secret_hash   VARCHAR(255) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  fail_count    INTEGER      NOT NULL DEFAULT 0,
  last_tried_at TIMESTAMPTZ,
  last_ok_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────
-- webhook_deliveries
-- ─────────────────────────────────
CREATE TABLE webhook_deliveries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL,
  event         VARCHAR(50) NOT NULL,
  payload       JSONB       NOT NULL,
  status_code   INTEGER,
  response_body TEXT,
  attempt       INTEGER     NOT NULL DEFAULT 1,
  success       BOOLEAN     NOT NULL DEFAULT FALSE,
  duration      INTEGER,
  next_retry_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────
-- audit_logs (will be partitioned)
-- ─────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  user_id     UUID,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(500),
  before      JSONB,
  after       JSONB,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

---

## 4. Indexing Strategy

```sql
-- ─────────────────────────────────
-- tenants
-- ─────────────────────────────────
CREATE INDEX idx_tenants_slug         ON tenants(slug);
CREATE INDEX idx_tenants_is_active    ON tenants(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────
-- users
-- ─────────────────────────────────
CREATE INDEX idx_users_tenant_id      ON users(tenant_id);
CREATE INDEX idx_users_tenant_active  ON users(tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_users_email          ON users(email);

-- ─────────────────────────────────
-- refresh_tokens
-- ─────────────────────────────────
CREATE INDEX idx_rt_user_id           ON refresh_tokens(user_id);
CREATE INDEX idx_rt_expires_at        ON refresh_tokens(expires_at);

-- ─────────────────────────────────
-- sessions
-- ─────────────────────────────────
CREATE INDEX idx_sessions_tenant_id   ON sessions(tenant_id);
CREATE INDEX idx_sessions_status      ON sessions(tenant_id, status);

-- ─────────────────────────────────
-- contacts
-- ─────────────────────────────────
CREATE INDEX idx_contacts_tenant_id   ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone       ON contacts(tenant_id, phone_number);
-- Trigram index for fuzzy name search
CREATE INDEX idx_contacts_name_trgm   ON contacts USING gin(name gin_trgm_ops);

-- ─────────────────────────────────
-- conversations
-- ─────────────────────────────────
CREATE INDEX idx_conv_tenant_id       ON conversations(tenant_id);
CREATE INDEX idx_conv_status          ON conversations(tenant_id, status);
CREATE INDEX idx_conv_agent           ON conversations(tenant_id, assigned_agent_id);
CREATE INDEX idx_conv_last_message    ON conversations(tenant_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_conv_session         ON conversations(session_id);

-- ─────────────────────────────────
-- messages (on each partition)
-- ─────────────────────────────────
-- Applied automatically via the partition template below
-- (See Section 6 for partition creation)

-- ─────────────────────────────────
-- campaigns
-- ─────────────────────────────────
CREATE INDEX idx_campaigns_tenant_id  ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status     ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_scheduled  ON campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ─────────────────────────────────
-- campaign_contacts
-- ─────────────────────────────────
CREATE INDEX idx_cc_campaign_status   ON campaign_contacts(campaign_id, status);
CREATE INDEX idx_cc_tenant_id         ON campaign_contacts(tenant_id);

-- ─────────────────────────────────
-- api_keys
-- ─────────────────────────────────
CREATE INDEX idx_api_keys_hash        ON api_keys(key_hash);
CREATE INDEX idx_api_keys_tenant      ON api_keys(tenant_id);

-- ─────────────────────────────────
-- webhooks
-- ─────────────────────────────────
CREATE INDEX idx_webhooks_tenant      ON webhooks(tenant_id);

-- ─────────────────────────────────
-- webhook_deliveries
-- ─────────────────────────────────
CREATE INDEX idx_wd_webhook_id        ON webhook_deliveries(webhook_id);
CREATE INDEX idx_wd_next_retry        ON webhook_deliveries(next_retry_at) WHERE success = FALSE;

-- ─────────────────────────────────
-- audit_logs
-- ─────────────────────────────────
-- Applied per partition (see Section 6)
```

---

## 5. Row-Level Security (RLS) for Tenant Isolation

RLS is a **second line of defense** on top of application-level tenant filtering. It prevents any accidental data leak even if the application has a bug.

```sql
-- ─────────────────────────────────────────────────────────────────
-- Setup: Create roles
-- ─────────────────────────────────────────────────────────────────

-- Application role used by NestJS/Prisma
CREATE ROLE notifytechai_app LOGIN PASSWORD 'strong_app_password';
GRANT CONNECT ON DATABASE notifytechai TO notifytechai_app;
GRANT USAGE ON SCHEMA public TO notifytechai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO notifytechai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO notifytechai_app;

-- Migration role (bypasses RLS)
CREATE ROLE notifytechai_migrator LOGIN PASSWORD 'strong_migrator_password';
GRANT ALL ON DATABASE notifytechai TO notifytechai_migrator;

-- ─────────────────────────────────────────────────────────────────
-- Enable RLS on all tenant-scoped tables
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Create RLS policies using a session variable for the current tenant
-- The application must SET app.current_tenant_id = '<uuid>' at the
-- start of each database transaction.
-- ─────────────────────────────────────────────────────────────────

-- Helper function: get current tenant from session variable
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- ─────────────────
-- users
-- ─────────────────
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- sessions
-- ─────────────────
CREATE POLICY tenant_isolation ON sessions
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- contacts
-- ─────────────────
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- contact_tags
-- ─────────────────
CREATE POLICY tenant_isolation ON contact_tags
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- conversations
-- ─────────────────
CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- messages
-- ─────────────────
CREATE POLICY tenant_isolation ON messages
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- campaigns
-- ─────────────────
CREATE POLICY tenant_isolation ON campaigns
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- campaign_contacts
-- ─────────────────
CREATE POLICY tenant_isolation ON campaign_contacts
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- api_keys
-- ─────────────────
CREATE POLICY tenant_isolation ON api_keys
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- webhooks
-- ─────────────────
CREATE POLICY tenant_isolation ON webhooks
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- webhook_deliveries
-- ─────────────────
CREATE POLICY tenant_isolation ON webhook_deliveries
  USING (tenant_id = current_tenant_id());

-- ─────────────────
-- audit_logs
-- ─────────────────
CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = current_tenant_id());
```

### Setting the Tenant Context in Prisma

Extend `PrismaService` to set `app.current_tenant_id` on every transaction:

```typescript
// src/prisma/prisma.service.ts — add this method

/**
 * Execute a callback within a tenant-scoped transaction.
 * Sets the PostgreSQL session variable used by RLS policies.
 */
async withTenant<T>(
  tenantId: string,
  callback: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>) => Promise<T>,
): Promise<T> {
  return this.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return callback(tx);
  });
}
```

Usage in a service:

```typescript
// Example: fetch conversations within a tenant-scoped transaction
async getConversations(tenantId: string) {
  return this.prisma.withTenant(tenantId, (tx) =>
    tx.conversation.findMany({
      where: { tenantId },   // Application-level filter (fast path)
      // RLS acts as a second guard
    }),
  );
}
```

---

## 6. Partitioning Strategy

### Why Partition?

`messages` and `audit_logs` will grow unbounded. A typical tenant sends 10k–100k messages/month. Without partitioning, queries slow down as the table grows to hundreds of millions of rows.

**Strategy: Range partition by `created_at` month.** Each month is a separate partition, enabling:
- Fast time-range queries (only the relevant partition is scanned)
- Easy archival (detach old partitions)
- Vacuum runs on smaller chunks

### Create Monthly Partitions

```sql
-- ─────────────────────────────────────────────
-- messages partitions
-- ─────────────────────────────────────────────

-- Current month (example: May 2026)
CREATE TABLE messages_2026_05 PARTITION OF messages
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Add indexes on each partition
CREATE INDEX idx_msg_2026_05_tenant_created ON messages_2026_05(tenant_id, created_at DESC);
CREATE INDEX idx_msg_2026_05_conversation   ON messages_2026_05(tenant_id, conversation_id);
CREATE INDEX idx_msg_2026_05_campaign       ON messages_2026_05(tenant_id, campaign_id);
CREATE INDEX idx_msg_2026_05_external       ON messages_2026_05(external_id) WHERE external_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- audit_logs partitions
-- ─────────────────────────────────────────────

CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_al_2026_05_tenant_created  ON audit_logs_2026_05(tenant_id, created_at DESC);
CREATE INDEX idx_al_2026_05_entity          ON audit_logs_2026_05(tenant_id, entity_type, entity_id);
```

### Automated Partition Creation

Create new partitions in advance with a cron job or scheduled NestJS task:

```typescript
// src/database/partition-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartitionManagerService {
  private readonly logger = new Logger(PartitionManagerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Run on the 20th of each month to create next month's partitions in advance.
   */
  @Cron('0 2 20 * *') // 02:00 on the 20th
  async createNextMonthPartitions() {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const nextNext = new Date(next);
    nextNext.setMonth(nextNext.getMonth() + 1);

    const from = `${year}-${month}-01`;
    const to   = `${nextNext.getFullYear()}-${String(nextNext.getMonth() + 1).padStart(2, '0')}-01`;
    const suffix = `${year}_${month}`;

    this.logger.log(`Creating partitions for ${suffix}`);

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS ${`messages_${suffix}`}
      PARTITION OF messages
      FOR VALUES FROM (${from}::timestamptz) TO (${to}::timestamptz)
    `;

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS ${`audit_logs_${suffix}`}
      PARTITION OF audit_logs
      FOR VALUES FROM (${from}::timestamptz) TO (${to}::timestamptz)
    `;

    this.logger.log(`Partitions created for ${suffix}`);
  }
}
```

### Archiving Old Partitions

Partitions older than 12 months can be detached (still queryable) or dropped:

```sql
-- Detach (data preserved, no longer included in queries by default)
ALTER TABLE messages DETACH PARTITION messages_2025_01;

-- Or drop entirely (irreversible — back up first)
DROP TABLE messages_2025_01;
```

---

## 7. Prisma Migrations

### Running Migrations

```bash
# Development: auto-apply + generate client
npx prisma migrate dev --name <migration_name>

# Production: apply existing migrations only (no schema changes)
npx prisma migrate deploy

# Generate Prisma client (after schema change)
npx prisma generate

# Reset database in development (drops everything)
npx prisma migrate reset

# Open Prisma Studio (GUI browser)
npx prisma studio
```

### Migration Naming Convention

```
YYYYMMDD_short_description
Examples:
  20260515_create_core_tables
  20260520_add_contact_tags
  20260525_add_messages_partition
```

### Post-Migration Script

After Prisma applies migrations, run this script to set up RLS and partitions (Prisma cannot manage these):

```bash
# scripts/post-migrate.sh
#!/bin/bash
set -e

echo "Applying RLS policies..."
psql $DATABASE_URL -f sql/rls.sql

echo "Creating initial partitions..."
psql $DATABASE_URL -f sql/partitions.sql

echo "Post-migration complete"
```

---

## 8. Backup and Recovery Procedures

### Automated Daily Backup (pg_dump)

```bash
#!/bin/bash
# scripts/backup.sh

set -e

DB_URL="${DATABASE_URL}"
BACKUP_DIR="/var/backups/notifytechai"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="notifytechai_${DATE}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: $FILENAME"

# Full backup with custom format (compressed, parallel restore)
pg_dump "$DB_URL" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_DIR}/${FILENAME}" \
  --no-owner \
  --no-acl

echo "[$(date)] Backup complete: ${BACKUP_DIR}/${FILENAME}"
echo "[$(date)] Size: $(du -sh ${BACKUP_DIR}/${FILENAME} | cut -f1)"

# Retain last 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
echo "[$(date)] Cleaned up old backups"
```

Add to crontab:

```cron
# Daily at 03:00 UTC
0 3 * * * /opt/notifytechai/scripts/backup.sh >> /var/log/notifytechai-backup.log 2>&1
```

### Upload to S3 (recommended for production)

```bash
# Append to backup.sh after pg_dump completes
aws s3 cp "${BACKUP_DIR}/${FILENAME}" \
  "s3://notifytechai-backups/daily/${FILENAME}" \
  --storage-class STANDARD_IA

echo "[$(date)] Uploaded to S3"
```

### Point-in-Time Recovery (PITR) with WAL Archiving

For production, enable WAL archiving in `postgresql.conf`:

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://notifytechai-wal/%f'
```

### Restore Procedure

```bash
# Restore from custom dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --verbose \
  --clean \
  --no-owner \
  --jobs=4 \
  notifytechai_20260501_030000.dump

# Verify restore
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM tenants;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM messages;"
```

---

## 9. Performance Optimization

### Connection Pooling with PgBouncer

```ini
# pgbouncer.ini
[databases]
notifytechai = host=localhost port=5432 dbname=notifytechai

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
pool_mode = transaction        ; Best for NestJS/Prisma
max_client_conn = 1000
default_pool_size = 20         ; Connections per database
min_pool_size = 5
reserve_pool_size = 5
```

Set your `DATABASE_URL` to point to PgBouncer:

```env
DATABASE_URL="postgresql://user:pass@localhost:6432/notifytechai"
```

### postgresql.conf Tuning (8GB RAM server)

```ini
# Memory
shared_buffers          = 2GB        # 25% of RAM
effective_cache_size    = 6GB        # 75% of RAM
work_mem                = 32MB       # Per sort/hash operation
maintenance_work_mem    = 512MB      # For VACUUM, CREATE INDEX

# WAL
wal_buffers             = 64MB
checkpoint_completion_target = 0.9
max_wal_size            = 4GB

# Query planning
random_page_cost        = 1.1        # For SSD storage
effective_io_concurrency = 200       # For SSD
default_statistics_target = 100

# Connections
max_connections         = 100        # PgBouncer handles the rest
```

### Key Query Patterns and Their Indexes

```sql
-- Pattern 1: Load team inbox (most common query)
-- Filter: tenant + status + assigned agent, order by last message
EXPLAIN ANALYZE
  SELECT * FROM conversations
  WHERE tenant_id = $1 AND status = 'OPEN'
  ORDER BY last_message_at DESC
  LIMIT 50;
-- Uses: idx_conv_last_message ✓

-- Pattern 2: Message history for a conversation
EXPLAIN ANALYZE
  SELECT * FROM messages
  WHERE tenant_id = $1 AND conversation_id = $2
  ORDER BY created_at DESC
  LIMIT 100;
-- Uses: idx_msg_YYYY_MM_conversation (partition pruning) ✓

-- Pattern 3: Campaign performance stats
EXPLAIN ANALYZE
  SELECT
    status,
    COUNT(*) as count
  FROM campaign_contacts
  WHERE campaign_id = $1
  GROUP BY status;
-- Uses: idx_cc_campaign_status ✓

-- Pattern 4: Full-text contact search
EXPLAIN ANALYZE
  SELECT * FROM contacts
  WHERE tenant_id = $1
    AND name % $2   -- pg_trgm similarity
  ORDER BY similarity(name, $2) DESC
  LIMIT 20;
-- Uses: idx_contacts_name_trgm ✓

-- Pattern 5: Audit log for compliance
EXPLAIN ANALYZE
  SELECT * FROM audit_logs
  WHERE tenant_id = $1
    AND created_at BETWEEN $2 AND $3
  ORDER BY created_at DESC;
-- Uses: idx_al_YYYY_MM_tenant_created (partition pruning) ✓
```

### VACUUM and ANALYZE Schedule

```sql
-- Run ANALYZE after large bulk inserts (e.g., campaign contact uploads)
ANALYZE campaign_contacts;

-- Tables that need frequent autovacuum tuning
ALTER TABLE messages SET (
  autovacuum_vacuum_scale_factor = 0.01,  -- Vacuum when 1% of rows are dead
  autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE conversations SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);
```

---

## 10. Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient, UserRole, SubscriptionPlan, SessionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Tenant ─────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme',
      email: 'admin@acme.com',
      plan: SubscriptionPlan.GROWTH,
      maxSessions: 5,
      maxMessages: 10000,
      maxContacts: 5000,
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // ── Tenant Owner ────────────────────────────────────
  const ownerHash = await bcrypt.hash('Password123!', 12);
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@acme.com',
      passwordHash: ownerHash,
      firstName: 'John',
      lastName: 'Owner',
      role: UserRole.TENANT_OWNER,
    },
  });
  console.log(`Owner: ${owner.email}`);

  // ── Agent ────────────────────────────────────────────
  const agentHash = await bcrypt.hash('Password123!', 12);
  const agent = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'agent@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'agent@acme.com',
      passwordHash: agentHash,
      firstName: 'Jane',
      lastName: 'Agent',
      role: UserRole.AGENT,
    },
  });
  console.log(`Agent: ${agent.email}`);

  // ── Demo Session ─────────────────────────────────────
  const session = await prisma.session.upsert({
    where: { openwaId: 'demo-session-001' },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Primary WhatsApp',
      status: SessionStatus.DISCONNECTED,
      openwaId: 'demo-session-001',
    },
  });
  console.log(`Session: ${session.name} (${session.id})`);

  // ── Sample Contacts ─────────────────────────────────
  const contacts = await Promise.all([
    prisma.contact.upsert({
      where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: '+919876543210' } },
      update: {},
      create: {
        tenantId: tenant.id,
        phoneNumber: '+919876543210',
        name: 'Ravi Kumar',
        email: 'ravi@example.com',
      },
    }),
    prisma.contact.upsert({
      where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: '+917654321098' } },
      update: {},
      create: {
        tenantId: tenant.id,
        phoneNumber: '+917654321098',
        name: 'Priya Sharma',
        email: 'priya@example.com',
      },
    }),
  ]);
  console.log(`Contacts: ${contacts.length} seeded`);

  console.log('\n✅ Seed complete!');
  console.log('─────────────────────────────────────');
  console.log('Login credentials:');
  console.log(`  Tenant slug: acme`);
  console.log(`  Owner:  owner@acme.com / Password123!`);
  console.log(`  Agent:  agent@acme.com / Password123!`);
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Run:

```bash
npx prisma db seed
```

---

## Summary

| Table | Rows (est. 1yr) | Partitioned | RLS |
|---|---|---|---|
| tenants | < 10k | No | No (SUPER_ADMIN only) |
| users | < 100k | No | Yes |
| refresh_tokens | < 500k | No | No (userId-scoped) |
| sessions | < 50k | No | Yes |
| contacts | < 10M | No | Yes |
| contact_tags | < 50M | No | Yes |
| conversations | < 5M | No | Yes |
| **messages** | **100M+** | **Yes (monthly)** | Yes |
| campaigns | < 100k | No | Yes |
| campaign_contacts | < 50M | No | Yes |
| api_keys | < 10k | No | Yes |
| webhooks | < 10k | No | Yes |
| webhook_deliveries | < 5M | No | Yes |
| **audit_logs** | **50M+** | **Yes (monthly)** | Yes |

**Next Step → MESSAGE_INBOX_CAMPAIGNS.md** for the complete messaging, inbox, and campaign implementation.
