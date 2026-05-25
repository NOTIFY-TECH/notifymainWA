# OpenWA Integration Rules for NotifyTechAI

**Version**: 1.0  
**Status**: ENFORCED  
**Last Updated**: May 24, 2026  

---

## 🚫 Core Principle: OpenWA is an ENGINE, Not a Platform

```
WRONG (❌ DO NOT DO THIS):
NotifyTechAI SaaS → Uses OpenWA Dashboard + Features

CORRECT (✅ DO THIS):
NotifyTechAI SaaS Frontend
    ↓
NotifyTechAI Backend
    ↓
OpenWA Engine (REST API)
    ↓
WhatsApp Web + Puppeteer
```

---

## Rule 1: NEVER Use OpenWA Dashboard

### ❌ Forbidden
- OpenWA dashboard
- OpenWA frontend pages
- OpenWA auth system
- OpenWA user management
- OpenWA UI workflows
- OpenWA built-in templates

### ✅ Why
NotifyTechAI must be an **independent SaaS platform** with its own:
- Dashboard UI (Next.js)
- Authentication (NestJS + JWT)
- User management
- Branding
- Workflows

### ✅ How
- Treat OpenWA as a microservice (like a database driver)
- Only call OpenWA REST APIs
- Build all SaaS features in NotifyTechAI backend
- Build all UI in NotifyTechAI frontend

---

## Rule 2: OpenWA is Only a Micro Engine

### OpenWA Responsibilities
✅ WhatsApp session management  
✅ QR code generation  
✅ Message send/receive  
✅ Media handling  
✅ Connection management  
✅ Webhook events  

### OpenWA Does NOT Handle
❌ User authentication  
❌ Tenant management  
❌ Payment processing  
❌ Campaign logic  
❌ CRM features  
❌ Analytics  
❌ Team management  
❌ API authorization  
❌ Audit logging  

---

## Rule 3: Required OpenWA Features ONLY

### Session Management
```typescript
// Allowed OpenWA Operations
POST /api/sessions              // Create session
DELETE /api/sessions/:id        // Delete session
GET /api/sessions/:id/status    // Get status
POST /api/sessions/:id/start    // Start/reconnect
```

### QR Management
```typescript
GET /api/sessions/:id/qr        // Fetch QR code (Base64)
POST /api/sessions/:id/refresh-qr  // Refresh if expired
```

### Messaging
```typescript
POST /api/messages/send         // Send text message
POST /api/messages/send-media   // Send image/video
POST /api/messages/send-document// Send file
POST /api/messages/send-audio   // Send audio
```

### Webhooks
```typescript
// OpenWA calls Backend webhooks on events:
POST /backend/webhooks/message-received
POST /backend/webhooks/message-delivered
POST /backend/webhooks/message-read
POST /backend/webhooks/session-connected
POST /backend/webhooks/session-disconnected
```

---

## Rule 4: DO NOT Modify OpenWA Core Logic

### ❌ Never Change
- OpenWA authentication internals
- OpenWA session core
- Puppeteer browser automation
- WebSocket engine
- Chrome browser manager
- OpenWA database/storage

### ✅ Instead
Create **wrapper services** in NotifyTechAI backend:

```typescript
// Good approach:
backend/src/integrations/openwa/openwa.service.ts

export class OpenwaService {
  async createSession(tenantId, userId, sessionData) {
    // Call OpenWA API
    const response = await this.httpClient.post(
      `${this.openwaUrl}/api/sessions`,
      sessionData,
      { headers: { 'X-API-Key': this.apiKey } }
    );
    
    // Add NotifyTechAI business logic
    await this.db.whatsappSessions.create({
      tenantId,
      userId,
      externalSessionId: response.id,
      status: 'INITIALIZING'
    });
    
    return response;
  }
}
```

---

## Rule 5: Build Custom Backend Modules

### NotifyTechAI Backend Must Contain

#### Core Modules
- `auth/` - JWT authentication
- `tenants/` - Multi-tenant management
- `users/` - User management + RBAC
- `sessions/` - WhatsApp session wrapper

