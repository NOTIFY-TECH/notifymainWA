# NotifyTechAI + OpenWA — Complete Development Guide

## Project Overview

NotifyTechAI is a production-grade, multi-tenant WhatsApp SaaS platform that enables businesses to manage customer communications, run marketing campaigns, and maintain team inbox workflows—all powered by OpenWA as the WhatsApp infrastructure engine.

### Key Principles

- **OpenWA as Engine**: OpenWA handles ONLY WhatsApp connection, QR codes, session management, and message routing
- **No OpenWA UI**: Complete custom frontend and backend independent of OpenWA dashboard
- **Multi-Tenant**: Strict tenant isolation at every layer
- **SaaS Ready**: Subscriptions, billing, usage tracking, and quota limits built-in
- **Enterprise Grade**: Team collaboration, role-based access, audit logging, security hardened

---

## Core Architecture

```
┌─────────────────────────┐
│   NotifyTechAI Frontend  │ (Next.js + Tailwind + shadcn/ui)
│   (Custom Dashboard)    │
└────────────┬────────────┘
             │
┌────────────▼──────────────────┐
│  NotifyTechAI Backend API      │ (NestJS + PostgreSQL + Prisma)
│  - Auth/Tenants/Users         │
│  - Campaigns/Contacts/CRM      │
│  - Webhooks/Analytics/Billing  │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  OpenWA Engine (Isolated)      │ (REST API)
│  - QR Generation              │
│  - Session Management         │
│  - Message Send/Receive       │
│  - Webhook Events            │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  WhatsApp Web (Browser)        │ (Puppeteer + Chrome)
│  - Real WhatsApp Connection   │
└────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Animation**: Framer Motion
- **State**: Zustand
- **Data Fetching**: React Query + Axios
- **UI Components**: Radix UI primitives

### Backend
- **Framework**: NestJS (latest)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Cache**: Redis
- **Job Queue**: BullMQ
- **Auth**: JWT (access + refresh tokens)
- **Real-time**: WebSocket Gateway
- **API Docs**: Swagger/OpenAPI
- **Validation**: class-validator + class-transformer

### WhatsApp Engine (OpenWA)
- **Core**: OpenWA library
- **Browser Automation**: Puppeteer
- **Session Storage**: File-based + Redis backup
- **QR Generation**: qrcode library

---

## Project Repository Structure

```
NotifyTechAI/
│
├── docs/
│   ├── PHASE_1_OPENWA_SETUP.md
│   ├── PHASE_2_BACKEND.md
│   ├── PHASE_3_FRONTEND.md
│   ├── AUTH_SYSTEM.md
│   ├── DATABASE_DESIGN.md
│   ├── SESSIONS_SYSTEM.md
│   ├── MESSAGES_SYSTEM.md
│   ├── INBOX_SYSTEM.md
│   ├── CAMPAIGNS_SYSTEM.md
│   ├── CRM_SYSTEM.md
│   ├── ANALYTICS_SYSTEM.md
│   ├── WEBHOOKS_SYSTEM.md
│   ├── BILLING_SYSTEM.md
│   ├── INFRASTRUCTURE.md
│   └── SECURITY.md
│
├── openwa-engine/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── src/
│       ├── main.ts
│       ├── config/
│       ├── services/
│       ├── routes/
│       └── utils/
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker/
│   │   └── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── users/
│   │   ├── sessions/
│   │   ├── messages/
│   │   ├── inbox/
│   │   ├── campaigns/
│   │   ├── contacts/
│   │   ├── crm/
│   │   ├── analytics/
│   │   ├── webhooks/
│   │   ├── billing/
│   │   ├── subscriptions/
│   │   ├── notifications/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── pipes/
│   │   │   ├── filters/
│   │   │   └── utils/
│   │   └── queue/
│   └── test/
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── sessions/
│   │   │   ├── qr/
│   │   │   ├── inbox/
│   │   │   ├── campaigns/
│   │   │   ├── contacts/
│   │   │   ├── crm/
│   │   │   ├── analytics/
│   │   │   ├── billing/
│   │   │   ├── team/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── forms/
│   │   │   ├── cards/
│   │   │   ├── modals/
│   │   │   ├── inbox/
│   │   │   └── common/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   ├── lib/
│   │   └── styles/
│   └── .env.local
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
└── DEVELOPMENT.md
```

---

## Development Phases Timeline

### Phase 1: OpenWA Engine Setup
**Duration**: 1-2 weeks
- Set up OpenWA instance
- Configure session management
- Implement QR code generation
- Test WhatsApp connection
- Create API endpoints

**Output**: Working WhatsApp connection engine

### Phase 2: Backend Foundation
**Duration**: 3-4 weeks
- Set up NestJS project
- Design database schema
- Implement authentication
- Create core modules
- Set up job queues
- Implement WebSocket gateway

**Output**: Production-ready backend API

### Phase 3: Frontend Development
**Duration**: 3-4 weeks
- Set up Next.js project
- Create UI component library
- Build dashboard pages
- Implement real-time features
- Add analytics visualizations
- Style with Tailwind

**Output**: Full customer-facing SaaS dashboard

### Phase 4: Integration & Testing
**Duration**: 2-3 weeks
- End-to-end testing
- Performance optimization
- Security audit
- Load testing
- Documentation

**Output**: Production-ready system

### Phase 5: Deployment & Monitoring
**Duration**: 1-2 weeks
- Docker containerization
- CI/CD pipeline setup
- Production deployment
- Monitoring setup
- Launch

**Output**: Live production system

---

## Critical Design Decisions

### 1. Tenant Isolation
- Every entity must have `tenantId` field
- Database row-level security (RLS) for PostgreSQL
- Redis keys prefixed with `tenant:{tenantId}:*`
- API middleware enforces tenant validation
- No cross-tenant data queries allowed

### 2. OpenWA Integration Pattern
```
Frontend → Backend API → OpenWA REST API → WhatsApp Web
```
- Backend is the ONLY client of OpenWA
- Frontend never talks to OpenWA directly
- All OpenWA sessions scoped to tenant+user
- Session state cached in Redis

### 3. Message Flow
```
WhatsApp Message Arrives
    ↓
