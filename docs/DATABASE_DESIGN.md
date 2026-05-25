# DATABASE DESIGN & SCHEMA

**Goal**: Design scalable PostgreSQL schema for multi-tenant WhatsApp SaaS

---

## Database Principles

- **Normalization**: Reduce redundancy, maintain referential integrity
- **Tenant Isolation**: `tenantId` on every table (except shared)
- **Audit Trail**: Track all changes with timestamps
- **Indexing**: Fast queries on frequently searched fields
- **Partitioning**: Split large tables by date or tenant for performance

---

## Core Schema

### 1. Tenants Table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  website TEXT,
  
  subscription_tier VARCHAR(50) DEFAULT 'BASIC',
  is_active BOOLEAN DEFAULT TRUE,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT check_active CHECK (is_active IN (TRUE, FALSE))
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(is_active);
CREATE INDEX idx_tenants_created ON tenants(created_at DESC);
```

### 2. Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  
  role VARCHAR(50) DEFAULT 'USER',
  is_active BOOLEAN DEFAULT TRUE,
  
  profile_picture TEXT,
  phone_number TEXT,
  
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT unique_user_per_tenant UNIQUE (tenant_id, email),
  CONSTRAINT valid_role CHECK (role IN ('SUPER_ADMIN', 'PARTNER', 'CLIENT', 'ADMIN', 'TEAM_LEADER', 'AGENT', 'USER'))
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(tenant_id, role);
CREATE INDEX idx_users_active ON users(tenant_id, is_active);
```

### 3. Sessions Table (WhatsApp Sessions)

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  session_id TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  
  status VARCHAR(50) DEFAULT 'disconnected',
  qr_code TEXT,
  
  is_authenticated BOOLEAN DEFAULT FALSE,
  last_activity_at TIMESTAMP,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT valid_status CHECK (status IN ('disconnected', 'qr_waiting', 'authenticating', 'connected'))
);

CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_user ON sessions(tenant_id, user_id);
CREATE INDEX idx_sessions_status ON sessions(tenant_id, status);
CREATE INDEX idx_sessions_authenticated ON sessions(tenant_id, is_authenticated);
```

### 4. Contacts Table

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  
  profile_picture TEXT,
  status VARCHAR(50) DEFAULT 'active',
  
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  
  last_message_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT unique_contact UNIQUE (tenant_id, phone_number)
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(tenant_id, phone_number);
CREATE INDEX idx_contacts_name ON contacts(tenant_id, name);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_created ON contacts(tenant_id, created_at DESC);
```

### 5. Conversations Table

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  contact_id UUID NOT NULL,
  session_id UUID NOT NULL,
  
  assigned_to_user_id UUID,
  
  status VARCHAR(50) DEFAULT 'open',
  subject TEXT,
  
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  
  last_message_at TIMESTAMP,
  last_updated_at TIMESTAMP,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id),
  CONSTRAINT fk_assigned_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
  CONSTRAINT valid_status CHECK (status IN ('open', 'closed', 'pending', 'resolved'))
);

CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_contact ON conversations(tenant_id, contact_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_assigned ON conversations(tenant_id, assigned_to_user_id);
CREATE INDEX idx_conversations_status ON conversations(tenant_id, status);
CREATE INDEX idx_conversations_updated ON conversations(tenant_id, last_updated_at DESC);
```

### 6. Messages Table (Partitioned by Date)

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  conversation_id UUID NOT NULL,
  sender_id UUID,
  
  message_type VARCHAR(50) DEFAULT 'text',
  content TEXT,
  
  media_url TEXT,
  media_type VARCHAR(50),
  media_size INTEGER,
  
  status VARCHAR(50) DEFAULT 'sent',
  delivery_status VARCHAR(50),
  
  is_from_contact BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  CONSTRAINT valid_type CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'template')),
  CONSTRAINT valid_status CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending'))
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE messages_2024_01 PARTITION OF messages
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_messages_conversation ON messages(tenant_id, conversation_id);
CREATE INDEX idx_messages_created ON messages(tenant_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(tenant_id, sender_id);
```

### 7. Campaigns Table

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  
  template_id UUID,
  target_list_id UUID,
  
  status VARCHAR(50) DEFAULT 'draft',
  
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'scheduled', 'executing', 'completed', 'paused', 'failed'))
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(tenant_id, scheduled_at);
CREATE INDEX idx_campaigns_created ON campaigns(tenant_id, created_at DESC);
```

### 8. Campaign Recipients Table

```sql
CREATE TABLE campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  contact_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  
  status VARCHAR(50) DEFAULT 'pending',
  
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'skipped'))
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);
```

### 9. Webhooks Table

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  url TEXT NOT NULL,
  event_types JSONB NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  secret_key TEXT NOT NULL,
  
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  last_triggered_at TIMESTAMP,
  last_error TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_active ON webhooks(tenant_id, is_active);
```