#### Business Logic Modules
- `inbox/` - Conversation management
- `campaigns/` - Campaign execution
- `crm/` - Contact management
- `contacts/` - Contact storage + enrichment
- `messages/` - Message history + search

#### Analytics & Insights
- `analytics/` - Dashboard metrics
- `webhooks/` - Event subscriptions
- `audit_logs/` - Compliance tracking

#### Billing & Operations
- `subscriptions/` - Plan management
- `billing/` - Payment handling
- `notifications/` - Email/SMS alerts
- `queue/` - Job processing
- `health/` - System monitoring

### Backend Module Structure
```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── filters/
│   ├── modules/
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── users/
│   │   ├── sessions/
│   │   ├── inbox/
│   │   ├── campaigns/
│   │   ├── crm/
│   │   ├── contacts/
│   │   ├── messages/
│   │   ├── analytics/
│   │   ├── webhooks/
│   │   ├── subscriptions/
│   │   ├── billing/
│   │   ├── notifications/
│   │   ├── queue/
│   │   └── health/
│   ├── integrations/
│   │   └── openwa/
│   │       ├── openwa.module.ts
│   │       ├── openwa.service.ts
│   │       ├── openwa.controller.ts
│   │       ├── dto/
│   │       ├── interfaces/
│   │       └── webhooks/
│   ├── database/
│   │   ├── entities/
│   │   ├── migrations/
│   │   └── data-source.ts
│   └── config/
│       └── configuration.ts
```

---

## Rule 6: Multi-Tenant Rules

### EVERY Table Must Contain `tenantId`

```sql
-- ✅ Correct
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,  -- ALWAYS PRESENT
  email VARCHAR NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, email)
);

-- ❌ Wrong
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL
  -- Missing tenant_id!
);
```

### Required Tables with `tenantId`
- ✅ tenants
- ✅ users
- ✅ whatsapp_sessions
- ✅ contacts
- ✅ conversations
- ✅ messages
- ✅ campaigns
- ✅ campaign_logs
- ✅ subscriptions
- ✅ invoices
- ✅ notifications
- ✅ webhook_logs
- ✅ audit_logs

### Query Validation Rule
```typescript
// ❌ Wrong - No tenant check
const messages = await db.messages.find({
  conversationId: convId
});

// ✅ Correct - Always filter by tenantId
const messages = await db.messages.find({
  tenantId: user.tenantId,  // Always include
  conversationId: convId
});
```

---

## Rule 7: Session Ownership Model

### Sessions Belong to: Tenant + User

```typescript
interface WhatsappSession {
  id: string;
  tenantId: string;           // Which tenant owns this
  userId: string;             // Which user created it
  sessionId: string;          // OpenWA session ID
  phoneNumber: string;        // WhatsApp number
  status: SessionStatus;      // CREATED, QR_READY, CONNECTED, etc.
  qrCode?: string;            // Base64 encoded
  isAuthenticated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Session ID format: {tenantId}-{userId}-{timestamp}
// Example: "tenant-abc-user-123-1234567890"
```

### Session Isolation
```typescript
// ❌ Wrong - Sessions shared between tenants
const session = await db.sessions.findById(sessionId);

// ✅ Correct - Always validate tenant ownership
const session = await db.sessions.findOne({
  id: sessionId,
  tenantId: user.tenantId  // Enforce ownership
});
if (!session) throw new ForbiddenException();
```

---

## Rule 8: OpenWA Service Layer

### Location
```
backend/src/integrations/openwa/
```

### Required Files

#### `openwa.module.ts` - NestJS Module
```typescript
import { Module } from '@nestjs/common';
import { OpenwaService } from './openwa.service';
import { OpenwaController } from './openwa.controller';

@Module({
  imports: [],
  providers: [OpenwaService],
  controllers: [OpenwaController],
  exports: [OpenwaService]
})
export class OpenwaModule {}
```