OpenWA Webhook Event
    ↓
Backend Processes Message
    ↓
Store in Database
    ↓
WebSocket Broadcast to Frontend
    ↓
Real-time Inbox Update
```

### 4. Scalability Strategy
- **Horizontal**: Multiple backend instances with shared Redis + PostgreSQL
- **Queue Processing**: BullMQ workers scale independently
- **Session Management**: Redis-backed session store
- **WebSocket**: Redis PubSub for multi-instance broadcasting

---

## Key Features by Module

### Authentication & Authorization
- JWT with access + refresh tokens
- Tenant-based isolation
- 7 role levels (SUPER_ADMIN, PARTNER, CLIENT, ADMIN, AGENT, TEAM_LEADER, USER)
- Row-level security in database
- Audit logging for sensitive operations

### Session Management
- Create/list/delete WhatsApp sessions
- QR code generation and polling
- Auto-reconnect on disconnect
- Session persistence across restarts
- Multi-user access to same session (for team)

### Message Management
- Send text, media, documents, images, audio
- Message templates
- Bulk messaging with CSV upload
- Scheduled message sending
- Delivery tracking and retry logic
- Message search and history

### Team Inbox
- Shared conversation workspace
- Real-time message sync across agents
- Agent assignment and routing
- Internal notes and tags
- Conversation status labels
- Typing indicators and read receipts

### Campaign Management
- Create campaigns via UI or CSV upload
- Target list management
- Template selection
- Scheduling and execution
- Real-time delivery tracking
- Campaign performance analytics
- Retry failed deliveries

### CRM Features
- Contact management with custom fields
- Lead pipeline management
- Task and follow-up scheduling
- Activity timeline per contact
- Notes and internal communication
- Team assignment and ownership

### Analytics Dashboard
- Real-time metrics (messages sent, active sessions)
- Campaign performance (delivery rate, engagement)
- Agent performance (response time, resolution rate)
- Contact analytics (engagement level, tags)
- Revenue metrics (subscription tier, MRR)
- Tenant usage dashboards

### Webhook System
- Outgoing webhooks for external integrations
- Webhook retry logic with exponential backoff
- Webhook event history and logs
- Idempotency for webhook processing
- Custom header support

### Billing & Subscriptions
- Razor pay integration (or Stripe)
- Subscription plans (BASIC, GROWTH, PROFESSIONAL, ENTERPRISE)
- Usage-based pricing add-ons
- Invoice generation and download
- Trial period management
- Quota enforcement

---

## Development Best Practices

### Code Quality
- Use TypeScript everywhere (strict mode)
- ESLint + Prettier for consistency
- 80%+ test coverage requirement
- API documentation via Swagger
- Meaningful commit messages

### Performance
- Database query optimization and indexing
- Redis caching for frequently accessed data
- Pagination for large datasets (default 20 items)
- Lazy loading in frontend
- WebSocket message batching
- Queue job prioritization

### Security
- HTTPS everywhere
- CSRF protection
- Rate limiting on APIs
- Input validation and sanitization
- Helmet.js for security headers
- Secure session cookies
- Regular dependency audits
- Secrets management (env variables)

### Monitoring
- Health check endpoints
- Error logging and alerting
- Queue job monitoring
- WebSocket connection tracking
- API response time tracking
- Database connection pooling monitoring

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
```

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/notifytechai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
OPENWA_API_URL=http://localhost:3500
OPENWA_API_KEY=dev-key
RAZORPAY_KEY_ID=xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

### OpenWA Engine (.env)
```
NODE_ENV=development
PORT=3500
API_KEY=dev-key
SESSIONS_DIR=./sessions
CHROME_PATH=/usr/bin/chromium
REDIS_URL=redis://localhost:6379
```

---

## Next Steps

1. Read **PHASE_1_OPENWA_SETUP.md** to start the engine setup
2. Follow **PHASE_2_BACKEND.md** for backend development
3. Reference **PHASE_3_FRONTEND.md** for frontend implementation
4. Consult module-specific docs for detailed implementation
5. Check **INFRASTRUCTURE.md** for deployment and DevOps

---

## Success Metrics

✅ Working multi-tenant WhatsApp platform
✅ 99.9% message delivery rate
✅ <500ms API response times
✅ <1s real-time message delivery to inbox
✅ Support for 1000+ concurrent users per deployment
✅ Full audit trail of all actions
✅ Secure, isolated multi-tenant architecture
✅ Production-ready monitoring and alerting
✅ Seamless scalability

---

**Start with Phase 1 documentation →**