### 10. Webhook Events Table

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  
  status VARCHAR(50) DEFAULT 'pending',
  
  attempt_count INTEGER DEFAULT 0,
  
  response_status INTEGER,
  response_body TEXT,
  
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_webhook FOREIGN KEY (webhook_id) REFERENCES webhooks(id),
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'success', 'failed', 'retrying'))
);

CREATE INDEX idx_webhook_events_status ON webhook_events(webhook_id, status);
CREATE INDEX idx_webhook_events_created ON webhook_events(webhook_id, created_at DESC);
```

### 11. Subscriptions Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  plan VARCHAR(50) NOT NULL,
  
  status VARCHAR(50) DEFAULT 'active',
  
  razorpay_subscription_id TEXT UNIQUE,
  
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  
  monthly_price DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  canceled_at TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT unique_subscription UNIQUE (tenant_id),
  CONSTRAINT valid_plan CHECK (plan IN ('BASIC', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid'))
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### 12. Invoices Table

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  
  invoice_number TEXT NOT NULL UNIQUE,
  
  razorpay_invoice_id TEXT UNIQUE,
  
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  
  status VARCHAR(50) DEFAULT 'draft',
  
  issued_at TIMESTAMP NOT NULL,
  due_at TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  
  description TEXT,
  notes JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'canceled'))
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_issued ON invoices(tenant_id, issued_at DESC);
```

### 13. Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  
  description TEXT,
  
  changes JSONB DEFAULT '{}',
  
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT valid_action CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'DOWNLOAD'))
) PARTITION BY RANGE (created_at);

-- Partition by month
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(tenant_id, user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(tenant_id, created_at DESC);
```

### 14. Active Sessions Table

```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  refresh_token_hash TEXT NOT NULL UNIQUE,
  
  ip_address TEXT,
  user_agent TEXT,
  
  expires_at TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_expires ON active_sessions(expires_at);
```

---

## Key Indexing Strategy

### Performance Critical Queries

```sql
-- Messages by conversation (most frequent query)
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Unread messages for user
CREATE INDEX idx_conversations_unread ON conversations(assigned_to_user_id, unread_count) 
  WHERE unread_count > 0;

-- Active contacts
CREATE INDEX idx_contacts_last_activity ON contacts(tenant_id, last_message_at DESC);

-- Pending webhook events
CREATE INDEX idx_webhook_events_pending ON webhook_events(webhook_id, status) 
  WHERE status != 'success';
```

---

## Row-Level Security (RLS)

Enable RLS for tenant isolation:

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tenant data
CREATE POLICY user_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY contact_isolation ON contacts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set tenant context
SET app.tenant_id = 'tenant-uuid-here';
```

---

## Prisma Schema Example

**prisma/schema.prisma**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id    String  @id @default(uuid()) @db.Uuid
  name  String  @unique
  slug  String  @unique
  
  users         User[]
  sessions      Session[]
  contacts      Contact[]
  subscriptions Subscription[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  email        String
  passwordHash String
  role         String   @default("USER")
  
  tenant Tenant @relation(fields: [tenantId], references: [id])
  
  @@unique([tenantId, email])
  @@index([tenantId])
}

// ... other models following same pattern
```

---

## Backup & Recovery Strategy

### Daily Backups
```bash
# Full backup
pg_dump notifytechai > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump notifytechai | gzip > backup_$(date +%Y%m%d).sql.gz

# WAL backups for point-in-time recovery
pg_basebackup -D ./backups/base -v -P -W
```

### Retention Policy
- Daily backups: 7 days
- Weekly backups: 4 weeks  
- Monthly backups: 12 months

---

## Performance Optimization

### Connection Pooling
```
Min connections: 5
Max connections: 20 (per backend instance)
Idle timeout: 5 minutes
```

### Query Optimization
- Always use `LIMIT` for pagination
- Index foreign keys and commonly filtered fields
- Use `EXPLAIN ANALYZE` to identify slow queries
- Denormalize for analytics tables

---

## Next: Message System & Queue Architecture