#### `openwa.service.ts` - Wrapper Service
```typescript
import { Injectable } from '@nestjs/common';
import { HttpClient } from '@nestjs/axios';

@Injectable()
export class OpenwaService {
  private readonly openwaUrl = process.env.OPENWA_URL;
  private readonly apiKey = process.env.OPENWA_API_KEY;

  constructor(private http: HttpClient) {}

  // Wraps OpenWA APIs and adds NotifyTechAI business logic
  async createSession(dto: CreateSessionDto) { }
  async getSession(sessionId: string) { }
  async deleteSession(sessionId: string) { }
  async getQrCode(sessionId: string) { }
  async sendMessage(dto: SendMessageDto) { }
  // ... more methods
}
```

#### `openwa.controller.ts` - Public Interface
```typescript
import { Controller, Post, Get, Delete, Body } from '@nestjs/common';
import { OpenwaService } from './openwa.service';

@Controller('api/sessions')
export class OpenwaController {
  constructor(private readonly openwaService: OpenwaService) {}

  @Post()
  async createSession(@Body() dto: CreateSessionDto) {
    return this.openwaService.createSession(dto);
  }

  @Get(':id/qr')
  async getQrCode(@Param('id') sessionId: string) {
    return this.openwaService.getQrCode(sessionId);
  }

  // ... more endpoints
}
```

#### `interfaces/` - Type Definitions
```typescript
export interface IOpenwaSession {
  id: string;
  status: string;
  phoneNumber?: string;
  isAuthenticated: boolean;
}

export interface IOpenwaMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  type: string;
}
```

#### `dto/` - Data Transfer Objects
```typescript
export class CreateSessionDto {
  userId: string;
  tenantId: string;
  phoneNumber?: string;
}

export class SendMessageDto {
  sessionId: string;
  phoneNumber: string;
  message: string;
  mediaUrl?: string;
}
```

---

## Rule 9: OpenWA Service Responsibilities

### Endpoint 1: Create Session
```typescript
POST /api/sessions

Request:
{
  tenantId: string;
  userId: string;
}

Response:
{
  id: string;                    // NotifyTechAI session ID
  externalSessionId: string;     // OpenWA session ID
  status: "INITIALIZING";
  createdAt: ISO8601;
}

Process:
1. Validate tenant and user
2. Call OpenWA: POST /api/sessions
3. Store in DB with tenantId
4. Return session details
```

### Endpoint 2: Start/Authenticate Session
```typescript
POST /api/sessions/:id/start

Response:
{
  status: "QR_READY";
  qrCode: "data:image/png;base64,...";
}

Process:
1. Validate session ownership (tenant + user)
2. Call OpenWA: POST /api/sessions/:externalId/start
3. Get QR code from OpenWA
4. Update status to "QR_READY"
5. Return QR
```

### Endpoint 3: Get QR Code
```typescript
GET /api/sessions/:id/qr

Response:
{
  qrCode: "data:image/png;base64,...";
  expiresAt: ISO8601;
}

Process:
1. Validate session exists and belongs to tenant
2. Check if still within polling time
3. Call OpenWA if expired
4. Return QR Base64
```

### Endpoint 4: Send Message
```typescript
POST /api/messages/send

Request:
{
  sessionId: string;
  phoneNumber: string;
  message: string;
}

Response:
{
  messageId: string;
  status: "QUEUED";
}

Process:
1. Validate tenant ownership
2. Add to BullMQ queue
3. Return immediately
4. Worker processes: Call OpenWA API
5. Update message status in DB
```

### Endpoint 5: Get Session Status
```typescript
GET /api/sessions/:id

Response:
{
  id: string;
  status: "CONNECTED" | "DISCONNECTED" | "QR_READY" | "FAILED";
  phoneNumber: string;
  isAuthenticated: boolean;
  lastActivity: ISO8601;
}

Process:
1. Check DB cache
2. If stale (>30s): Call OpenWA for fresh status
3. Update cache
4. Return status
```

### Endpoint 6: Delete Session
```typescript
DELETE /api/sessions/:id

Response:
{
  success: true;
  message: "Session deleted";
}

Process:
1. Validate tenant ownership
2. Call OpenWA: DELETE /api/sessions/:externalId
3. Update status to "DELETED"
4. Clean up WebSocket connections
5. Emit event to frontend
```

---

## Rule 10: Store OpenWA Config in Backend ONLY

### Never Expose to Frontend

```typescript
// ❌ WRONG - Exposed in frontend env
NEXT_PUBLIC_OPENWA_URL=http://localhost:2785
NEXT_PUBLIC_OPENWA_API_KEY=dev-admin-key

// ✅ CORRECT - Hidden in backend env only
// .env (backend only)
OPENWA_URL=http://localhost:2785
OPENWA_API_KEY=dev-admin-key
```

### Backend Storage
```typescript
// src/config/configuration.ts
export const openwaConfig = {
  url: process.env.OPENWA_URL,      // NOT in .env.local
  apiKey: process.env.OPENWA_API_KEY, // NOT in frontend
  timeout: 30000,
  retries: 3,
  webhookSecret: process.env.OPENWA_WEBHOOK_SECRET
};
```

### Frontend Access
```typescript
// Frontend NEVER knows OpenWA exists
// Frontend ONLY calls Backend API

const response = await fetch('/api/sessions/:id/qr');
// Backend handles OpenWA communication internally
```

---

## Rule 11: QR Flow - Correct Path

### ❌ WRONG Path
```
Frontend
→ OpenWA API (directly)
→ QR Code
→ Frontend Display
```

### ✅ CORRECT Path
```
Frontend
↓
Backend API: GET /api/sessions/:id/qr
↓
Backend Service: openwaService.getQrCode()
↓
OpenWA Engine: GET /api/sessions/:externalId/qr
↓
QR Base64 Response
↓
Backend Returns QR
↓
Frontend Displays QR
```

### Implementation
```typescript
// frontend/src/hooks/useQrCode.ts
export const useQrCode = (sessionId: string) => {
  return useQuery(['qr', sessionId], async () => {
    // ONLY call backend, NEVER OpenWA
    const response = await apiClient.get(
      `/api/sessions/${sessionId}/qr`
    );
    return response.data.qrCode;
  }, {
    refetchInterval: 2000, // Poll every 2 seconds
  });
};

// backend/src/integrations/openwa/openwa.service.ts
async getQrCode(sessionId: string) {
  // Validate tenant ownership
  const session = await this.db.sessions.findOne({
    id: sessionId,
    tenantId: currentUser.tenantId
  });

  // Call OpenWA internally
  const openwaResponse = await this.callOpenwa(
    'GET',
    `/api/sessions/${session.externalSessionId}/qr`,
    { headers: { 'X-API-Key': this.apiKey } }
  );

  return openwaResponse;
}
```

---

## Rule 12: Message Flow - Correct Paths

### Incoming Message Flow
```
WhatsApp Web
↓
OpenWA Receives
↓
OpenWA Webhook Call
↓
Backend Webhook: POST /webhooks/messages
↓
Save to DB (messages table)
↓
Redis Pub/Sub Event
↓
WebSocket Gateway Broadcasts
↓
Frontend Real-time Inbox Update
```

### Outgoing Message Flow
```
Frontend: User Sends Message
↓
Backend: POST /api/messages/send
↓
Backend: Add to BullMQ Queue
↓
Return immediately (optimistic)
↓
Worker: Processes from queue
↓
Worker: Calls OpenWA API
↓
Worker: Updates DB status
↓
WebSocket: Emit status update
↓
Frontend: Shows "Sent"
```

### Implementation
```typescript
// backend/src/modules/messages/messages.service.ts

// Incoming
async handleIncomingMessage(payload: any) {
  // 1. Save to database
  const message = await this.db.messages.create({
    tenantId: payload.tenantId,
    conversationId: payload.conversationId,
    content: payload.body,
    sender: 'contact',
    status: 'RECEIVED'
  });

  // 2. Emit to WebSocket
  this.gateway.broadcastToTenant(payload.tenantId, {
    event: 'message:received',
    data: message
  });

  return message;
}

// Outgoing
async sendMessage(dto: SendMessageDto, user: User) {
  // 1. Save to DB immediately
  const message = await this.db.messages.create({
    tenantId: user.tenantId,
    conversationId: dto.conversationId,
    content: dto.message,
    sender: 'agent',
    status: 'SENDING'
  });

  // 2. Queue for processing
  await this.queue.add('send-message', {
    messageId: message.id,
    sessionId: dto.sessionId,
    phoneNumber: dto.phoneNumber,
    content: dto.message
  });

  // 3. Return immediately (optimistic UI)
  return message;
}
```

---

## Rule 13: Required Database Tables

### Multi-Tenant Core
- `tenants` - SaaS tenant companies
- `users` - Team members
- `active_sessions` - Device/browser sessions

### WhatsApp Integration
- `whatsapp_sessions` - OpenWA session wrappers
- `whatsapp_webhooks` - Webhook delivery tracking

### Communication
- `contacts` - External WhatsApp contacts
- `conversations` - Chat threads
- `messages` - Individual messages

### Automation
- `campaigns` - Bulk message campaigns
- `campaign_recipients` - Campaign delivery tracking

### Business
- `subscriptions` - Billing subscriptions
- `invoices` - Payment records

### Operations
- `notifications` - System notifications
- `webhook_logs` - Event history
- `audit_logs` - Compliance tracking

---

## Rule 14: Session Status States

### Use Unified Status Enum
```typescript
enum WhatsappSessionStatus {
  CREATED = 'CREATED',               // Just created
  INITIALIZING = 'INITIALIZING',     // Starting up
  QR_READY = 'QR_READY',             // Show QR to user
  CONNECTING = 'CONNECTING',         // Scanning in progress
  CONNECTED = 'CONNECTED',           // Authenticated
  DISCONNECTED = 'DISCONNECTED',     // Lost connection
  RECONNECTING = 'RECONNECTING',     // Attempting reconnect
  FAILED = 'FAILED',                 // Auth failed
  DELETING = 'DELETING',             // Being deleted
  DELETED = 'DELETED'                // Removed
}
```

### Transition Diagram
```
CREATED
    ↓
INITIALIZING
    ↓
QR_READY ← (user scans QR)
    ↓
CONNECTING
    ↓
CONNECTED ← (authenticated)
    ↓ (connection lost)
DISCONNECTED
    ↓ (automatic retry)
RECONNECTING
    ↓
CONNECTED (recovered)
    ↓ (manual delete)
DELETING
    ↓
DELETED
```

### Never Expose Raw OpenWA Statuses
```typescript
// ❌ Wrong - Exposes OpenWA internals
status: 'NOAUTH' | 'INITING' | 'CONNECTED'

// ✅ Correct - Unified enum
status: WhatsappSessionStatus
```

---

## Rule 15: Required Security Rules

### Authentication
- ✅ JWT access tokens (15-minute expiry)
- ✅ JWT refresh tokens (7-day expiry)
- ✅ Password hashing (bcrypt 10+ rounds)
- ✅ Session validation on every request

### Authorization
- ✅ Role-based access control (7 roles)
- ✅ Tenant guards on every endpoint
- ✅ Resource ownership validation
- ✅ Permission matrix enforcement

### API Security
- ✅ Rate limiting (100 req/min per user)
- ✅ Request validation (class-validator)
- ✅ CORS configuration
- ✅ Helmet security headers

### Audit & Compliance
- ✅ Audit logging (all modifications)
- ✅ Webhook signature validation (HMAC-SHA256)
- ✅ Tenant isolation (RLS policies)
- ✅ Data encryption in transit (HTTPS)

### Implementation
```typescript
// Protect all endpoints
@UseGuards(JwtAuthGuard, TenantGuard, ValidateTenantGuard)
@Post('api/sessions')
async createSession(
  @Body() dto: CreateSessionDto,
  @CurrentUser() user: User
) {
  // User tenant ownership already validated by guards
  return this.service.createSession(dto, user);
}
```

---

## Rule 16: Frontend Pages Required

### All Pages Are NotifyTechAI Custom

#### Authentication Pages
- `login` - Login with email/password
- `register` - Tenant signup
- `reset-password` - Password recovery

#### Main Dashboard
- `dashboard` - Overview metrics
- `settings` - Global settings

#### WhatsApp Management
- `sessions` - List/manage sessions
- `sessions/new` - Create and scan QR
- `sessions/:id` - View session details

#### Communication
- `inbox` - Team inbox with conversations
- `inbox/:id` - Conversation thread
- `contacts` - Contact directory
- `contacts/:id` - Contact details

#### Business Logic
- `campaigns` - Campaign management
- `campaigns/new` - Create campaign
- `campaigns/:id` - Campaign details
- `crm` - CRM dashboard

#### Insights
- `analytics` - Performance metrics
- `analytics/sessions` - Session stats
- `analytics/messages` - Messaging stats

#### Team & Billing
- `team` - Team member management
- `billing` - Subscription & invoices
- `billing/upgrade` - Plan upgrade

### NO OpenWA Dashboard Pages
- ❌ Do NOT copy OpenWA UI
- ❌ Do NOT use OpenWA CSS
- ❌ Do NOT reuse OpenWA components
- ❌ Build CUSTOM UI with Next.js + Tailwind + shadcn/ui

---

## Rule 17: Required Tech Stack

### Frontend Layer
```
Framework:    Next.js 14+ with App Router
Language:     TypeScript (strict mode)
Styling:      Tailwind CSS + shadcn/ui
State:        Zustand
Data Fetch:   React Query (TanStack Query)
HTTP Client:  Axios with interceptors
Real-time:    Socket.io-client
Icons:        lucide-react
```

### Backend Layer
```
Framework:    NestJS (latest)
Language:     TypeScript
Database:     PostgreSQL 15+
ORM:          Prisma or TypeORM
Cache:        Redis 7+
Queue:        BullMQ
Real-time:    Socket.io Gateway
API Docs:     Swagger/OpenAPI
Validation:   class-validator + class-transformer
Security:     Passport.js + JWT + Helmet
```

### Engine Layer
```
Core:         OpenWA (@openwa/wa-automate)
Automation:   Puppeteer
Browser:      Chrome/Chromium
Server:       Express.js
Transport:    REST API + Webhooks
```

### Infrastructure
```
Containerization:  Docker + Docker Compose
CI/CD:             GitHub Actions
Deployment:        VPS or Cloud
Reverse Proxy:     Nginx
SSL:               Let's Encrypt
```

---

## Rule 18: Queue System for Heavy Operations

### All Heavy Operations Must Use Queues

```typescript
// ✅ Campaigns
- Campaign sending (one job per recipient)
- CSV upload processing
- Campaign statistics aggregation

// ✅ Messaging
- Message retries (exponential backoff)
- Media processing
- Message search indexing

// ✅ Webhooks
- Webhook delivery
- Webhook retries
- Event aggregation

// ✅ Notifications
- Email sending
- SMS sending
- Push notifications

// ✅ Analytics
- Metrics aggregation
- Report generation
- Data export
```

### Implementation
```typescript
import { Queue, Worker } from 'bullmq';

// Define queue
const messageQueue = new Queue('send-message', {
  connection: redis
});

// Add job
await messageQueue.add('send', {
  messageId: string,
  sessionId: string,
  phoneNumber: string,
  content: string
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true
});

// Process job
const worker = new Worker('send-message', async (job) => {
  // Call OpenWA
  await this.openwaService.sendMessage(job.data);
}, { connection: redis });

worker.on('completed', (job) => {
  // Emit WebSocket event
  this.gateway.broadcastToTenant(tenantId, {
    event: 'message:sent',
    data: { messageId: job.data.messageId }
  });
});
```

---

## Rule 19: DO NOT Build Monolithic OpenWA App

### ❌ Bad Architecture
```
OpenWA with custom features:
- Handles WhatsApp connections
- Has dashboard UI
- Manages users
- Tracks campaigns
- Processes payments
- Stores contacts
- Everything in one place
```

### ✅ Good Architecture
```
Clear Separation:

OpenWA Engine (Containerized)
├── WhatsApp sessions
├── QR generation
├── Message send/receive
├── Webhook events
└── REST API

NotifyTechAI Platform (Complete SaaS)
├── Frontend (Next.js Dashboard)
├── Backend (NestJS APIs)
├── Database (PostgreSQL)
├── Cache (Redis)
├── Queues (BullMQ)
├── Auth, Tenants, Users
├── Campaigns, CRM, Analytics
├── Billing, Subscriptions
└── Everything else
```

### Benefits
- ✅ OpenWA can be upgraded independently
- ✅ NotifyTechAI is NOT dependent on OpenWA versions
- ✅ Can switch WhatsApp engines (if needed)
- ✅ Scalability: Multiple OpenWA instances
- ✅ Reliability: Isolated failure domains

---

## Rule 20: Final Goal - Production SaaS Platform

### Build Like:
- Interakt
- Wati
- AiSensy
- Zoko
- DelightChat

### Using:
- ✅ Custom Frontend (Next.js 14)
- ✅ Custom Backend (NestJS)
- ✅ Custom Auth (JWT + RBAC)
- ✅ Custom Tenants (Multi-tenant)
- ✅ Custom CRM (Contact management)
- ✅ Custom Campaigns (Bulk messaging)
- ✅ Custom Inbox (Team collaboration)
- ✅ Custom Analytics (Metrics)
- ✅ Custom Billing (Subscriptions)
- ✅ Custom Team Management (Role-based)
- ✅ OpenWA ONLY for WhatsApp Connectivity

### Success Criteria
- ✅ Multi-tenant architecture
- ✅ 99.9% uptime
- ✅ <500ms API response time
- ✅ Real-time messaging
- ✅ Team collaboration
- ✅ Campaign automation
- ✅ Analytics dashboard
- ✅ Billing integration
- ✅ Production deployment
- ✅ Enterprise security

---

## Development Priority Order

### Phase 1: OpenWA Engine Setup
- Setup OpenWA standalone service
- Create REST API wrapper
- Implement session management
- Setup webhook system

### Phase 2: Backend Architecture
- Create NestJS project
- Setup database schema
- Implement authentication
- Build core modules

### Phase 3: Authentication + Multi-Tenant
- JWT token system
- Refresh token logic
- Role-based access control
- Tenant isolation everywhere

### Phase 4: WhatsApp Session APIs
- Session creation
- QR generation
- Session status
- Session deletion

### Phase 5: Inbox System
- Conversation management
- Message threading
- Team assignment
- Real-time updates

### Phase 6: Campaign System
- Campaign creation
- CSV upload
- Bulk sending
- Delivery tracking

### Phase 7: CRM + Analytics
- Contact management
- Contact enrichment
- Dashboard metrics
- Report generation

### Phase 8: Billing + Subscriptions
- Razorpay integration
- Subscription plans
- Invoice generation
- Quota enforcement

### Phase 9: Scaling + Deployment
- Docker containerization
- CI/CD pipeline
- Production deployment
- Monitoring setup

---

## Critical Implementation Checklist

- [ ] **NEVER build in OpenWA**
  - Use only OpenWA REST APIs
  - Wrap with NotifyTechAI services
  - No custom OpenWA modifications

- [ ] **Frontend isolation**
  - Never calls OpenWA directly
  - All API calls through Backend
  - No OpenWA credentials in frontend

- [ ] **Backend wrapper layer**
  - `integrations/openwa/` service
  - All business logic in backend
  - OpenWA is just the driver

- [ ] **Multi-tenant everywhere**
  - Every table has `tenantId`
  - Every query filtered by tenant
  - Database RLS policies

- [ ] **Session ownership**
  - Sessions belong to tenant + user
  - Never share sessions
  - Validate on every operation

- [ ] **Queue for async**
  - Campaigns in queue
  - Webhooks in queue
  - Message retries in queue

- [ ] **Complete SaaS features**
  - Auth, users, tenants
  - Inbox, campaigns, CRM
  - Analytics, billing
  - Team management

- [ ] **Production ready**
  - Security hardened
  - Error handling
  - Rate limiting
  - Audit logging

---

## Summary

**OpenWA** = WhatsApp Driver (Like database driver)  
**NotifyTechAI** = Complete SaaS Platform  
**Integration** = REST API only  
**Frontend** = Never knows OpenWA exists  
**Backend** = Wraps OpenWA + adds business logic  
**Goal** = Production SaaS like Interakt/Wati  

---

*These 20 rules are ENFORCED. Violating any rule will compromise the architecture.*

